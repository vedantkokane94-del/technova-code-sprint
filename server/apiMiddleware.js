import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const DATA_STORE_PATH = path.resolve(process.cwd(), 'data-store.json');

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

// Helper to safely read and write data-store.json
export function getStore() {
  let store = null;
  try {
    if (fs.existsSync(DATA_STORE_PATH)) {
      const content = fs.readFileSync(DATA_STORE_PATH, 'utf-8');
      store = JSON.parse(content);
    }
  } catch (e) {
    console.error("Error reading data store:", e);
  }
  if (!store) {
    store = {
      students: [],
      submissions: [],
      certificates: [],
      resultsPublished: false,
      allowExitedStudentsForCert: false,
      certificateAudit: {
        generationCount: 0,
        downloadCount: 0,
        revocationCount: 0,
        verificationCount: 0,
        logs: []
      },
      activeTestSessions: [],
      studentConsents: [],
      blockedAttempts: [],
      studentWhitelists: [],
      adminDevice: null,
      adminLoginLogs: [],
      adminRateLimit: { failedAttempts: 0, lockedUntil: 0 },
      proctoringExits: [],
      judgingSettings: {
        negativeMarking: 0,
        quizTimeLimitSeconds: 600,
        marksPerQuestion: 1.25,
        judgingCriteriaText: ''
      },
      proctoringSettings: {
        violationMode: 'immediate_exit',
        warningsAllowed: 0,
        noFaceSeconds: 10,
        phoneConfidence: 0.55
      }
    };
  }
  store.certificates = store.certificates || [];
  store.resultsPublished = store.resultsPublished ?? false;
  store.allowExitedStudentsForCert = store.allowExitedStudentsForCert ?? false;
  store.activeTestSessions = store.activeTestSessions || [];
  store.studentConsents = store.studentConsents || [];
  store.blockedAttempts = store.blockedAttempts || [];
  store.studentWhitelists = store.studentWhitelists || [];
  store.certificateAudit = store.certificateAudit || {
    generationCount: 0,
    downloadCount: 0,
    revocationCount: 0,
    verificationCount: 0,
    logs: []
  };
  return store;
}

// In-memory rate limiting map for certificate public verification (max 20 req/min per IP)
const verificationRateLimitMap = new Map();
function checkVerificationRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxReqs = 20; // 20 requests per minute
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
  try {
    fs.writeFileSync(DATA_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error("Error saving data store:", e);
  }
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

// Verify Admin Master Password using Bcrypt (Cost 12) from env ADMIN_PASSWORD_HASH or default hash
function verifyAdminPassword(inputPassword) {
  if (process.env.ADMIN_PASSWORD_HASH === '' || process.env.ADMIN_AUTH_DISABLED === 'true') {
    return false;
  }
  const hashedAdminPass = process.env.ADMIN_PASSWORD_HASH || '$2b$12$oKYonyNOy7SqjEiShNZQGeuTIklNi5GN0zNA01v1nq8jMjwulpJ5O';
  if (!inputPassword || !hashedAdminPass) return false;

  try {
    return bcrypt.compareSync(inputPassword, hashedAdminPass);
  } catch (e) {
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

// Sign and verify device cookie token using ADMIN_JWT_SECRET or SESSION_SECRET HMAC
function signDeviceToken(rawSecret) {
  const sessionSecret = process.env.ADMIN_JWT_SECRET || process.env.SESSION_SECRET || 'svit-technova-session-secret-2026-alpha';
  const sig = crypto.createHmac('sha256', sessionSecret).update(rawSecret).digest('hex');
  return `${rawSecret}.${sig}`;
}

function verifyDeviceToken(signedToken) {
  if (!signedToken || typeof signedToken !== 'string') return null;
  const parts = signedToken.split('.');
  if (parts.length !== 2) return null;
  const [rawSecret, sig] = parts;
  const sessionSecret = process.env.ADMIN_JWT_SECRET || process.env.SESSION_SECRET || 'svit-technova-session-secret-2026-alpha';
  const expectedSig = crypto.createHmac('sha256', sessionSecret).update(rawSecret).digest('hex');
  if (sig !== expectedSig) return null;
  return rawSecret;
}

// 2-Hour HMAC-SHA256 JWT generation and verification bound to email, session ID and optional device token
function createAdminSessionJwt(sessionId, email = 'technicalteamsvit@gmail.com', deviceTokenHash = null) {
  const sessionSecret = process.env.ADMIN_JWT_SECRET || process.env.SESSION_SECRET || 'svit-technova-session-secret-2026-alpha';
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
  const sessionSecret = process.env.ADMIN_JWT_SECRET || process.env.SESSION_SECRET || 'svit-technova-session-secret-2026-alpha';
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
    const store = getStore();

    const sendJson = (status, data, extraHeaders = {}) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      for (const [k, v] of Object.entries(extraHeaders)) {
        res.setHeader(k, v);
      }
      res.end(JSON.stringify(data));
    };

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
          return sendJson(429, { error: `Security lockout in effect. Please wait ${remainingSec}s before retrying.` });
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
        const inputEmail = body.email ? String(body.email).trim().toLowerCase() : '';
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

        // Email verification (if email was supplied, must match configuredAdminEmail)
        const isEmailValid = body.email ? (inputEmail === configuredAdminEmail) : true;
        const isPasswordValid = verifyAdminPassword(inputPassword);

        if (!isEmailValid || !isPasswordValid) {
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
            reason: !isEmailValid ? 'invalid_email' : 'invalid_password'
          });
          saveStore(store);

          return sendJson(401, {
            error: "Authentication failed. Invalid administrator credentials.",
            attemptsRemaining
          });
        }

        // Successful authentication: issue rotated 2-hour JWT session
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
          expiresAt: Date.now() + (2 * 3600 * 1000) // 2-hour short-lived session
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
        const sessionCookie = `admin_session=${sessionJwt}; Path=/; HttpOnly; SameSite=Strict; Max-Age=7200${secureSuffix}`;
        const csrfCookie = `admin_csrf=${csrfToken}; Path=/; SameSite=Strict; Max-Age=7200${secureSuffix}`;

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
        issueDate: cert.issueDate || cert.issuedDate || '22 Oct 2026',
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
        const issueDate = input.issueDate || input.issuedDate || '22 Oct 2026';
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

    // Fallthrough for unmatched /api/ routes
    return sendJson(404, { error: `Endpoint ${url} not found.` });
  };
}
