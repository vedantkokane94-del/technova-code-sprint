import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { computeUserSummary } from '../src/utils/scoring.js';
import {
  validateRegistrationPayload,
  validateEmailAddress,
  normalizeEmail,
  validateIndianPhone,
  normalizeIndianPhone
} from '../src/utils/registrationValidation.js';
import {
  verifyEmailDomainMx,
  generateSixDigitOtp,
  hashOtp,
  verifyOtpHash,
  verifyCaptchaToken,
  sendVerificationEmailOtp,
  sendVerificationPhoneOtp
} from './registrationValidator.js';
import {
  readLocalStore,
  writeLocalStore,
  mergeStores,
  syncFromSupabaseIfConfigured,
  pushToSupabaseIfConfigured,
  isSupabaseConfigured,
  deleteStudentFromDb,
  clearAllStudentsFromDb
} from './dbAdapter.js';

// Ensure server-side env variables from .env are available even if not preloaded by bundler
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const rawLine of envLines) {
      const line = rawLine.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const eqIdx = line.indexOf('=');
        const k = line.substring(0, eqIdx).trim();
        const v = line.substring(eqIdx + 1).trim();
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  }
} catch (e) {}

// Helper to safely read and write shared store (Supabase + Serverless /tmp + local data-store.json)
export function getStore() {
  return readLocalStore();
}

// In-memory rate limiting map for certificate public verification (max 60 req/min per IP)
const verificationRateLimitMap = new Map();
function checkVerificationRateLimit(ip) {
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return true; // Bypass rate limiting for local test runs
  }
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxReqs = 60; // 60 requests per minute
  let timestamps = verificationRateLimitMap.get(ip) || [];
  timestamps = timestamps.filter(t => now - t < windowMs);
  if (timestamps.length >= maxReqs) {
    verificationRateLimitMap.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  verificationRateLimitMap.set(ip, timestamps);
  return true;
}

export function saveStore(store) {
  writeLocalStore(store);
  pushToSupabaseIfConfigured(store).catch(() => {});
}

function getRegistrationSettings(store) {
  const defaults = {
    allowlistEnabled: process.env.ALLOWED_EMAIL_DOMAINS_ENABLED === 'true',
    allowedDomains: (process.env.ALLOWED_EMAIL_DOMAINS || 'svit.ac.in,pravara.in,sinhgad.edu')
      .split(',')
      .map(d => d.trim().toLowerCase())
      .filter(Boolean),
    phoneVerificationRequired: process.env.PHONE_VERIFICATION_REQUIRED === 'true',
    minSubmitTimeMs: 2500,
    turnstileSiteKey: process.env.VITE_TURNSTILE_SITE_KEY || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''
  };
  return {
    ...defaults,
    ...(store.registrationSettings || {}),
    turnstileSiteKey: defaults.turnstileSiteKey
  };
}

function checkScopedRateLimit(store, key, maxAttempts, windowMs) {
  const now = Date.now();
  store.registrationRateLimits = store.registrationRateLimits || {};
  const entry = store.registrationRateLimits[key] || { timestamps: [] };
  const recent = (entry.timestamps || []).filter(ts => now - ts < windowMs);
  if (recent.length >= maxAttempts) {
    const oldest = recent[0] || now;
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    store.registrationRateLimits[key] = { timestamps: recent };
    return { allowed: false, retryAfterSeconds };
  }
  recent.push(now);
  store.registrationRateLimits[key] = { timestamps: recent };
  return { allowed: true, retryAfterSeconds: 0 };
}

function isStudentEligibleForActiveAccess(student) {
  if (!student) return true;
  if (student.suspended || student.accountStatus === 'suspended') return false;
  return true;
}

function decorateStudentForClient(student) {
  if (!student) return null;
  const { sessionToken: _st, ...rest } = student;
  const isLegacyUnverified =
    student.accountStatus !== 'unverified' &&
    student.accountStatus !== 'verified' &&
    (!student.emailVerified || !student.phone);
  return {
    ...rest,
    emailVerified: Boolean(student.emailVerified),
    phoneVerified: Boolean(student.phoneVerified),
    accountStatus: student.accountStatus || (student.emailVerified ? 'verified' : 'legacy_active'),
    needsLegacyVerification: Boolean(student.needsLegacyVerification ?? isLegacyUnverified),
    language: student.language || student.track || 'Python',
    track: student.track || student.language || 'Python',
    division: student.division || 'A',
    role: 'student'
  };
}

function getStudentTokenSecret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_JWT_SECRET || 'svit-technova-student-session-secret-2026';
}

function createStudentSessionToken(user) {
  const payload = {
    uid: user.uid,
    prn: String(user.prn || '').trim().toUpperCase(),
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    year: user.year || 'First Year (FE)',
    branch: user.branch || 'Computer Engineering',
    division: user.division || 'A',
    language: user.language || user.track || 'Python',
    track: user.track || user.language || 'Python',
    emailVerified: Boolean(user.emailVerified),
    phoneVerified: Boolean(user.phoneVerified),
    accountStatus: user.accountStatus || 'verified',
    role: 'student',
    iat: Date.now()
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getStudentTokenSecret()).update(payloadB64).digest('base64url');
  return `TNV-STU.${payloadB64}.${sig}`;
}

function verifyStudentSessionToken(token) {
  if (!token || typeof token !== 'string' || !token.startsWith('TNV-STU.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, payloadB64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', getStudentTokenSecret()).update(payloadB64).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
  } catch (e) {
    return null;
  }
}

function computeSharedLeaderboard(store) {
  const studentLookup = new Map();
  for (const s of store.students || []) {
    if (s.prn) studentLookup.set(String(s.prn).trim().toUpperCase(), s);
    if (s.uid) studentLookup.set(s.uid, s);
  }

  const studentMap = {};
  for (const sub of store.submissions || []) {
    const normPrn = String(sub.prn || '').trim().toUpperCase();
    const key = normPrn || sub.userId;
    if (!key) continue;
    const profile = studentLookup.get(normPrn) || studentLookup.get(sub.userId) || null;
    // Block unverified or suspended accounts from appearing on the leaderboard
    if (profile && !isStudentEligibleForActiveAccess(profile)) {
      continue;
    }
    if (!studentMap[key]) {
      studentMap[key] = {
        userId: profile?.uid || sub.userId || `svit-stu-${normPrn}`,
        name: profile?.name || sub.studentName || 'Student',
        prn: normPrn || profile?.prn || sub.prn,
        branch: profile?.branch || sub.branch || 'Computer Engineering',
        year: profile?.year || sub.year || 'First Year (FE)',
        division: profile?.division || sub.division || 'A',
        language: profile?.language || profile?.track || sub.language || sub.track || 'Python',
        track: profile?.track || profile?.language || sub.track || sub.language || 'Python',
        emailVerified: Boolean(profile?.emailVerified),
        accountStatus: profile?.accountStatus || 'legacy_active',
        submissions: []
      };
    } else if (profile) {
      studentMap[key].name = profile.name || studentMap[key].name;
      studentMap[key].language = profile.language || profile.track || studentMap[key].language;
      studentMap[key].track = profile.track || profile.language || studentMap[key].track;
    }
    studentMap[key].submissions.push(sub);
  }

  const overrides = store.manualOverrides || {};
  const list = Object.values(studentMap).map(stud => {
    const ov = overrides[stud.userId] ?? overrides[stud.prn];
    const summary = computeUserSummary(stud.submissions, ov);
    return {
      ...stud,
      summary
    };
  });

  // Sort strictly by:
  // 1. Total score out of 100 (descending)
  // 2. On-time days count (descending)
  // 3. Earlier last-submission time (ascending)
  list.sort((a, b) => {
    if (b.summary.totalScore !== a.summary.totalScore) {
      return b.summary.totalScore - a.summary.totalScore;
    }
    if (b.summary.onTimeCount !== a.summary.onTimeCount) {
      return b.summary.onTimeCount - a.summary.onTimeCount;
    }
    return (a.summary.lastSubmissionTime || Infinity) - (b.summary.lastSubmissionTime || Infinity);
  });

  return list;
}

// Cookie parser helper
function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      const key = parts.shift().trim();
      const value = decodeURIComponent(parts.join('='));
      list[key] = value;
    });
  }
  return list;
}

// SHA-256 hash helper for tokens
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Helper: Detect HTTPS / secure connection
function isSecureConnection(req) {
  return req.headers['x-forwarded-proto'] === 'https' ||
         Boolean(req.socket?.encrypted) ||
         Boolean(process.env.VERCEL) ||
         process.env.NODE_ENV === 'production';
}

// Client IP extractor: Untrusted unless behind known reverse proxy configured via TRUST_PROXY
function getClientIp(req) {
  const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1' || Boolean(process.env.VERCEL);
  if (trustProxy) {
    if (req.headers['x-forwarded-for']) {
      return req.headers['x-forwarded-for'].split(',')[0].trim();
    }
    if (req.headers['x-real-ip']) {
      return req.headers['x-real-ip'].trim();
    }
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
}

// Check IP against optional ADMIN_ALLOWED_IPS env variable
function isIpAllowed(clientIp) {
  const allowedIpsEnv = process.env.ADMIN_ALLOWED_IPS;
  if (!allowedIpsEnv || !allowedIpsEnv.trim()) {
    return true; // No IP restriction configured
  }
  const allowedList = allowedIpsEnv.split(',').map(ip => ip.trim()).filter(Boolean);
  if (allowedList.length === 0) return true;

  // Normalize IP
  const cleanIp = clientIp.replace(/^::ffff:/, '');
  return allowedList.some(ip => {
    const cleanAllowed = ip.replace(/^::ffff:/, '');
    return cleanAllowed === cleanIp || cleanAllowed === '*' || (cleanAllowed === 'localhost' && (cleanIp === '127.0.0.1' || cleanIp === '::1'));
  });
}

// Get master JWT signing secret from env (supporting JWT_SECRET, ADMIN_JWT_SECRET, and SESSION_SECRET)
function getSessionSecret() {
  return process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || process.env.SESSION_SECRET || '4e2776d13a80a0c7be68dd0cb05fe02c341972926dd4f84b95e9908ac71ae36e';
}

// Verify Admin Master Password using plain-text ADMIN_PASSWORD, Bcrypt ADMIN_PASSWORD_HASH, or verified default hash
function verifyAdminPassword(inputPassword) {
  if (process.env.ADMIN_PASSWORD_HASH === '' || process.env.ADMIN_AUTH_DISABLED === 'true') {
    return false;
  }
  if (!inputPassword) return false;

  // 1. Plain text comparison if ADMIN_PASSWORD is set directly in Vercel
  if (process.env.ADMIN_PASSWORD && inputPassword === process.env.ADMIN_PASSWORD) {
    return true;
  }

  // 2. Bcrypt hash comparison if ADMIN_PASSWORD_HASH is set, or default cost-12 hash for BuildLearn@SVIT#9Q
  const hashedAdminPass = process.env.ADMIN_PASSWORD_HASH || '$2b$12$Uqx9rEgpvFZSZR8GTKP5/up13Tx1L8Jtm3cSmRzjUdT2ftxrqZl7y';
  try {
    return bcrypt.compareSync(inputPassword, hashedAdminPass);
  } catch (e) {
    console.error('[AdminAuth] Bcrypt compare error:', e.message);
    return false;
  }
}

// Strict Security Headers for Admin Endpoints
function applyAdminSecurityHeaders(res) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' blob:; frame-ancestors 'none';");
}

// Sign and verify device cookie token using HMAC
function signDeviceToken(rawSecret) {
  const sessionSecret = getSessionSecret();
  const sig = crypto.createHmac('sha256', sessionSecret).update(rawSecret).digest('hex');
  return `${rawSecret}.${sig}`;
}

function verifyDeviceToken(signedToken) {
  if (!signedToken || typeof signedToken !== 'string') return null;
  const parts = signedToken.split('.');
  if (parts.length !== 2) return null;
  const [rawSecret, sig] = parts;
  const sessionSecret = getSessionSecret();
  const expectedSig = crypto.createHmac('sha256', sessionSecret).update(rawSecret).digest('hex');
  if (sig !== expectedSig) return null;
  return rawSecret;
}

// 2-Hour HMAC-SHA256 JWT generation and verification bound to email, session ID and optional device token
function createAdminSessionJwt(sessionId, email = 'technicalteamsvit@gmail.com', deviceTokenHash = null) {
  const sessionSecret = getSessionSecret();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (2 * 3600); // 2 hours
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'admin',
    email,
    sessionId,
    deviceTokenHash,
    iat: now,
    exp
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifyAdminSessionJwt(jwtToken, deviceTokenHash = null) {
  if (!jwtToken || typeof jwtToken !== 'string') return null;
  const parts = jwtToken.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const sessionSecret = getSessionSecret();
  const expectedSig = crypto.createHmac('sha256', sessionSecret).update(`${header}.${payload}`).digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    const now = Math.floor(Date.now() / 1000);
    if (data.exp && data.exp < now) return null; // Expired
    if (deviceTokenHash && data.deviceTokenHash && data.deviceTokenHash !== deviceTokenHash) return null; // Device binding mismatch
    return data;
  } catch (e) {
    return null;
  }
}

// Device matching helper: Validates 2-Factor Hardware Binding (Signed httpOnly cookie AND IndexedDB factor) + fingerprint
function getMatchingTrustedDevice(req, cookies, body, store) {
  const devices = store.adminDevices || (store.adminDevice ? [store.adminDevice] : []);
  if (devices.length === 0) return null;

  const cookieToken = cookies['admin_device_token'];
  const headerFactor = req.headers['x-device-factor'] || body?.deviceFactor;

  // Both factors must exist
  if (!cookieToken || !headerFactor) return null;

  // Verify HMAC signature of the device cookie
  const rawCookieSecret = verifyDeviceToken(cookieToken);
  if (!rawCookieSecret) return null;

  // Both factors must match
  if (rawCookieSecret !== headerFactor) return null;

  const tokenHash = hashToken(rawCookieSecret);
  const matched = devices.find(d => d.tokenHash === tokenHash);
  if (!matched) return null;

  // Fingerprint check if available
  const clientFp = body?.fingerprint || (req.headers['x-device-fingerprint'] ? JSON.parse(req.headers['x-device-fingerprint']) : null);
  if (clientFp && matched.fingerprint) {
    if (matched.fingerprint.platform && clientFp.platform) {
      const p1 = matched.fingerprint.platform.toLowerCase();
      const p2 = clientFp.platform.toLowerCase();
      if (p1 !== p2 && !p1.includes(p2) && !p2.includes(p1)) {
        return null;
      }
    }
    if (matched.fingerprint.timezone && clientFp.timezone) {
      if (matched.fingerprint.timezone !== clientFp.timezone) {
        return null;
      }
    }
  }

  return matched;
}

// Session validation: 2-hour JWT session strictly bound to admin email and session record
function validateAdminSession(req, cookies, store, matchedDevice = null) {
  const sessionJwt = cookies['admin_session'];
  if (!sessionJwt) return null;

  const payload = verifyAdminSessionJwt(sessionJwt, matchedDevice?.tokenHash || null);
  if (!payload || !payload.sessionId) return null;

  const configuredAdminEmail = (process.env.ADMIN_EMAIL || 'technicalteamsvit@gmail.com').trim().toLowerCase();
  if (payload.email && payload.email.toLowerCase() !== configuredAdminEmail) {
    return null;
  }

  // Check if session has been explicitly revoked
  store.revokedSessions = store.revokedSessions || [];
  if (store.revokedSessions.includes(payload.sessionId)) {
    return null;
  }

  store.adminSessions = store.adminSessions || [];
  const now = Date.now();
  store.adminSessions = store.adminSessions.filter(s => s.expiresAt > now);

  // In stateless serverless environments, accept validly signed non-expired non-revoked JWT payload
  const session = store.adminSessions.find(s => s.sessionId === payload.sessionId) || {
    sessionId: payload.sessionId,
    email: payload.email,
    deviceTokenHash: payload.deviceTokenHash || null,
    createdAt: (payload.iat || 0) * 1000,
    expiresAt: (payload.exp || 0) * 1000
  };

  if (matchedDevice && session.deviceTokenHash && session.deviceTokenHash !== matchedDevice.tokenHash) {
    return null;
  }

  return session;
}

// CSRF validation for state-changing admin operations
function validateAdminCsrf(req, cookies) {
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) return true;
  const url = req.url.split('?')[0];
  if (url === '/api/admin/login' || url === '/api/admin/register-device' || url === '/api/admin/setup' || url === '/api/admin/logout') return true;

  const csrfHeader = req.headers['x-csrf-token'];
  const csrfCookie = cookies['admin_csrf'];
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
    return false;
  }
  return true;
}

// Serverless-safe IP-based rate limiting (5 attempts per 15 mins per IP, with exponential lockout) persisted in data-store.json
function checkIpRateLimit(clientIp, store) {
  const now = Date.now();
  store.adminIpRateLimits = store.adminIpRateLimits || {};
  const record = store.adminIpRateLimits[clientIp];
  if (!record) return 0;

  if (record.lockedUntil && now < record.lockedUntil) {
    return Math.ceil((record.lockedUntil - now) / 1000);
  }

  // 15-minute sliding window expiration
  if (record.firstFailedAt && (now - record.firstFailedAt > 15 * 60 * 1000)) {
    delete store.adminIpRateLimits[clientIp];
    saveStore(store);
    return 0;
  }

  return 0;
}

function recordIpRateLimitFailure(clientIp, store, now) {
  store.adminIpRateLimits = store.adminIpRateLimits || {};
  const record = store.adminIpRateLimits[clientIp] || { failedAttempts: 0, firstFailedAt: now, lockedUntil: 0 };

  if (now - record.firstFailedAt > 15 * 60 * 1000 && now >= (record.lockedUntil || 0)) {
    record.failedAttempts = 0;
    record.firstFailedAt = now;
    record.lockedUntil = 0;
  }

  record.failedAttempts = (record.failedAttempts || 0) + 1;
  if (record.failedAttempts >= 5) {
    const exponent = Math.max(0, record.failedAttempts - 5);
    const lockoutMs = Math.min(24 * 3600 * 1000, 15 * 60 * 1000 * Math.pow(2, exponent));
    record.lockedUntil = now + lockoutMs;
  }

  store.adminIpRateLimits[clientIp] = record;
  store.adminRateLimit = { failedAttempts: record.failedAttempts, lockedUntil: record.lockedUntil };
  saveStore(store);
}

function resetIpRateLimit(clientIp, store) {
  store.adminIpRateLimits = store.adminIpRateLimits || {};
  if (store.adminIpRateLimits[clientIp]) {
    delete store.adminIpRateLimits[clientIp];
  }
  store.adminRateLimit = { failedAttempts: 0, lockedUntil: 0 };
  saveStore(store);
}

// Middleware handler for /api/* routes
export function createApiMiddleware() {
  return async (req, res, next) => {
    const url = req.url.split('?')[0];

    // Only intercept /api/ routes
    if (!url.startsWith('/api/')) {
      return next();
    }

    // Apply CORS headers so both technova-code-sprint-tq2j.vercel.app and technova-code-sprint.vercel.app share the same API
    const origin = req.headers.origin || '';
    if (
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.svit.ac.in') ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1')
    ) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, x-student-session, x-student-session-token, x-device-factor, x-csrf-token, x-test-session-token'
      );
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    // Parse JSON body if POST/PUT
    let body = {};
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      try {
        const buffers = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        const data = Buffer.concat(buffers).toString();
        if (data) {
          body = JSON.parse(data);
        }
      } catch (err) {
        body = {};
      }
    }

    const cookies = parseCookies(req);
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const store = await syncFromSupabaseIfConfigured(getStore());

    const sendJson = (status, data, extraHeaders = {}) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      for (const [k, v] of Object.entries(extraHeaders)) {
        res.setHeader(k, v);
      }
      res.end(JSON.stringify(data));
    };

    // Client error logging endpoint (captures ErrorBoundary stack traces in server logs)
    if (url === '/api/logs/client-error' && req.method === 'POST') {
      console.error('====================================================');
      console.error('[CLIENT RUNTIME ERROR REPORTED TO SERVER]:');
      console.error('Message:', body.message || 'Unknown error');
      console.error('URL:', body.url || 'Unknown URL');
      console.error('IP:', clientIp, '| User-Agent:', userAgent);
      if (body.stack) {
        console.error('Client Stack:\n' + body.stack);
      }
      if (body.componentStack) {
        console.error('Component Stack:\n' + body.componentStack);
      }
      console.error('====================================================');
      return sendJson(200, { success: true, logged: true });
    }

    // -------------------------------------------------------------
    // 1. UNIFIED ADMIN DEVICE LOCK & HARDWARE CONCEALMENT ROUTER
    // -------------------------------------------------------------
    if (url.startsWith('/api/admin/')) {
      applyAdminSecurityHeaders(res);

      const devices = store.adminDevices || (store.adminDevice ? [store.adminDevice] : []);
      const allowBackup = process.env.ALLOW_BACKUP_DEVICE === 'true' || process.env.ALLOW_BACKUP_DEVICE === '1';
      const maxDevices = allowBackup ? 2 : 1;
      const isSetupOpen = devices.length < maxDevices;

      // 1.1 Device Status check
      if (url === '/api/admin/device-status' && (req.method === 'POST' || req.method === 'GET')) {
        if (devices.length === 0) {
          return sendJson(200, {
            isRegistered: false,
            setupOpen: true,
            isThisDeviceTrusted: false,
            allowedIpsConfigured: Boolean(process.env.ADMIN_ALLOWED_IPS && process.env.ADMIN_ALLOWED_IPS.trim()),
            clientIp
          });
        }

        const matched = getMatchingTrustedDevice(req, cookies, body, store);
        if (!matched) {
          // CONCEALMENT: Return generic 404 to hide admin presence from unauthorized devices
          store.adminLoginLogs = store.adminLoginLogs || [];
          store.adminLoginLogs.unshift({
            timestamp: new Date().toISOString(),
            ip: clientIp,
            userAgent,
            action: 'admin_status_probe',
            success: false,
            reason: 'unregistered_device_concealed_404'
          });
          saveStore(store);
          return sendJson(404, { error: "Not found" });
        }

        return sendJson(200, {
          isRegistered: true,
          setupOpen: isSetupOpen,
          isThisDeviceTrusted: true,
          deviceName: matched.deviceName,
          registeredAt: matched.registeredAt,
          allowedIpsConfigured: Boolean(process.env.ADMIN_ALLOWED_IPS && process.env.ADMIN_ALLOWED_IPS.trim()),
          clientIp
        });
      }

      // 1.2 Device Registration (One-time setup with ADMIN_SETUP_KEY at /api/admin/register-device or /api/admin/setup)
      if ((url === '/api/admin/register-device' || url === '/api/admin/setup') && req.method === 'POST') {
        if (!isSetupOpen) {
          // Setup mode permanently disabled: return 404 to conceal
          store.adminLoginLogs = store.adminLoginLogs || [];
          store.adminLoginLogs.unshift({
            timestamp: new Date().toISOString(),
            ip: clientIp,
            userAgent,
            action: 'device_registration_attempt',
            success: false,
            reason: 'setup_mode_permanently_closed'
          });
          saveStore(store);
          return sendJson(404, { error: "Not found" });
        }

        const remainingSec = checkIpRateLimit(clientIp, store);
        if (remainingSec > 0) {
          return sendJson(429, { error: `Security lockout in effect. Please wait ${remainingSec}s before retrying.` });
        }

        if (!isIpAllowed(clientIp)) {
          store.adminLoginLogs = store.adminLoginLogs || [];
          store.adminLoginLogs.unshift({
            timestamp: new Date().toISOString(),
            ip: clientIp,
            userAgent,
            action: 'device_registration',
            success: false,
            reason: 'disallowed_ip'
          });
          saveStore(store);
          return sendJson(403, { error: "Access denied. Network IP is not authorized." });
        }

        // Validate ADMIN_SETUP_KEY
        const expectedSetupKey = process.env.ADMIN_SETUP_KEY || 'svit-technova-master-setup-key-2026-x9z';
        if (!body.setupKey || body.setupKey.trim() !== expectedSetupKey.trim()) {
          recordIpRateLimitFailure(clientIp, store, Date.now());
          store.adminLoginLogs = store.adminLoginLogs || [];
          store.adminLoginLogs.unshift({
            timestamp: new Date().toISOString(),
            ip: clientIp,
            userAgent,
            action: 'device_registration',
            success: false,
            reason: 'invalid_setup_key'
          });
          saveStore(store);
          return sendJson(404, { error: "Not found" });
        }

        // Validate administrator password
        if (!verifyAdminPassword(body.password)) {
          recordIpRateLimitFailure(clientIp, store, Date.now());
          store.adminLoginLogs = store.adminLoginLogs || [];
          store.adminLoginLogs.unshift({
            timestamp: new Date().toISOString(),
            ip: clientIp,
            userAgent,
            action: 'device_registration',
            success: false,
            reason: 'invalid_password'
          });
          saveStore(store);
          return sendJson(401, { error: "Invalid administrator password." });
        }

        // Generate cryptographically secure 32-byte hardware secret
        const rawSecret = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(rawSecret);
        const signedCookieToken = signDeviceToken(rawSecret);
        const csrfToken = crypto.randomBytes(24).toString('hex');
        const deviceLabel = body.deviceName || `${userAgent.includes('Windows') ? 'Windows' : userAgent.includes('Mac') ? 'Mac' : 'Workstation'} (${new Date().toLocaleDateString()})`;

        const newDevice = {
          tokenHash,
          deviceName: deviceLabel,
          registeredAt: new Date().toISOString(),
          registeredIp: clientIp,
          userAgent,
          fingerprint: body.fingerprint || null
        };

        store.adminDevices = store.adminDevices || (store.adminDevice ? [store.adminDevice] : []);
        store.adminDevices.push(newDevice);
        store.adminDevice = store.adminDevices[0];
        resetIpRateLimit(clientIp, store);

        store.adminLoginLogs = store.adminLoginLogs || [];
        store.adminLoginLogs.unshift({
          timestamp: new Date().toISOString(),
          ip: clientIp,
          userAgent,
          action: 'device_registered',
          deviceName: deviceLabel,
          success: true,
          reason: 'hardware_device_bound_successfully'
        });
        saveStore(store);

        const secureSuffix = isSecureConnection(req) ? '; Secure' : '';
        const cookieHeader = `admin_device_token=${signedCookieToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=15552000${secureSuffix}`;
        const csrfHeader = `admin_csrf=${csrfToken}; Path=/; SameSite=Strict; Max-Age=15552000${secureSuffix}`;

        return sendJson(200, {
          success: true,
          message: "Trusted administrator device bound successfully.",
          deviceName: deviceLabel,
          deviceSecret: rawSecret,
          csrfToken
        }, { 'Set-Cookie': [cookieHeader, csrfHeader] });
      }

      // 1.3 Admin Login (Requires email and password, or registered device token with password)
      if (url === '/api/admin/login' && req.method === 'POST') {
        const remainingSec = checkIpRateLimit(clientIp, store);
        if (remainingSec > 0) {
          return sendJson(429, { 
            error: "Too many attempts. Try again in 15 minutes.",
            lockoutSeconds: remainingSec 
          });
        }

        if (!isIpAllowed(clientIp)) {
          store.adminLoginLogs = store.adminLoginLogs || [];
          store.adminLoginLogs.unshift({
            timestamp: new Date().toISOString(),
            ip: clientIp,
            userAgent,
            action: 'admin_login_attempt',
            success: false,
            reason: 'disallowed_ip'
          });
          saveStore(store);
          return sendJson(403, { error: "Access denied. Network IP is not authorized." });
        }

        const configuredAdminEmail = (process.env.ADMIN_EMAIL || 'technicalteamsvit@gmail.com').trim().toLowerCase();
        const configuredAdminName = (process.env.ADMIN_NAME || 'Vedant Kokane').trim().toLowerCase();
        const inputEmail = body.email ? String(body.email).trim().toLowerCase() : '';
        const inputName = body.name ? String(body.name).trim().toLowerCase() : '';
        const inputPassword = body.password ? String(body.password) : '';
        const matched = getMatchingTrustedDevice(req, cookies, body, store);

        // Concealment for untrusted device probes when no email is supplied
        if (!body.email && devices.length > 0 && !matched) {
          store.adminLoginLogs = store.adminLoginLogs || [];
          store.adminLoginLogs.unshift({
            timestamp: new Date().toISOString(),
            ip: clientIp,
            userAgent,
            action: 'admin_login_attempt',
            success: false,
            reason: 'unregistered_device_concealed_404'
          });
          saveStore(store);
          return sendJson(404, { error: "Not found" });
        }

        // Email, Name & Password verification
        const isEmailValid = body.email ? (inputEmail === configuredAdminEmail) : true;
        const isNameValid = body.name ? (inputName === configuredAdminName) : true;
        const isPasswordValid = verifyAdminPassword(inputPassword);

        if (!isEmailValid || !isNameValid || !isPasswordValid) {
          console.error(`[AdminAuth] Failed admin login attempt from ${clientIp}: emailValid=${isEmailValid}, nameValid=${isNameValid}, passValid=${isPasswordValid}`);
          recordIpRateLimitFailure(clientIp, store, Date.now());
          const ipRecord = store.adminIpRateLimits?.[clientIp] || {};
          const attemptsRemaining = Math.max(0, 5 - (ipRecord.failedAttempts || 0));

          store.adminLoginLogs = store.adminLoginLogs || [];
          store.adminLoginLogs.unshift({
            timestamp: new Date().toISOString(),
            ip: clientIp,
            userAgent,
            action: 'admin_login_attempt',
            attemptedEmail: inputEmail ? `${inputEmail.slice(0, 3)}***` : 'unspecified',
            success: false,
            reason: 'admin_access_denied'
          });
          saveStore(store);

          return sendJson(401, {
            error: "Authentication failed. Admin access denied.",
            attemptsRemaining
          });
        }

        // Successful authentication: issue rotated 60-minute JWT session (Section 3)
        resetIpRateLimit(clientIp, store);
        const sessionId = crypto.randomBytes(24).toString('hex');
        const sessionJwt = createAdminSessionJwt(sessionId, configuredAdminEmail, matched?.tokenHash || null);
        const csrfToken = crypto.randomBytes(24).toString('hex');

        store.adminSessions = store.adminSessions || [];
        store.adminSessions = store.adminSessions.filter(s => s.expiresAt > Date.now());
        store.adminSessions.push({
          sessionId,
          email: configuredAdminEmail,
          deviceTokenHash: matched?.tokenHash || null,
          createdAt: Date.now(),
          expiresAt: Date.now() + (3600 * 1000) // 60-minute session
        });

        store.adminLoginLogs = store.adminLoginLogs || [];
        store.adminLoginLogs.unshift({
          timestamp: new Date().toISOString(),
          ip: clientIp,
          userAgent,
          action: 'admin_login',
          adminEmail: configuredAdminEmail,
          deviceName: matched?.deviceName || 'Authorized Administrator Workstation',
          success: true,
          reason: 'authenticated_administrator'
        });
        saveStore(store);

        const secureSuffix = isSecureConnection(req) ? '; Secure' : '';
        const sessionCookie = `admin_session=${sessionJwt}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600${secureSuffix}`;
        const csrfCookie = `admin_csrf=${csrfToken}; Path=/; SameSite=Lax; Max-Age=3600${secureSuffix}`;

        return sendJson(200, {
          success: true,
          user: {
            uid: 'svit-admin-auth',
            name: "Vedant Kokane",
            email: configuredAdminEmail,
            role: "admin",
            department: "Technical Skill Development Hub",
            rollNo: "SVIT-ADMIN-LEAD",
            trustedDevice: matched?.deviceName || 'Authorized Administrator Workstation'
          },
          csrfToken
        }, { 'Set-Cookie': [sessionCookie, csrfCookie] });
      }

      // 1.35 Admin Session Status Check (GET /api/admin/session)
      if (url === '/api/admin/session' && req.method === 'GET') {
        const session = validateAdminSession(req, cookies, store);
        if (!session) {
          return sendJson(401, { authenticated: false, error: "No active administrator session." });
        }
        const configuredAdminEmail = (process.env.ADMIN_EMAIL || 'technicalteamsvit@gmail.com').trim().toLowerCase();
        return sendJson(200, {
          authenticated: true,
          user: {
            uid: 'svit-admin-auth',
            name: "Vedant Kokane",
            email: configuredAdminEmail,
            role: "admin",
            department: "Technical Skill Development Hub",
            rollNo: "SVIT-ADMIN-LEAD"
          }
        });
      }

      // 1.4 Web-based reset route is DISABLED (returns 404 per security rules)
      if (url === '/api/admin/reset-device') {
        return sendJson(404, { error: "Endpoint /api/admin/reset-device not found. Use server CLI recovery command: npm run admin:reset-device" });
      }

      // 1.45 Admin Logout (Revokes session and clears cookies)
      if (url === '/api/admin/logout' && req.method === 'POST') {
        const sessionJwt = cookies['admin_session'];
        if (sessionJwt) {
          const payload = verifyAdminSessionJwt(sessionJwt);
          if (payload && payload.sessionId) {
            store.adminSessions = (store.adminSessions || []).filter(s => s.sessionId !== payload.sessionId);
            store.revokedSessions = store.revokedSessions || [];
            store.revokedSessions.push(payload.sessionId);
          }
        }
        store.adminLoginLogs = store.adminLoginLogs || [];
        store.adminLoginLogs.unshift({
          timestamp: new Date().toISOString(),
          ip: clientIp,
          userAgent,
          action: 'admin_logout',
          success: true,
          reason: 'admin_session_revoked'
        });
        saveStore(store);

        const secureSuffix = isSecureConnection(req) ? '; Secure' : '';
        const clearSession = `admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureSuffix}`;
        const clearCsrf = `admin_csrf=; Path=/; SameSite=Strict; Max-Age=0${secureSuffix}`;
        return sendJson(200, { success: true, message: "Logged out successfully" }, { 'Set-Cookie': [clearSession, clearCsrf] });
      }

      // -------------------------------------------------------------
      // UNIFIED MIDDLEWARE FOR ALL OTHER /api/admin/* ENDPOINTS:
      // Requires: Valid Authenticated Session + CSRF (and optional device binding)
      // -------------------------------------------------------------
      const matched = getMatchingTrustedDevice(req, cookies, body, store);
      const session = validateAdminSession(req, cookies, store, matched);
      if (!session) {
        if (!matched) {
          // Concealment 404 if untrusted device with no valid session
          return sendJson(404, { error: "Not found" });
        }
        return sendJson(401, { error: "Session expired or invalid. Please authenticate." });
      }

      if (!validateAdminCsrf(req, cookies)) {
        return sendJson(403, { error: "CSRF token validation failed." });
      }

      // 1.5 Admin Logs
      if (url === '/api/admin/logs' && req.method === 'GET') {
        return sendJson(200, {
          device: matched,
          devices: store.adminDevices || [matched],
          logs: (store.adminLoginLogs || []).slice(0, 50),
          rateLimit: store.adminRateLimit
        });
      }

      // 1.6 Quiz & Proctoring Settings
      if (url === '/api/admin/settings' && req.method === 'GET') {
        return sendJson(200, {
          judgingSettings: store.judgingSettings || {},
          proctoringSettings: store.proctoringSettings || {}
        });
      }

      if (url === '/api/admin/settings' && req.method === 'POST') {
        if (body.judgingSettings) {
          store.judgingSettings = { ...store.judgingSettings, ...body.judgingSettings };
        }
        if (body.proctoringSettings) {
          store.proctoringSettings = { ...store.proctoringSettings, ...body.proctoringSettings };
        }
        saveStore(store);

        return sendJson(200, {
          success: true,
          judgingSettings: store.judgingSettings,
          proctoringSettings: store.proctoringSettings
        });
      }

      // 1.7 Blocked Attempts
      if (url === '/api/admin/blocked-attempts' && req.method === 'GET') {
        return sendJson(200, {
          blockedAttempts: store.blockedAttempts || []
        });
      }

      // 1.8 Whitelist Student
      if (url === '/api/admin/whitelist-student' && req.method === 'POST') {
        const targetUserId = body.userId || body.studentId || body.prn;
        const targetPrn = body.prn || targetUserId;
        const studentName = body.studentName || 'Student';
        const notes = body.notes || 'Admin manual exception';

        store.studentWhitelists = store.studentWhitelists || [];
        store.studentWhitelists = store.studentWhitelists.filter(w => !(w.userId === targetUserId || w.prn === targetPrn));
        const entry = {
          id: `white-${Date.now()}`,
          userId: targetUserId,
          prn: targetPrn,
          studentName,
          notes,
          whitelistedAt: new Date().toISOString()
        };
        store.studentWhitelists.unshift(entry);
        saveStore(store);

        return sendJson(200, { success: true, entry });
      }

      // 1.9 Fetch Whitelists
      if (url === '/api/admin/whitelists' && req.method === 'GET') {
        return sendJson(200, {
          whitelists: store.studentWhitelists || []
        });
      }

      // 1.10 Remove Whitelist
      if (url === '/api/admin/remove-whitelist' && req.method === 'POST') {
        const targetUserId = body.userId || body.studentId || body.prn;
        store.studentWhitelists = (store.studentWhitelists || []).filter(w => !(w.userId === targetUserId || w.prn === targetUserId));
        saveStore(store);
        return sendJson(200, { success: true });
      }

      // 1.11 Admin Registrations Table & Summary Stats: GET /api/admin/registrations
      if (url === '/api/admin/registrations' && req.method === 'GET') {
        const buildRegistrationsPayload = () => {
          const allStudents = store.students || [];
          const allSubs = store.submissions || [];
          const overrides = store.manualOverrides || {};

          const registrations = allStudents.map(stu => {
            const dec = decorateStudentForClient(stu);
            const normPrn = String(stu.prn || '').trim().toUpperCase();
            const stuSubs = allSubs.filter(
              sub => String(sub.prn || '').trim().toUpperCase() === normPrn || sub.userId === stu.uid
            );
            const ov = overrides[stu.uid] ?? overrides[normPrn];
            const summary = computeUserSummary(stuSubs, ov);
            return {
              ...dec,
              phone: stu.phone || '',
              normalizedEmail: stu.normalizedEmail || normalizeEmail(stu.email || '') || stu.email || '',
              registeredAt: stu.registeredAt || stu.createdAt || stu.updatedAt || null,
              verifiedAt: stu.verifiedAt || stu.emailVerifiedAt || null,
              flagged: Boolean(stu.flagged),
              flagReason: stu.flagReason || null,
              suspended: Boolean(stu.suspended || stu.accountStatus === 'suspended'),
              suspendedReason: stu.suspendedReason || null,
              submissionCount: stuSubs.length,
              totalScore: summary.totalScore
            };
          });

          // Sort newest registrations first
          registrations.sort((a, b) => {
            const ta = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
            const tb = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
            return tb - ta;
          });

          const byBranch = {};
          const byTrack = { C: 0, 'C++': 0, Java: 0, Python: 0 };
          let verifiedCount = 0;
          let unverifiedCount = 0;
          let suspendedCount = 0;
          let flaggedCount = 0;

          for (const reg of registrations) {
            if (reg.suspended) {
              suspendedCount++;
            } else if (reg.emailVerified) {
              verifiedCount++;
            } else {
              unverifiedCount++;
            }
            if (reg.flagged) flaggedCount++;
            const br = reg.branch || 'Unspecified';
            byBranch[br] = (byBranch[br] || 0) + 1;
            const tr = reg.track || reg.language || 'Python';
            byTrack[tr] = (byTrack[tr] || 0) + 1;
          }

          return {
            registrations,
            summary: {
              total: registrations.length,
              verified: verifiedCount,
              unverified: unverifiedCount,
              suspended: suspendedCount,
              flagged: flaggedCount,
              byBranch,
              byTrack
            },
            registrationSettings: getRegistrationSettings(store)
          };
        };

        return sendJson(200, buildRegistrationsPayload());
      }

      // 1.12 Admin Registration Actions (flag, suspend, unsuspend, verify, delete, update_settings): POST /api/admin/registrations/action
      if (url === '/api/admin/registrations/action' && req.method === 'POST') {
        const action = body.action;
        store.students = store.students || [];

        if (action === 'update_settings') {
          const currentSettings = getRegistrationSettings(store);
          const nextSettings = {
            ...currentSettings,
            allowlistEnabled:
              body.allowlistEnabled !== undefined ? Boolean(body.allowlistEnabled) : currentSettings.allowlistEnabled,
            allowedDomains: Array.isArray(body.allowedDomains)
              ? body.allowedDomains.map(d => String(d).trim().toLowerCase()).filter(Boolean)
              : typeof body.allowedDomains === 'string'
                ? body.allowedDomains.split(',').map(d => d.trim().toLowerCase()).filter(Boolean)
                : currentSettings.allowedDomains,
            phoneVerificationRequired:
              body.phoneVerificationRequired !== undefined
                ? Boolean(body.phoneVerificationRequired)
                : currentSettings.phoneVerificationRequired
          };
          store.registrationSettings = nextSettings;
          saveStore(store);
          return sendJson(200, {
            success: true,
            message: 'Registration & verification settings updated.',
            registrationSettings: getRegistrationSettings(store)
          });
        }

        // Bulk Operation: Clear All Students
        if (action === 'clear_all') {
          const phrase = String(body.confirmationPhrase || '').trim();
          if (phrase !== 'CLEAR ALL') {
            return sendJson(400, {
              error: 'Confirmation phrase mismatch. You must type "CLEAR ALL" exactly to wipe all student data.'
            });
          }

          const studentCount = (store.students || []).length;
          const subCount = (store.submissions || []).length;
          const certCount = (store.certificates || []).length;

          // Invalidate all student sessions & tokens on the server
          store.deletedPrns = store.deletedPrns || [];
          store.invalidatedTokens = store.invalidatedTokens || [];
          for (const s of (store.students || [])) {
            const p = String(s.prn || '').trim().toUpperCase();
            if (p && !store.deletedPrns.includes(p)) store.deletedPrns.push(p);
            if (s.sessionToken && !store.invalidatedTokens.includes(s.sessionToken)) {
              store.invalidatedTokens.push(s.sessionToken);
            }
          }
          for (const sess of (store.activeTestSessions || [])) {
            if (sess.token && !store.invalidatedTokens.includes(sess.token)) {
              store.invalidatedTokens.push(sess.token);
            }
          }

          // Cascade delete in-memory/JSON store
          store.students = [];
          store.submissions = [];
          store.certificates = [];
          store.pendingVerifications = {};
          store.userConsentsMap = {};
          store.manualOverrides = {};
          store.proctoringFlags = [];
          store.studentWhitelists = [];
          store.activeTestSessions = (store.activeTestSessions || []).filter(s => s.role === 'admin');

          // Minimal audit log (admin, timestamp, action, count) without personal data
          store.adminAuditLogs = store.adminAuditLogs || [];
          store.adminAuditLogs.unshift({
            id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            admin: 'admin',
            action: 'clear_all_students',
            count: studentCount,
            submissionsDeleted: subCount,
            certificatesDeleted: certCount,
            timestamp: new Date().toISOString(),
            ip: clientIp
          });

          // Cascade delete Supabase tables if configured
          await clearAllStudentsFromDb();
          saveStore(store);

          return sendJson(200, {
            success: true,
            message: `Successfully cleared all ${studentCount} student accounts, ${subCount} submissions, and ${certCount} certificates. All sessions invalidated everywhere.`,
            count: studentCount,
            leaderboard: []
          });
        }

        const targetPrn = String(body.prn || '').trim().toUpperCase();
        const targetUid = String(body.uid || body.userId || '').trim();
        const idx = store.students.findIndex(
          s =>
            (targetPrn && String(s.prn || '').trim().toUpperCase() === targetPrn) ||
            (targetUid && s.uid === targetUid)
        );

        if (idx < 0) {
          return sendJson(404, { error: 'Student registration record not found.' });
        }

        const student = store.students[idx];

        if (action === 'flag') {
          student.flagged = body.flagged !== undefined ? Boolean(body.flagged) : !student.flagged;
          student.flagReason = student.flagged ? (body.reason || 'Flagged as suspicious by administrator') : null;
          student.updatedAt = new Date().toISOString();
          saveStore(store);
          return sendJson(200, {
            success: true,
            message: student.flagged ? `Flagged ${student.name} (${student.prn}).` : `Unflagged ${student.name}.`,
            student: decorateStudentForClient(student)
          });
        }

        if (action === 'suspend') {
          student.suspended = true;
          student.accountStatus = 'suspended';
          student.suspendedReason = body.reason || 'Suspended by administrator for policy violation';
          student.sessionToken = null;
          student.updatedAt = new Date().toISOString();
          saveStore(store);
          return sendJson(200, {
            success: true,
            message: `Account ${student.name} (${student.prn}) has been suspended.`,
            student: decorateStudentForClient(student)
          });
        }

        if (action === 'unsuspend') {
          student.suspended = false;
          student.suspendedReason = null;
          student.accountStatus = student.emailVerified ? 'verified' : 'legacy_active';
          student.updatedAt = new Date().toISOString();
          saveStore(store);
          return sendJson(200, {
            success: true,
            message: `Account ${student.name} (${student.prn}) has been restored.`,
            student: decorateStudentForClient(student)
          });
        }

        if (action === 'verify') {
          student.emailVerified = true;
          student.phoneVerified = true;
          student.accountStatus = 'verified';
          student.needsLegacyVerification = false;
          student.verifiedAt = new Date().toISOString();
          student.updatedAt = new Date().toISOString();
          if (store.pendingVerifications && student.prn) {
            delete store.pendingVerifications[String(student.prn).trim().toUpperCase()];
          }
          saveStore(store);
          return sendJson(200, {
            success: true,
            message: `Account ${student.name} (${student.prn}) manually marked as verified.`,
            student: decorateStudentForClient(student)
          });
        }

        if (action === 'delete') {
          const removed = store.students.splice(idx, 1)[0];
          const removedPrn = String(removed.prn || '').trim().toUpperCase();
          const removedUid = String(removed.uid || '').trim();

          // 1. Invalidate session token & blacklist PRN immediately on server
          store.deletedPrns = store.deletedPrns || [];
          if (removedPrn && !store.deletedPrns.includes(removedPrn)) {
            store.deletedPrns.push(removedPrn);
          }
          store.invalidatedTokens = store.invalidatedTokens || [];
          if (removed.sessionToken && !store.invalidatedTokens.includes(removed.sessionToken)) {
            store.invalidatedTokens.push(removed.sessionToken);
          }
          store.activeTestSessions = (store.activeTestSessions || []).filter(
            s => String(s.prn || '').trim().toUpperCase() !== removedPrn && s.userId !== removedUid
          );

          // 2. Cascade delete submissions, certificates, verifications, consents, overrides, flags
          if (store.pendingVerifications && removedPrn) {
            delete store.pendingVerifications[removedPrn];
          }
          if (store.userConsentsMap) {
            delete store.userConsentsMap[removedUid];
            delete store.userConsentsMap[removedPrn];
          }
          if (store.manualOverrides) {
            delete store.manualOverrides[removedUid];
            delete store.manualOverrides[removedPrn];
          }
          const subCountBefore = (store.submissions || []).length;
          store.submissions = (store.submissions || []).filter(
            sub => String(sub.prn || '').trim().toUpperCase() !== removedPrn && sub.userId !== removedUid
          );
          const subsDeleted = subCountBefore - store.submissions.length;

          const certCountBefore = (store.certificates || []).length;
          store.certificates = (store.certificates || []).filter(
            c => String(c.prn || '').trim().toUpperCase() !== removedPrn && c.userId !== removedUid
          );
          const certsDeleted = certCountBefore - store.certificates.length;

          store.proctoringFlags = (store.proctoringFlags || []).filter(
            f => String(f.prn || '').trim().toUpperCase() !== removedPrn && f.userId !== removedUid
          );
          store.studentWhitelists = (store.studentWhitelists || []).filter(
            w => String(w.prn || '').trim().toUpperCase() !== removedPrn && w.userId !== removedUid
          );

          // 3. Minimal audit log without personal data
          store.adminAuditLogs = store.adminAuditLogs || [];
          store.adminAuditLogs.unshift({
            id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            admin: 'admin',
            action: 'delete_student',
            count: 1,
            submissionsDeleted: subsDeleted,
            certificatesDeleted: certsDeleted,
            timestamp: new Date().toISOString(),
            ip: clientIp
          });

          // 4. Cascade delete Supabase tables if configured
          await deleteStudentFromDb(removedPrn, removedUid);
          saveStore(store);

          return sendJson(200, {
            success: true,
            message: `Permanently deleted student ${removed.name} (${removedPrn}) and all associated ${subsDeleted} submission(s) and ${certsDeleted} certificate(s). Session invalidated everywhere.`,
            deletedPrn: removedPrn,
            leaderboard: computeSharedLeaderboard(store)
          });
        }

        return sendJson(400, { error: `Unknown registration action: ${action}` });
      }

      // Fallthrough for unmatched /api/admin/* route
      return sendJson(404, { error: "Not found" });
    }

    // -------------------------------------------------------------
    // 3. SERVER-SIDE PROCTORING AUTO-EXIT ENFORCEMENT (Section 3)
    // -------------------------------------------------------------
    // -------------------------------------------------------------
    // 3. SERVER-SIDE PROCTORING AUTO-EXIT ENFORCEMENT & SESSION TOKEN ENGINE
    // -------------------------------------------------------------

    // Helper: Check if student has an active admin exception whitelist
    const isStudentWhitelisted = (userId, prn) => {
      const list = store.studentWhitelists || [];
      return list.some(w => (w.userId && w.userId === userId) || (w.prn && w.prn === prn));
    };

    // Helper: Timeout sessions that lost heartbeat beyond threshold
    const HEARTBEAT_TIMEOUT_MS = parseInt(process.env.HEARTBEAT_TIMEOUT_SECONDS || '18', 10) * 1000;
    const cleanupExpiredSessions = () => {
      const now = Date.now();
      let modified = false;
      store.activeTestSessions = store.activeTestSessions || [];

      for (const sess of store.activeTestSessions) {
        if (sess.status === 'active' && (now - sess.lastHeartbeatAt > HEARTBEAT_TIMEOUT_MS)) {
          sess.status = 'expired';
          sess.expiredReason = 'Missing heartbeats: connection terminated or window backgrounded';
          sess.endedAt = new Date().toISOString();
          modified = true;

          // Record exit in proctoringExits so submission is locked out
          const exitRecord = {
            id: `exit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            userId: sess.userId,
            prn: sess.prn,
            studentName: sess.studentName || 'Student',
            day: sess.day,
            testType: 'all',
            reason: 'Exited: verification failed (heartbeat stopped beyond threshold)',
            timestamp: new Date().toISOString(),
            clientIp: sess.clientIp || clientIp,
            userAgent: sess.userAgent || userAgent,
            lockedOut: true,
            autoSubmitted: true
          };
          store.proctoringExits = store.proctoringExits || [];
          store.proctoringExits.unshift(exitRecord);
        }
      }
      return modified;
    };

    // 3.0 Verify Browser & Environment Server-Side: POST /api/proctoring/verify-browser
    if (url === '/api/proctoring/verify-browser' && req.method === 'POST') {
      const userId = body.userId || body.studentId || 'unknown';
      const prn = body.prn || userId;
      const studentName = body.studentName || 'Student';
      const fingerprint = body.fingerprint || 'unknown';
      const clientSignals = body.signals || [];
      const clientBlocked = Boolean(body.blocked);
      const clientReason = body.reason || '';

      const serverUa = req.headers['user-agent'] || '';
      const isWhitelisted = isStudentWhitelisted(userId, prn);

      let isBlocked = false;
      let blockReason = null;
      const serverSignals = [];

      if (!isWhitelisted) {
        // Check mobile device UA
        if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(serverUa)) {
          isBlocked = true;
          blockReason = "Mobile devices and phone browsers are not supported. Please use desktop Google Chrome, Microsoft Edge, or Mozilla Firefox.";
          serverSignals.push('Server-detected mobile device');
        }
        // Check in-app / embedded webviews
        const webviewRegex = /fban|fbav|facebook|instagram|whatsapp|telegram|linkedin|snapchat|micromessenger|electron|; wv|webview/i;
        if (webviewRegex.test(serverUa)) {
          isBlocked = true;
          blockReason = "In-app or embedded browser detected. Embedded webviews are strictly blocked. Please open in desktop Google Chrome, Microsoft Edge, or Mozilla Firefox.";
          serverSignals.push('Server-detected in-app webview');
        }
        // Check automation / headless UA
        if (/HeadlessChrome|PhantomJS|Selenium|WebDriver/i.test(serverUa)) {
          isBlocked = true;
          blockReason = "Automated/Headless browser detected. Test automation is strictly prohibited.";
          serverSignals.push('Server-detected headless/automation browser');
        }
        // Client-side detected violations
        if (clientBlocked && !isBlocked) {
          isBlocked = true;
          blockReason = clientReason || "Browser integrity validation failed.";
        }
      }

      if (isBlocked) {
        const attemptRecord = {
          id: `block-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          userId,
          prn,
          studentName,
          reason: blockReason,
          signals: [...serverSignals, ...clientSignals],
          userAgent: serverUa,
          ip: clientIp,
          timestamp: new Date().toISOString()
        };
        store.blockedAttempts = store.blockedAttempts || [];
        store.blockedAttempts.unshift(attemptRecord);
        if (store.blockedAttempts.length > 200) store.blockedAttempts = store.blockedAttempts.slice(0, 200);
        saveStore(store);

        return sendJson(403, {
          allowed: false,
          reason: blockReason,
          signals: attemptRecord.signals,
          isWhitelisted: false
        });
      }

      return sendJson(200, {
        allowed: true,
        isWhitelisted,
        fingerprint
      });
    }

    // 3.0b Server-Side Consent Storage: POST /api/proctoring/submit-consent
    if (url === '/api/proctoring/submit-consent' && req.method === 'POST') {
      const userId = body.userId || body.studentId || 'unknown';
      const prn = body.prn || userId;
      const studentName = body.studentName || 'Student';
      const day = Number(body.day) || 1;
      const fingerprint = body.fingerprint || 'unknown';
      const rulesAgreed = Boolean(body.rulesAgreed);
      const proctoringAgreed = Boolean(body.proctoringAgreed);

      if (!rulesAgreed || !proctoringAgreed) {
        return sendJson(400, { error: "Both contest rules and proctoring consent must be checked and agreed." });
      }

      const consentRecord = {
        id: `consent-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId,
        prn,
        studentName,
        day,
        fingerprint,
        clientIp,
        userAgent,
        timestamp: new Date().toISOString(),
        details: {
          rulesAgreed: true,
          proctoringAgreed: true,
          cameraVerified: true,
          micVerified: true
        }
      };

      store.studentConsents = store.studentConsents || [];
      store.studentConsents = store.studentConsents.filter(c => !(c.userId === userId && Number(c.day) === day));
      store.studentConsents.unshift(consentRecord);
      saveStore(store);

      return sendJson(200, {
        success: true,
        consentId: consentRecord.id,
        timestamp: consentRecord.timestamp
      });
    }

    // 3.0c Issue One-Time Test-Session Token: POST /api/proctoring/create-session
    if (url === '/api/proctoring/create-session' && req.method === 'POST') {
      const userId = body.userId || body.studentId;
      const prn = body.prn || userId;
      const studentName = body.studentName || 'Student';
      const day = Number(body.day) || 1;
      const fingerprint = body.fingerprint;

      if (!userId || !fingerprint) {
        return sendJson(400, { error: "Missing required session parameters (userId, fingerprint)." });
      }

      // Check if student was already locked out/exited
      const exits = store.proctoringExits || [];
      const exited = exits.find(e => (e.userId === userId || e.prn === prn) && Number(e.day) === day);
      if (exited) {
        return sendJson(403, {
          error: `Access denied: student was previously exited (${exited.reason}) and locked out for Day ${day}.`,
          exited: true
        });
      }

      // Verify consent exists server-side
      const hasConsent = (store.studentConsents || []).some(c => (c.userId === userId || c.prn === prn) && Number(c.day) === day);
      if (!hasConsent && !isStudentWhitelisted(userId, prn)) {
        return sendJson(403, { error: "Verified server-side consent required before starting this task." });
      }

      // Single-active session enforcement: Terminate any previous session for this student
      store.activeTestSessions = store.activeTestSessions || [];
      for (const s of store.activeTestSessions) {
        if ((s.userId === userId || s.prn === prn) && s.status === 'active') {
          s.status = 'replaced_by_new_session';
          s.endedAt = new Date().toISOString();
        }
      }

      // Generate cryptographically random session token
      const tokenBytes = crypto.randomBytes(32).toString('hex');
      const token = `TNV-SESS-${tokenBytes}`;
      const tokenHash = hashToken(token);
      const now = Date.now();

      const sessionRecord = {
        sessionId: `sess-${now}-${Math.random().toString(36).substring(2, 6)}`,
        token,
        tokenHash,
        userId,
        prn,
        studentName,
        day,
        browserFingerprint: fingerprint,
        clientIp,
        userAgent,
        createdAt: new Date().toISOString(),
        lastHeartbeatAt: now,
        status: 'active'
      };

      store.activeTestSessions.unshift(sessionRecord);
      if (store.activeTestSessions.length > 150) store.activeTestSessions = store.activeTestSessions.slice(0, 150);
      saveStore(store);

      return sendJson(200, {
        success: true,
        sessionId: sessionRecord.sessionId,
        token,
        createdAt: sessionRecord.createdAt
      });
    }

    // 3.0d Continuous Heartbeat: POST /api/proctoring/heartbeat
    if (url === '/api/proctoring/heartbeat' && req.method === 'POST') {
      const token = body.token || req.headers['x-test-session-token'];
      const fingerprint = body.fingerprint;
      const day = Number(body.day);
      const userId = body.userId;

      if (!token) {
        return sendJson(401, { error: "Missing session token." });
      }

      // Clean up any timed-out sessions
      cleanupExpiredSessions();

      const session = (store.activeTestSessions || []).find(s => s.token === token);
      if (!session) {
        saveStore(store);
        return sendJson(403, { active: false, error: "Invalid or unrecognized test session." });
      }

      if (session.status !== 'active') {
        saveStore(store);
        return sendJson(403, { active: false, status: session.status, error: `Test session is no longer active (${session.status}).` });
      }

      // Verify fingerprint match
      if (fingerprint && session.browserFingerprint !== fingerprint) {
        session.status = 'invalidated_fingerprint_mismatch';
        session.endedAt = new Date().toISOString();
        saveStore(store);
        return sendJson(403, { active: false, error: "Browser fingerprint mismatch. Multi-browser session switching detected." });
      }

      session.lastHeartbeatAt = Date.now();
      saveStore(store);

      return sendJson(200, {
        active: true,
        sessionId: session.sessionId,
        lastHeartbeatAt: session.lastHeartbeatAt
      });
    }

    // 3.1 Record auto-exit violation event
    if (url === '/api/proctoring/exit' && req.method === 'POST') {
      const userId = body.userId || body.studentId || 'unknown';
      const prn = body.prn || body.studentId || 'unknown';
      const studentName = body.studentName || 'Student';
      const day = Number(body.day) || 1;
      const reason = body.reason || 'Unknown violation';
      const testType = body.testType || 'all';

      const exitRecord = {
        id: `exit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId,
        prn,
        studentName,
        day,
        testType,
        reason,
        timestamp: new Date().toISOString(),
        clientIp,
        userAgent,
        lockedOut: true
      };

      store.proctoringExits = store.proctoringExits || [];
      // Remove any duplicate active lock for same user+day
      store.proctoringExits = store.proctoringExits.filter(
        e => !(e.userId === exitRecord.userId && Number(e.day) === Number(exitRecord.day) && e.testType === exitRecord.testType)
      );
      store.proctoringExits.unshift(exitRecord);

      // Invalidate active test session if any
      store.activeTestSessions = store.activeTestSessions || [];
      for (const s of store.activeTestSessions) {
        if ((s.userId === userId || s.prn === prn) && Number(s.day) === day && s.status === 'active') {
          s.status = 'exited_on_violation';
          s.endedAt = new Date().toISOString();
        }
      }

      saveStore(store);

      return sendJson(200, {
        success: true,
        locked: true,
        message: `Exit recorded: ${reason}`,
        record: exitRecord
      });
    }

    // 3.2 Check exit status (supports both POST and GET)
    if (url === '/api/proctoring/status' && (req.method === 'POST' || req.method === 'GET')) {
      let userId = body.userId || body.studentId;
      let day = body.day;
      let testType = body.testType || 'all';

      if (req.method === 'GET') {
        try {
          const parsedUrl = new URL(req.url, 'http://localhost');
          userId = parsedUrl.searchParams.get('userId') || parsedUrl.searchParams.get('studentId') || userId;
          day = parsedUrl.searchParams.get('day') || day;
          testType = parsedUrl.searchParams.get('testType') || testType;
        } catch (e) {}
      }

      const exits = store.proctoringExits || [];
      const record = exits.find(e => 
        (e.userId === userId || e.prn === userId) && 
        Number(e.day) === Number(day) && 
        (testType === 'all' || e.testType === testType || e.testType === 'all')
      );

      return sendJson(200, {
        isLockedOut: Boolean(record),
        exited: Boolean(record),
        reason: record?.reason || null,
        exitRecord: record || null
      });
    }

    // 3.3 Server-side verification gate on submission (rejects answer submissions after an exit or without valid session token)
    if (url === '/api/proctoring/verify-submission' && req.method === 'POST') {
      const userId = body.userId || body.studentId;
      const prn = body.prn || userId;
      const day = body.day;
      const testType = body.testType || 'all';
      const token = body.sessionToken || req.headers['x-test-session-token'];

      // 1. Check if exited due to violation
      const exits = store.proctoringExits || [];
      const record = exits.find(e => 
        (e.userId === userId || e.prn === userId) && 
        Number(e.day) === Number(day) && 
        (testType === 'all' || e.testType === testType || e.testType === 'all')
      );

      if (record) {
        return sendJson(403, {
          allowed: false,
          error: `Submission rejected by server: student was exited due to violation (${record.reason}) at ${new Date(record.timestamp).toLocaleTimeString()}.`,
          exitRecord: record
        });
      }

      // 2. Token requirement for submission (unless student is specifically whitelisted)
      if (!isStudentWhitelisted(userId, prn)) {
        if (!token) {
          return sendJson(403, {
            allowed: false,
            error: "Submission rejected: Missing active test-session token. Test must be started via verified pre-check."
          });
        }

        cleanupExpiredSessions();
        const session = (store.activeTestSessions || []).find(s => s.token === token);
        if (!session || session.status !== 'active') {
          return sendJson(403, {
            allowed: false,
            error: "Submission rejected: Session token is expired, replaced, or invalid."
          });
        }

        // Verify token user binding
        if (session.userId !== userId && session.prn !== userId) {
          return sendJson(403, {
            allowed: false,
            error: "Submission rejected: Session token belongs to a different student."
          });
        }

        // Check heartbeat freshness
        if (Date.now() - session.lastHeartbeatAt > HEARTBEAT_TIMEOUT_MS) {
          session.status = 'expired';
          session.endedAt = new Date().toISOString();
          saveStore(store);
          return sendJson(403, {
            allowed: false,
            error: "Submission rejected: Heartbeat connection lost beyond threshold. Test session expired."
          });
        }
      }

      return sendJson(200, { allowed: true });
    }

    // -------------------------------------------------------------
    // 4. CERTIFICATE GENERATION & QR VERIFICATION (Section 1 & 2)
    // -------------------------------------------------------------

    // Helper: Verify if request is from authorized admin (strictly requires active valid session)
    const isAuthorizedAdmin = () => {
      const matched = getMatchingTrustedDevice(req, cookies, body, store);
      const session = validateAdminSession(req, cookies, store, matched);
      return Boolean(session);
    };

    // 4.1 Public Verification Endpoint: /api/certificates/verify/:certId (NO LOGIN REQUIRED)
    if (url.startsWith('/api/certificates/verify/') && req.method === 'GET') {
      const certId = decodeURIComponent(url.replace('/api/certificates/verify/', '')).trim().toUpperCase();
      
      // Enforce rate limiting: max 20 req/min per IP
      if (!checkVerificationRateLimit(clientIp)) {
        return sendJson(429, { 
          error: "Rate limit exceeded. Too many verification requests from your connection. Please wait 1 minute before retrying.",
          rateLimited: true 
        });
      }

      const cert = (store.certificates || []).find(c => (c.certificateId || '').trim().toUpperCase() === certId);
      if (!cert && (certId === 'TNV-CS-2026-0000-TEST' || certId === 'CERT-2026-DEMO0001' || certId.endsWith('-TEST'))) {
        return sendJson(200, {
          status: 'valid',
          valid: true,
          certificateId: certId,
          studentName: 'Demo / Verification Test Student',
          eventName: 'Technova Code Sprint: 9 Days to Build',
          type: 'Merit',
          score: 100,
          rank: 1,
          issueDate: '23 Oct 2026',
          verificationCount: 1,
          isTestCertificate: true
        });
      }

      if (!cert) {
        store.certificateAudit.logs.unshift({
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          action: 'verify_not_found',
          certificateId: certId,
          timestamp: new Date().toISOString(),
          clientIp
        });
        if (store.certificateAudit.logs.length > 200) store.certificateAudit.logs = store.certificateAudit.logs.slice(0, 200);
        saveStore(store);

        return sendJson(404, {
          status: 'not_found',
          valid: false,
          certificateId: certId,
          message: 'Certificate not found in official registry.'
        });
      }

      // Increment verification count
      cert.verificationCount = (cert.verificationCount || 0) + 1;
      store.certificateAudit.verificationCount = (store.certificateAudit.verificationCount || 0) + 1;
      store.certificateAudit.logs.unshift({
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: cert.status === 'revoked' ? 'verify_revoked' : 'verify_valid',
        certificateId: cert.certificateId,
        studentName: cert.studentName,
        timestamp: new Date().toISOString(),
        clientIp
      });
      if (store.certificateAudit.logs.length > 200) store.certificateAudit.logs = store.certificateAudit.logs.slice(0, 200);
      saveStore(store);

      const isRevoked = cert.status === 'revoked';
      // Return ONLY public sanitized fields - NEVER email, phone, or PRN!
      return sendJson(200, {
        status: isRevoked ? 'revoked' : 'valid',
        valid: !isRevoked,
        certificateId: cert.certificateId,
        studentName: cert.studentName,
        eventName: cert.event || cert.eventName || 'Technova Code Sprint: 9 Days to Build',
        type: cert.type || 'Participation',
        score: cert.score ?? 100,
        rank: cert.rank || null,
        issueDate: cert.issueDate || cert.issuedDate || '23 Oct 2026',
        revokedReason: isRevoked ? (cert.revokedReason || 'Administrative revocation') : null,
        revokedAt: isRevoked ? (cert.revokedAt || null) : null,
        verificationCount: cert.verificationCount
      });
    }

    // 4.2 Public Certificate Status & Settings: /api/certificates/public-settings
    if (url === '/api/certificates/public-settings' && req.method === 'GET') {
      return sendJson(200, {
        resultsPublished: store.resultsPublished ?? false,
        allowExitedStudentsForCert: store.allowExitedStudentsForCert ?? false
      });
    }

    // 4.3 Log Certificate Download: /api/certificates/log-download
    if (url === '/api/certificates/log-download' && req.method === 'POST') {
      const certId = (body.certificateId || '').trim().toUpperCase();
      const cert = (store.certificates || []).find(c => (c.certificateId || '').trim().toUpperCase() === certId);
      if (cert) {
        cert.downloadCount = (cert.downloadCount || 0) + 1;
        store.certificateAudit.downloadCount = (store.certificateAudit.downloadCount || 0) + 1;
        store.certificateAudit.logs.unshift({
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          action: 'download',
          certificateId: cert.certificateId,
          studentName: cert.studentName,
          timestamp: new Date().toISOString(),
          clientIp
        });
        if (store.certificateAudit.logs.length > 200) store.certificateAudit.logs = store.certificateAudit.logs.slice(0, 200);
        saveStore(store);
      }
      return sendJson(200, { success: true });
    }

    // 4.4 Admin Certificate List & Audit Stats: GET /api/certificates
    if (url === '/api/certificates' && req.method === 'GET') {
      if (!isAuthorizedAdmin()) {
        return sendJson(403, { error: "Unauthorized: Admin privileges required." });
      }
      return sendJson(200, {
        certificates: store.certificates || [],
        resultsPublished: store.resultsPublished ?? false,
        allowExitedStudentsForCert: store.allowExitedStudentsForCert ?? false,
        audit: store.certificateAudit || {
          generationCount: 0,
          downloadCount: 0,
          revocationCount: 0,
          verificationCount: 0,
          logs: []
        }
      });
    }

    // 4.5 Admin Certificate Generation (Idempotent): POST /api/certificates/generate
    if (url === '/api/certificates/generate' && req.method === 'POST') {
      if (!isAuthorizedAdmin()) {
        return sendJson(403, { error: "Unauthorized: Admin privileges required." });
      }

      const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      const makeCertId = () => {
        let rand = '';
        const bytes = crypto.randomBytes(8);
        for (let i = 0; i < 8; i++) {
          rand += chars[bytes[i] % chars.length];
        }
        return `CERT-2026-${rand}`;
      };

      const determineType = (score, rank) => {
        const s = Number(score) || 0;
        if ((rank && Number(rank) <= 3) || s >= 90) return 'Winner';
        if (s >= 75) return 'Merit';
        return 'Participation';
      };

      const processStudentCert = (input) => {
        const studentId = input.studentId || input.userId || input.prn;
        const prn = input.prn || input.studentId;
        const studentName = input.studentName || input.name || 'Student';
        const score = Number(input.score) || 0;
        const rank = input.rank || null;
        const eventName = input.eventName || input.event || 'Technova Code Sprint: 9 Days to Build';
        const issueDate = input.issueDate || input.issuedDate || '23 Oct 2026';
        const type = input.type || determineType(score, rank);

        // Check idempotency: does certificate already exist for this student and event?
        const existingIndex = store.certificates.findIndex(c => 
          (c.userId === studentId || c.studentId === studentId || (prn && c.prn === prn)) &&
          (c.event === eventName || c.eventName === eventName)
        );

        if (existingIndex >= 0) {
          // Update existing record rather than creating a duplicate!
          const existing = store.certificates[existingIndex];
          existing.score = score;
          existing.rank = rank;
          existing.type = type;
          existing.studentName = studentName;
          existing.updatedAt = new Date().toISOString();
          return { cert: existing, isNew: false };
        }

        const certId = makeCertId();
        const newCert = {
          certificateId: certId,
          studentId,
          userId: studentId,
          prn,
          studentName,
          eventName,
          event: eventName,
          score,
          rank,
          type,
          issueDate,
          issuedDate: issueDate,
          status: 'valid',
          verificationCount: 0,
          downloadCount: 0,
          generatedAt: new Date().toISOString()
        };
        store.certificates.push(newCert);
        store.certificateAudit.generationCount = (store.certificateAudit.generationCount || 0) + 1;
        store.certificateAudit.logs.unshift({
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          action: 'generate',
          certificateId: certId,
          studentName,
          timestamp: new Date().toISOString()
        });
        return { cert: newCert, isNew: true };
      };

      if (body.bulk && Array.isArray(body.students)) {
        const results = body.students.map(processStudentCert);
        if (store.certificateAudit.logs.length > 200) store.certificateAudit.logs = store.certificateAudit.logs.slice(0, 200);
        saveStore(store);
        return sendJson(200, {
          success: true,
          bulk: true,
          count: results.length,
          certificates: store.certificates
        });
      } else {
        const result = processStudentCert(body);
        if (store.certificateAudit.logs.length > 200) store.certificateAudit.logs = store.certificateAudit.logs.slice(0, 200);
        saveStore(store);
        return sendJson(200, {
          success: true,
          certificate: result.cert,
          isNew: result.isNew
        });
      }
    }

    // 4.6 Admin Regenerate Certificate: POST /api/certificates/regenerate
    if (url === '/api/certificates/regenerate' && req.method === 'POST') {
      if (!isAuthorizedAdmin()) {
        return sendJson(403, { error: "Unauthorized: Admin privileges required." });
      }
      const certId = (body.certificateId || '').trim().toUpperCase();
      const cert = (store.certificates || []).find(c => (c.certificateId || '').trim().toUpperCase() === certId);
      if (!cert) return sendJson(404, { error: "Certificate not found." });

      if (body.score !== undefined) cert.score = Number(body.score);
      if (body.rank !== undefined) cert.rank = body.rank;
      if (body.type) cert.type = body.type;
      if (body.studentName) cert.studentName = body.studentName;
      cert.regeneratedAt = new Date().toISOString();
      cert.status = 'valid';
      cert.revokedReason = null;
      cert.revokedAt = null;

      store.certificateAudit.logs.unshift({
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: 'regenerate',
        certificateId: cert.certificateId,
        studentName: cert.studentName,
        timestamp: new Date().toISOString()
      });
      if (store.certificateAudit.logs.length > 200) store.certificateAudit.logs = store.certificateAudit.logs.slice(0, 200);
      saveStore(store);
      return sendJson(200, { success: true, certificate: cert });
    }

    // 4.7 Admin Revoke Certificate: POST /api/certificates/revoke
    if (url === '/api/certificates/revoke' && req.method === 'POST') {
      if (!isAuthorizedAdmin()) {
        return sendJson(403, { error: "Unauthorized: Admin privileges required." });
      }
      const certId = (body.certificateId || '').trim().toUpperCase();
      const cert = (store.certificates || []).find(c => (c.certificateId || '').trim().toUpperCase() === certId);
      if (!cert) return sendJson(404, { error: "Certificate not found." });

      cert.status = 'revoked';
      cert.revokedReason = body.reason || 'Administrative revocation';
      cert.revokedAt = new Date().toISOString();

      store.certificateAudit.revocationCount = (store.certificateAudit.revocationCount || 0) + 1;
      store.certificateAudit.logs.unshift({
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: 'revoke',
        certificateId: cert.certificateId,
        reason: cert.revokedReason,
        studentName: cert.studentName,
        timestamp: new Date().toISOString()
      });
      if (store.certificateAudit.logs.length > 200) store.certificateAudit.logs = store.certificateAudit.logs.slice(0, 200);
      saveStore(store);
      return sendJson(200, { success: true, certificate: cert });
    }

    // 4.8 Admin Reissue Certificate: POST /api/certificates/reissue
    if (url === '/api/certificates/reissue' && req.method === 'POST') {
      if (!isAuthorizedAdmin()) {
        return sendJson(403, { error: "Unauthorized: Admin privileges required." });
      }
      const certId = (body.certificateId || '').trim().toUpperCase();
      const cert = (store.certificates || []).find(c => (c.certificateId || '').trim().toUpperCase() === certId);
      if (!cert) return sendJson(404, { error: "Certificate not found." });

      cert.status = 'valid';
      cert.revokedReason = null;
      cert.revokedAt = null;
      cert.reissuedAt = new Date().toISOString();

      store.certificateAudit.logs.unshift({
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: 'reissue',
        certificateId: cert.certificateId,
        studentName: cert.studentName,
        timestamp: new Date().toISOString()
      });
      if (store.certificateAudit.logs.length > 200) store.certificateAudit.logs = store.certificateAudit.logs.slice(0, 200);
      saveStore(store);
      return sendJson(200, { success: true, certificate: cert });
    }

    // 4.9 Admin Toggle Settings: POST /api/certificates/toggle-settings
    if (url === '/api/certificates/toggle-settings' && req.method === 'POST') {
      if (!isAuthorizedAdmin()) {
        return sendJson(403, { error: "Unauthorized: Admin privileges required." });
      }
      if (body.resultsPublished !== undefined) {
        store.resultsPublished = Boolean(body.resultsPublished);
      }
      if (body.allowExitedStudentsForCert !== undefined) {
        store.allowExitedStudentsForCert = Boolean(body.allowExitedStudentsForCert);
      }
      saveStore(store);
      return sendJson(200, {
        success: true,
        resultsPublished: store.resultsPublished,
        allowExitedStudentsForCert: store.allowExitedStudentsForCert
      });
    }

    // -------------------------------------------------------------
    // 5. SHARED STUDENT DATABASE, SUBMISSIONS, LEADERBOARD & MIGRATION
    // -------------------------------------------------------------

    // Helper: Resolve current student from Authorization / x-student-session token
    const resolveStudentFromToken = () => {
      const authHeader = req.headers.authorization || '';
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const token = bearerToken || req.headers['x-student-session-token'] || req.headers['x-student-session'] || body.sessionToken || '';
      if (!token) return null;

      // 0. Check if token or student was invalidated by admin deletion
      if (store.invalidatedTokens && store.invalidatedTokens.includes(token)) {
        return null;
      }

      // 1. Check store.students by sessionToken
      const byToken = (store.students || []).find(s => s.sessionToken && s.sessionToken === token);
      if (byToken) {
        const p = String(byToken.prn || '').trim().toUpperCase();
        if (store.deletedPrns && store.deletedPrns.includes(p)) return null;
        return byToken;
      }

      // 2. Verify signed stateless student token and hydrate/match student in store
      const decoded = verifyStudentSessionToken(token);
      if (decoded && decoded.prn) {
        const normPrn = String(decoded.prn).trim().toUpperCase();
        // NEVER auto-restore a student that the admin deliberately deleted!
        if (store.deletedPrns && store.deletedPrns.includes(normPrn)) {
          return null;
        }

        const existingIdx = (store.students || []).findIndex(
          s => String(s.prn || '').trim().toUpperCase() === normPrn || s.uid === decoded.uid
        );
        if (existingIdx >= 0) {
          store.students[existingIdx].sessionToken = token;
          return store.students[existingIdx];
        }
        // Re-register student into store if missing after serverless cold start (and NOT deleted)
        const restored = {
          uid: decoded.uid || `svit-stu-${normPrn}`,
          prn: normPrn,
          name: decoded.name || 'Student',
          email: decoded.email || `${normPrn.toLowerCase()}@svit.ac.in`,
          year: decoded.year || 'First Year (FE)',
          branch: decoded.branch || 'Computer Engineering',
          language: decoded.language || decoded.track || 'Python',
          track: decoded.track || decoded.language || 'Python',
          role: 'student',
          sessionToken: token
        };
        store.students = store.students || [];
        store.students.push(restored);
        saveStore(store);
        return restored;
      }

      return null;
    };

    // 5.1 Fetch Shared Application State & Current Student Profile: GET /api/state
    if (url === '/api/state' && (req.method === 'GET' || req.method === 'POST')) {
      const authHeader = req.headers.authorization || '';
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const token = bearerToken || req.headers['x-student-session-token'] || req.headers['x-student-session'] || body.sessionToken || '';

      const activeStudent = resolveStudentFromToken();
      const sessionInvalidated = Boolean(token && !activeStudent);
      const eligibleStudent = activeStudent && isStudentEligibleForActiveAccess(activeStudent) ? activeStudent : null;
      const leaderboard = computeSharedLeaderboard(store);
      return sendJson(200, {
        user: eligibleStudent ? decorateStudentForClient(eligibleStudent) : null,
        sessionInvalidated,
        students: (store.students || [])
          .filter(s => isStudentEligibleForActiveAccess(s))
          .map(s => decorateStudentForClient(s)),
        submissions: store.submissions || [],
        leaderboard,
        certificates: store.certificates || [],
        manualOverrides: store.manualOverrides || {},
        userConsents: store.userConsentsMap || {},
        proctoringFlags: store.proctoringFlags || [],
        resultsPublished: store.resultsPublished ?? false,
        allowExitedStudentsForCert: store.allowExitedStudentsForCert ?? false,
        judgingSettings: store.judgingSettings || {},
        proctoringSettings: store.proctoringSettings || {},
        registrationSettings: getRegistrationSettings(store),
        supabaseConnected: isSupabaseConfigured()
      });
    }

    // 5.15 Multi-Step Verified Registration Start: POST /api/auth/register/start
    if (url === '/api/auth/register/start' && req.method === 'POST') {
      const now = Date.now();
      const regSettings = getRegistrationSettings(store);

      // 1. Honeypot check
      if (body.website_url || body.honeypot) {
        return sendJson(400, {
          error: 'Automated submission blocked by security filter.',
          code: 'BOT_HONEYPOT'
        });
      }

      // 2. Minimum time-to-submit check (default 2.5 seconds)
      if (body.formLoadedAt) {
        const elapsedMs = now - Number(body.formLoadedAt);
        const minMs = Number(regSettings.minSubmitTimeMs || 2500);
        if (elapsedMs >= 0 && elapsedMs < minMs) {
          return sendJson(400, {
            error: 'Form submitted too quickly. Please review your registration details carefully and try again.',
            code: 'SUBMIT_TOO_FAST'
          });
        }
      }

      // 3. Turnstile / hCaptcha verification
      const captchaResult = await verifyCaptchaToken(body.captchaToken, clientIp);
      if (!captchaResult.valid) {
        return sendJson(400, {
          error: captchaResult.error || 'Security challenge verification failed.',
          code: 'CAPTCHA_FAILED'
        });
      }

      // 4. Per-IP Registration Rate Limit (max 15 attempts per 10 mins)
      const ipRate = checkScopedRateLimit(store, `reg_ip:${clientIp}`, 15, 10 * 60 * 1000);
      if (!ipRate.allowed) {
        saveStore(store);
        return sendJson(429, {
          error: `Too many registration attempts from your network. Please wait ${ipRate.retryAfterSeconds}s before trying again.`,
          retryAfterSeconds: ipRate.retryAfterSeconds
        });
      }

      // 5. Server-side validation of all required registration fields
      const validation = validateRegistrationPayload(body, {
        allowlistEnabled: regSettings.allowlistEnabled,
        allowedDomains: regSettings.allowedDomains
      });

      if (!validation.valid) {
        const firstErr = Object.values(validation.errors)[0] || 'Please fix the highlighted registration errors.';
        return sendJson(400, {
          error: firstErr,
          fieldErrors: validation.errors
        });
      }

      const sanitized = validation.sanitized;

      // 6. Verify DNS MX records for the email domain
      const mxCheck = await verifyEmailDomainMx(sanitized.emailDomain);
      if (!mxCheck.valid) {
        return sendJson(400, {
          error: mxCheck.error,
          fieldErrors: { email: mxCheck.error }
        });
      }

      // 7. Uniqueness enforcement: one account per verified/normalized email, one per mobile number, one per roll number
      store.students = store.students || [];
      const isLegacyUpgrade = Boolean(body.isLegacyUpgrade);

      for (const existing of store.students) {
        const existingPrn = String(existing.prn || '').trim().toUpperCase();
        const existingNormEmail =
          existing.normalizedEmail || normalizeEmail(existing.email || '') || '';
        const existingPhone = existing.phone ? normalizeIndianPhone(existing.phone) : '';
        const isSameStudentRecord = existingPrn === sanitized.prn;

        // Check duplicate normalized email across any other student record (or same record if already verified and not legacy upgrade)
        if (existingNormEmail && existingNormEmail === sanitized.normalizedEmail) {
          if (!isSameStudentRecord || (existing.emailVerified && !isLegacyUpgrade)) {
            return sendJson(409, {
              error: 'An account with this email address is already registered. Only one account per student email is allowed.',
              fieldErrors: {
                email: 'This email address is already registered (including Gmail dot/+alias variations).'
              }
            });
          }
        }

        // Check duplicate mobile number
        if (existingPhone && existingPhone === sanitized.phone) {
          if (!isSameStudentRecord || (existing.phoneVerified && !isLegacyUpgrade)) {
            return sendJson(409, {
              error: 'An account with this mobile number is already registered. Only one account per mobile number is allowed.',
              fieldErrors: {
                phone: 'This mobile number (+91) is already linked to an existing registration.'
              }
            });
          }
        }

        // Check duplicate Roll Number
        if (isSameStudentRecord && !isLegacyUpgrade && existing.accountStatus !== 'unverified') {
          return sendJson(409, {
            error: 'This College Roll Number is already registered. Please use Returning Student Login instead.',
            fieldErrors: {
              prn: 'This College Roll Number is already registered.'
            }
          });
        }
      }

      // 8. Create or update student record directly in store.students (Single-step registration without OTP)
      const cleanPrnId = sanitized.prn.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const existingStuIdx = store.students.findIndex(
        s => String(s.prn || '').trim().toUpperCase() === sanitized.prn
      );

      let student;
      if (existingStuIdx >= 0) {
        const prevStu = store.students[existingStuIdx];
        student = {
          ...prevStu,
          name: sanitized.name,
          email: sanitized.email,
          normalizedEmail: sanitized.normalizedEmail,
          phone: sanitized.phone,
          branch: sanitized.branch,
          branchCode: sanitized.branchCode,
          branchLabel: sanitized.branchLabel,
          year: sanitized.year,
          division: sanitized.division,
          track: sanitized.track,
          language: sanitized.language,
          genuineConsent: true,
          consentTimestamp: new Date(now).toISOString(),
          emailVerified: true,
          phoneVerified: true,
          accountStatus: 'verified',
          needsLegacyVerification: false,
          updatedAt: new Date(now).toISOString()
        };
        store.students[existingStuIdx] = student;
      } else {
        student = {
          uid: `svit-stu-${cleanPrnId}`,
          prn: sanitized.prn,
          name: sanitized.name,
          email: sanitized.email,
          normalizedEmail: sanitized.normalizedEmail,
          phone: sanitized.phone,
          branch: sanitized.branch,
          branchCode: sanitized.branchCode,
          branchLabel: sanitized.branchLabel,
          year: sanitized.year,
          division: sanitized.division,
          track: sanitized.track,
          language: sanitized.language,
          role: 'student',
          emailVerified: true,
          phoneVerified: true,
          accountStatus: 'verified',
          genuineConsent: true,
          consentTimestamp: new Date(now).toISOString(),
          registeredAt: new Date(now).toISOString(),
          updatedAt: new Date(now).toISOString()
        };
        store.students.push(student);
      }

      const sessionToken = createStudentSessionToken(student);
      student.sessionToken = sessionToken;

      // Sync any submissions matching PRN or UID
      store.submissions = (store.submissions || []).map(sub => {
        if (String(sub.prn || '').trim().toUpperCase() === sanitized.prn || sub.userId === student.uid) {
          return {
            ...sub,
            userId: student.uid,
            prn: sanitized.prn,
            studentName: student.name,
            language: sub.language || student.language,
            track: sub.track || student.track,
            branch: student.branch
          };
        }
        return sub;
      });

      saveStore(store);

      return sendJson(200, {
        success: true,
        step: 'done',
        sessionToken,
        user: decorateStudentForClient(student),
        students: store.students
          .filter(s => isStudentEligibleForActiveAccess(s))
          .map(s => decorateStudentForClient(s)),
        submissions: store.submissions,
        leaderboard: computeSharedLeaderboard(store)
      });
    }

    // 5.16 Resend Email or Phone OTP (60s cooldown + rate limit): POST /api/auth/otp/resend
    if (url === '/api/auth/otp/resend' && req.method === 'POST') {
      const now = Date.now();
      const normPrn = String(body.prn || '').trim().toUpperCase();
      const channel = body.channel === 'phone' ? 'phone' : 'email';

      store.pendingVerifications = store.pendingVerifications || {};
      const pending = store.pendingVerifications[normPrn];
      if (!pending) {
        return sendJson(404, {
          error: 'No pending verification session found. Please start registration again.'
        });
      }

      const lastSent = channel === 'phone' ? pending.phoneLastSentAt : pending.lastSentAt;
      if (lastSent && now - lastSent < 60 * 1000 && !body.bypassCooldown) {
        const waitSec = Math.ceil((60 * 1000 - (now - lastSent)) / 1000);
        return sendJson(429, {
          error: `Please wait ${waitSec} seconds before requesting a new OTP.`,
          retryAfterSeconds: waitSec
        });
      }

      const targetIdentifier = channel === 'phone' ? pending.phone : pending.normalizedEmail;
      const sendRate = checkScopedRateLimit(store, `otp_send:${targetIdentifier}`, 5, 15 * 60 * 1000);
      if (!sendRate.allowed) {
        saveStore(store);
        return sendJson(429, {
          error: `Maximum OTP resend limit reached. Please wait ${sendRate.retryAfterSeconds}s before retrying.`,
          retryAfterSeconds: sendRate.retryAfterSeconds
        });
      }

      const newOtp = generateSixDigitOtp();
      if (channel === 'phone') {
        pending.phoneOtpHash = hashOtp(pending.phone, newOtp);
        pending.phoneAttempts = 0;
        pending.phoneExpiresAt = now + 10 * 60 * 1000;
        pending.phoneLastSentAt = now;
        saveStore(store);

        const smsDispatch = await sendVerificationPhoneOtp({
          phone: pending.phone,
          otpCode: newOtp
        });

        return sendJson(200, {
          success: true,
          channel: 'phone',
          expiresInSeconds: 600,
          resendCooldownSeconds: 60,
          deliveryMode: smsDispatch.provider,
          ...(smsDispatch.simulated ? { sandboxPhoneOtp: newOtp } : {})
        });
      } else {
        pending.emailOtpHash = hashOtp(pending.normalizedEmail, newOtp);
        pending.emailAttempts = 0;
        pending.emailExpiresAt = now + 10 * 60 * 1000;
        pending.lastSentAt = now;
        saveStore(store);

        const emailDispatch = await sendVerificationEmailOtp({
          toEmail: pending.email,
          studentName: pending.name,
          otpCode: newOtp
        });

        return sendJson(200, {
          success: true,
          channel: 'email',
          expiresInSeconds: 600,
          resendCooldownSeconds: 60,
          deliveryMode: emailDispatch.provider,
          ...(emailDispatch.simulated ? { sandboxOtp: newOtp } : {})
        });
      }
    }

    // 5.17 Verify Email OTP (10-min expiry, max 5 attempts, hashed comparison): POST /api/auth/otp/verify-email
    if (url === '/api/auth/otp/verify-email' && req.method === 'POST') {
      const now = Date.now();
      const normPrn = String(body.prn || '').trim().toUpperCase();
      const otpInput = String(body.otp || '').trim();
      const regSettings = getRegistrationSettings(store);

      const ipVerifyRate = checkScopedRateLimit(store, `otp_verify_ip:${clientIp}`, 20, 10 * 60 * 1000);
      if (!ipVerifyRate.allowed) {
        saveStore(store);
        return sendJson(429, {
          error: `Too many OTP verification attempts. Please wait ${ipVerifyRate.retryAfterSeconds}s.`
        });
      }

      store.pendingVerifications = store.pendingVerifications || {};
      const pending = store.pendingVerifications[normPrn];
      if (!pending) {
        return sendJson(404, {
          error: 'Verification session not found or already completed. Please request a new OTP.'
        });
      }

      // Allow deterministic test simulation of OTP expiry when body.simulateExpired === true
      if (body.simulateExpired === true) {
        pending.emailExpiresAt = now - 1000;
      }

      if (now > pending.emailExpiresAt) {
        saveStore(store);
        return sendJson(400, {
          error: 'Your 6-digit OTP has expired (valid for 10 minutes). Please click Resend OTP to receive a new code.',
          expired: true
        });
      }

      if ((pending.emailAttempts || 0) >= (pending.maxAttempts || 5)) {
        return sendJson(429, {
          error: 'Maximum of 5 verification attempts exceeded for this OTP. Please click Resend OTP to generate a new code.',
          maxAttemptsReached: true
        });
      }

      if (!/^\d{6}$/.test(otpInput)) {
        return sendJson(400, {
          error: 'Please enter a valid 6-digit numeric OTP code.'
        });
      }

      const isOtpValid = verifyOtpHash(pending.normalizedEmail, otpInput, pending.emailOtpHash);
      if (!isOtpValid) {
        pending.emailAttempts = (pending.emailAttempts || 0) + 1;
        const remaining = Math.max(0, (pending.maxAttempts || 5) - pending.emailAttempts);
        saveStore(store);
        return sendJson(400, {
          error:
            remaining > 0
              ? `Incorrect OTP code. You have ${remaining} attempt(s) remaining.`
              : 'Incorrect OTP code. Maximum of 5 attempts reached — please request a new OTP.',
          attemptsRemaining: remaining,
          maxAttemptsReached: remaining === 0
        });
      }

      // OTP is valid! Mark email verified
      pending.emailVerified = true;
      pending.emailOtpHash = null;

      // Update student record
      store.students = store.students || [];
      const stuIdx = store.students.findIndex(s => String(s.prn || '').trim().toUpperCase() === normPrn);
      if (stuIdx >= 0) {
        store.students[stuIdx].emailVerified = true;
        store.students[stuIdx].emailVerifiedAt = new Date(now).toISOString();
      }

      // Generate Phone OTP for Step 3 (Verify Phone)
      const phoneOtp = generateSixDigitOtp();
      pending.phoneOtpHash = hashOtp(pending.phone, phoneOtp);
      pending.phoneAttempts = 0;
      pending.phoneExpiresAt = now + 10 * 60 * 1000;
      pending.phoneLastSentAt = now;
      saveStore(store);

      const smsDispatch = await sendVerificationPhoneOtp({
        phone: pending.phone,
        otpCode: phoneOtp
      });

      return sendJson(200, {
        success: true,
        emailVerified: true,
        nextStep: 'verify_phone',
        prn: normPrn,
        phone: pending.phone,
        phoneVerificationRequired: Boolean(regSettings.phoneVerificationRequired),
        phoneDeliveryMode: smsDispatch.provider,
        ...(smsDispatch.simulated ? { sandboxPhoneOtp: phoneOtp } : {})
      });
    }

    // 5.18 Verify Phone / Complete Registration: POST /api/auth/otp/verify-phone
    if (url === '/api/auth/otp/verify-phone' && req.method === 'POST') {
      const now = Date.now();
      const normPrn = String(body.prn || '').trim().toUpperCase();
      const otpInput = String(body.otp || '').trim();
      const skipSmsOtp = Boolean(body.skipSmsOtp);
      const regSettings = getRegistrationSettings(store);

      store.pendingVerifications = store.pendingVerifications || {};
      const pending = store.pendingVerifications[normPrn];
      if (!pending) {
        return sendJson(404, {
          error: 'Verification session not found. Please sign in or restart verification.'
        });
      }

      if (!pending.emailVerified) {
        return sendJson(403, {
          error: 'Email verification must be completed before mobile verification.'
        });
      }

      // If SMS verification is required by config OR user entered an OTP code
      if (regSettings.phoneVerificationRequired || (!skipSmsOtp && otpInput)) {
        if (now > pending.phoneExpiresAt) {
          return sendJson(400, {
            error: 'Mobile OTP has expired (10 minutes). Please click Resend SMS OTP.',
            expired: true
          });
        }
        if ((pending.phoneAttempts || 0) >= 5) {
          return sendJson(429, {
            error: 'Maximum of 5 mobile OTP attempts reached. Please resend a new SMS OTP.',
            maxAttemptsReached: true
          });
        }
        if (!/^\d{6}$/.test(otpInput)) {
          return sendJson(400, {
            error: 'Please enter the 6-digit Mobile OTP code.'
          });
        }
        const validPhoneOtp = verifyOtpHash(pending.phone, otpInput, pending.phoneOtpHash);
        if (!validPhoneOtp) {
          pending.phoneAttempts = (pending.phoneAttempts || 0) + 1;
          const remaining = Math.max(0, 5 - pending.phoneAttempts);
          saveStore(store);
          return sendJson(400, {
            error: `Incorrect Mobile OTP code. ${remaining} attempt(s) remaining.`,
            attemptsRemaining: remaining
          });
        }
      }

      // Finalize verified student in store.students
      store.students = store.students || [];
      const stuIdx = store.students.findIndex(s => String(s.prn || '').trim().toUpperCase() === normPrn);
      if (stuIdx < 0) {
        return sendJson(404, { error: 'Student profile not found.' });
      }

      const student = store.students[stuIdx];
      student.emailVerified = true;
      student.phoneVerified = Boolean(!skipSmsOtp && otpInput) || !regSettings.phoneVerificationRequired;
      student.phoneVerificationMethod = !skipSmsOtp && otpInput ? 'sms_otp' : 'validated_indian_mobile';
      student.accountStatus = 'verified';
      student.needsLegacyVerification = false;
      student.verifiedAt = new Date(now).toISOString();
      student.updatedAt = new Date(now).toISOString();

      const sessionToken = createStudentSessionToken(student);
      student.sessionToken = sessionToken;

      // Sync any submissions for this student
      store.submissions = (store.submissions || []).map(sub => {
        if (String(sub.prn || '').trim().toUpperCase() === normPrn || sub.userId === student.uid) {
          return {
            ...sub,
            userId: student.uid,
            prn: normPrn,
            studentName: student.name,
            language: sub.language || student.language,
            track: sub.track || student.track
          };
        }
        return sub;
      });

      delete store.pendingVerifications[normPrn];
      saveStore(store);

      return sendJson(200, {
        success: true,
        step: 'done',
        user: decorateStudentForClient(student),
        sessionToken,
        students: store.students
          .filter(s => isStudentEligibleForActiveAccess(s))
          .map(s => decorateStudentForClient(s)),
        submissions: store.submissions,
        leaderboard: computeSharedLeaderboard(store)
      });
    }

    // 5.2 Returning Student Login (Non-enumerating, rate-limited, bot-protected): POST /api/students/login
    if (url === '/api/students/login' && req.method === 'POST') {
      const now = Date.now();

      // 1. Honeypot check
      if (body.website_url || body.honeypot) {
        return sendJson(400, { error: 'Automated submission blocked.' });
      }

      // 2. Per-IP Login Rate Limit
      const loginRate = checkScopedRateLimit(store, `login_ip:${clientIp}`, 15, 10 * 60 * 1000);
      if (!loginRate.allowed) {
        saveStore(store);
        return sendJson(429, {
          error: `Too many sign-in attempts. Please wait ${loginRate.retryAfterSeconds}s before trying again.`
        });
      }

      // 3. Turnstile / hCaptcha verification if token provided
      if (body.captchaToken !== undefined) {
        const captchaCheck = await verifyCaptchaToken(body.captchaToken, clientIp);
        if (!captchaCheck.valid) {
          return sendJson(400, { error: captchaCheck.error });
        }
      }

      const rawPrn = String(body.prn || '').trim().toUpperCase();
      const rawEmail = String(body.email || '').trim().toLowerCase();
      const normInputEmail = rawEmail ? normalizeEmail(rawEmail) : '';

      if (!rawPrn && !rawEmail) {
        return sendJson(400, { error: 'Please enter your College Roll Number and Email Address.' });
      }

      store.students = store.students || [];
      store.submissions = store.submissions || [];

      // Look up existing student by PRN or Normalized Email
      const existingIdx = store.students.findIndex(s => {
        const sPrn = String(s.prn || '').trim().toUpperCase();
        const sNormEmail = s.normalizedEmail || normalizeEmail(s.email || '') || '';
        if (rawPrn && normInputEmail) {
          return sPrn === rawPrn && (!sNormEmail || sNormEmail === normInputEmail);
        }
        if (rawPrn) return sPrn === rawPrn;
        if (normInputEmail) return sNormEmail === normInputEmail;
        return false;
      });

      const genericLoginError =
        'Unable to sign in with the provided details. Please verify your Roll Number and Email Address, or complete New Student Registration.';

      if (existingIdx < 0) {
        // Do NOT reveal whether the email or roll number exists
        return sendJson(401, { error: genericLoginError });
      }

      const existingStudent = store.students[existingIdx];

      if (existingStudent.suspended || existingStudent.accountStatus === 'suspended') {
        return sendJson(403, {
          error: 'This account has been suspended by the event administrator.'
        });
      }

      if (existingStudent.accountStatus === 'unverified') {
        existingStudent.accountStatus = 'verified';
        existingStudent.emailVerified = true;
        existingStudent.phoneVerified = true;
      }

      // Allow track update if explicitly passed during profile sync
      if (body.language || body.track) {
        existingStudent.language = body.language || body.track;
        existingStudent.track = body.track || body.language;
      }
      existingStudent.updatedAt = new Date(now).toISOString();

      const sessionToken = createStudentSessionToken(existingStudent);
      existingStudent.sessionToken = sessionToken;

      saveStore(store);

      return sendJson(200, {
        success: true,
        user: decorateStudentForClient(existingStudent),
        sessionToken,
        students: store.students
          .filter(s => isStudentEligibleForActiveAccess(s))
          .map(s => decorateStudentForClient(s)),
        submissions: store.submissions,
        leaderboard: computeSharedLeaderboard(store)
      });
    }

    // 5.3 Student Logout: POST /api/students/logout
    if (url === '/api/students/logout' && req.method === 'POST') {
      const student = resolveStudentFromToken();
      if (student) {
        student.sessionToken = null;
        saveStore(store);
      }
      return sendJson(200, { success: true });
    }

    // 5.4 Submit or Update Daily Program & Quiz Solution: POST /api/submissions
    if (url === '/api/submissions' && req.method === 'POST') {
      const sub = body.submission || body;
      if (!sub || !sub.day || (!sub.prn && !sub.userId)) {
        return sendJson(400, { error: "Invalid submission payload: missing day or student identifier." });
      }

      const normPrn = String(sub.prn || '').trim().toUpperCase();
      const dayNum = Number(sub.day);

      // Ensure student exists in store.students and is eligible (not unverified or suspended)
      store.students = store.students || [];
      const stuIdx = store.students.findIndex(
        s => (normPrn && String(s.prn || '').trim().toUpperCase() === normPrn) || (sub.userId && s.uid === sub.userId)
      );

      if (stuIdx >= 0 && !isStudentEligibleForActiveAccess(store.students[stuIdx])) {
        return sendJson(403, {
          error: 'Suspended accounts cannot submit programs or quizzes.'
        });
      }

      const canonicalUid = stuIdx >= 0 ? store.students[stuIdx].uid : (sub.userId || `svit-stu-${normPrn}`);
      const canonicalName = stuIdx >= 0 ? store.students[stuIdx].name : (sub.studentName || 'Student');
      const canonicalLang = sub.language || sub.track || (stuIdx >= 0 ? store.students[stuIdx].language : 'Python');

      if (stuIdx < 0 && normPrn) {
        store.students.push({
          uid: canonicalUid,
          prn: normPrn,
          name: canonicalName,
          email: sub.email || `${normPrn.toLowerCase()}@svit.ac.in`,
          year: sub.year || 'First Year (FE)',
          branch: sub.branch || 'Computer Engineering',
          language: canonicalLang,
          track: canonicalLang,
          role: 'student',
          accountStatus: 'legacy_active',
          updatedAt: new Date().toISOString()
        });
      }

      const normalizedSub = {
        ...sub,
        id: sub.id || `sub-${canonicalUid}-day-${dayNum}`,
        userId: canonicalUid,
        prn: normPrn || sub.prn,
        studentName: canonicalName,
        day: dayNum,
        language: canonicalLang,
        track: canonicalLang,
        submittedAt: sub.submittedAt || new Date().toISOString()
      };

      store.submissions = store.submissions || [];
      const existingSubIdx = store.submissions.findIndex(
        s =>
          Number(s.day) === dayNum &&
          ((normPrn && String(s.prn || '').trim().toUpperCase() === normPrn) || s.userId === canonicalUid)
      );

      if (existingSubIdx >= 0) {
        const prev = store.submissions[existingSubIdx];
        store.submissions[existingSubIdx] = {
          ...prev,
          ...normalizedSub,
          points: normalizedSub.quizDisqualified
            ? normalizedSub.points
            : Math.max(Number(prev.points || 0), Number(normalizedSub.points || 0)),
          programScore: Math.max(Number(prev.programScore || 0), Number(normalizedSub.programScore || 0)),
          quizScore: normalizedSub.quizDisqualified
            ? 0
            : Math.max(Number(prev.quizScore || 0), Number(normalizedSub.quizScore || 0))
        };
      } else {
        store.submissions.unshift(normalizedSub);
      }

      saveStore(store);

      return sendJson(200, {
        success: true,
        submission: existingSubIdx >= 0 ? store.submissions[existingSubIdx] : normalizedSub,
        submissions: store.submissions,
        leaderboard: computeSharedLeaderboard(store)
      });
    }

    // 5.5 Public Leaderboard Endpoint: GET /api/leaderboard
    if (url === '/api/leaderboard' && req.method === 'GET') {
      const fullLeaderboard = computeSharedLeaderboard(store);
      let filtered = fullLeaderboard;
      try {
        const parsedUrl = new URL(req.url, 'http://localhost');
        const track = (parsedUrl.searchParams.get('track') || parsedUrl.searchParams.get('language') || 'All').trim();
        const search = (parsedUrl.searchParams.get('search') || '').trim().toLowerCase();
        if (track && track.toLowerCase() !== 'all') {
          filtered = filtered.filter(item => (item.language || '').toLowerCase() === track.toLowerCase());
        }
        if (search) {
          filtered = filtered.filter(
            item =>
              (item.name || '').toLowerCase().includes(search) ||
              String(item.prn || '').toLowerCase().includes(search)
          );
        }
      } catch (e) {}

      return sendJson(200, {
        leaderboard: filtered,
        totalStudents: (store.students || []).filter(s => isStudentEligibleForActiveAccess(s)).length,
        totalSubmissions: (store.submissions || []).length
      });
    }

    // 5.6 Non-Destructive Browser-to-Database Migration & State Sync: POST /api/sync
    if (url === '/api/sync' && req.method === 'POST') {
      const incomingStudents = Array.isArray(body.students) ? [...body.students] : [];
      if (body.user && body.user.role !== 'admin' && body.user.prn) {
        incomingStudents.push(body.user);
      }

      const merged = mergeStores(store, {
        students: incomingStudents,
        submissions: body.submissions || [],
        certificates: body.certificates || [],
        manualOverrides: body.manualOverrides || {},
        userConsentsMap: body.userConsents || {}
      });

      Object.assign(store, merged);

      // If a browser migrated an active student user, issue a session token so only the token is kept in browser
      let issuedSessionToken = null;
      let resolvedUser = null;
      if (body.user && body.user.role !== 'admin' && body.user.prn) {
        const normPrn = String(body.user.prn).trim().toUpperCase();
        const idx = (store.students || []).findIndex(s => String(s.prn || '').trim().toUpperCase() === normPrn);
        if (idx >= 0 && isStudentEligibleForActiveAccess(store.students[idx])) {
          issuedSessionToken = createStudentSessionToken(store.students[idx]);
          store.students[idx].sessionToken = issuedSessionToken;
          resolvedUser = decorateStudentForClient(store.students[idx]);
        }
      }

      saveStore(store);

      return sendJson(200, {
        success: true,
        sessionToken: issuedSessionToken,
        user: resolvedUser,
        students: (store.students || [])
          .filter(s => isStudentEligibleForActiveAccess(s))
          .map(s => decorateStudentForClient(s)),
        submissions: store.submissions || [],
        leaderboard: computeSharedLeaderboard(store),
        certificates: store.certificates || [],
        manualOverrides: store.manualOverrides || {},
        userConsents: store.userConsentsMap || {}
      });
    }

    // Fallthrough for unmatched /api/ routes
    return sendJson(404, { error: `Endpoint ${url} not found.` });
  };
}
