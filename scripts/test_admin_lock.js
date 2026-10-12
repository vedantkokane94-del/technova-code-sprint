/**
 * Comprehensive Automated Verification Test Suite for Admin Hardware Device Lock,
 * Session Hardening, Rate Limiting, and Hardware Concealment.
 * Sir Visvesvaraya Institute of Technology (SVIT), Nashik
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const BASE_URL = 'http://localhost:5173';
const DATA_STORE_PATH = path.resolve(process.cwd(), 'data-store.json');
const SETUP_KEY = 'svit-technova-master-setup-key-2026-x9z';
const PASSWORD = process.env.ADMIN_TEST_PASSWORD || 'Sv1t#TechLead_2026!';

function parseCookiesFromRes(res) {
  const setCookie = res.headers.get('set-cookie');
  const cookies = {};
  if (!setCookie) return cookies;
  
  const parts = setCookie.split(/,(?=[^;]+=[^;]+)/);
  for (const part of parts) {
    const pair = part.split(';')[0].trim();
    const [k, ...v] = pair.split('=');
    if (k) cookies[k.trim()] = v.join('=').trim();
  }
  return cookies;
}

async function runTests() {
  console.log('\n===============================================================');
  console.log(' TECHNOVA SVIT: ADMIN HARDWARE DEVICE LOCK INTEGRATION SUITE');
  console.log('===============================================================\n');

  let passedCount = 0;
  let totalTests = 0;

  function assert(condition, name, notes = '') {
    totalTests++;
    if (condition) {
      passedCount++;
      console.log(`  [PASS] Test ${totalTests}: ${name} ${notes ? `(${notes})` : ''}`);
      return true;
    } else {
      console.error(`  [FAIL] Test ${totalTests}: ${name} ${notes ? `(${notes})` : ''}`);
      return false;
    }
  }

  // -----------------------------------------------------------------
  // 0. RESET TO KNOWN CLEAN STATE VIA CLI RECOVERY
  // -----------------------------------------------------------------
  console.log('>>> Step 0: Executing CLI Recovery Script to start fresh...');
  try {
    const cliOutput = execSync(`node scripts/resetAdminDevice.js --setup-key=${SETUP_KEY}`, { encoding: 'utf-8' });
    assert(cliOutput.includes('[SUCCESS] Admin hardware device binding has been completely wiped'), 'CLI Recovery resets store cleanly');
  } catch (e) {
    assert(false, 'CLI Recovery execution', e.message);
  }

  // -----------------------------------------------------------------
  // 1. SETUP MODE STATUS CHECK (No device registered yet)
  // -----------------------------------------------------------------
  console.log('\n>>> Step 1: Testing Device Status in Open Setup Mode...');
  const res1 = await fetch(`${BASE_URL}/api/admin/device-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const data1 = await res1.json();
  assert(res1.status === 200 && data1.setupOpen === true && data1.isRegistered === false, 
    'Setup Mode Open', `status=${res1.status}, setupOpen=${data1.setupOpen}`);

  // -----------------------------------------------------------------
  // 2. REGISTRATION REJECTION ON INVALID SETUP KEY (CONCEALED 404)
  // -----------------------------------------------------------------
  console.log('\n>>> Step 2: Testing Registration Rejection on Invalid ADMIN_SETUP_KEY...');
  const res2 = await fetch(`${BASE_URL}/api/admin/register-device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password: PASSWORD,
      deviceName: 'Attacker Machine',
      setupKey: 'invalid-fake-key-999'
    })
  });
  assert(res2.status === 404, 'Invalid Setup Key Concealment', `Expected 404, got HTTP ${res2.status}`);

  // -----------------------------------------------------------------
  // 3. SUCCESSFUL REGISTRATION WITH ADMIN_SETUP_KEY & PASSWORD
  // -----------------------------------------------------------------
  console.log('\n>>> Step 3: Registering Authorized Trusted Device...');
  const fingerprint = {
    platform: 'Win32',
    timezone: 'Asia/Kolkata',
    screen: '1920x1080x24',
    language: 'en-US'
  };

  const res3 = await fetch(`${BASE_URL}/api/admin/register-device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password: PASSWORD,
      deviceName: "Vedant's Authorized Workstation",
      setupKey: SETUP_KEY,
      fingerprint
    })
  });
  const data3 = await res3.json();
  const cookies3 = parseCookiesFromRes(res3);
  const deviceToken = cookies3['admin_device_token'];
  const deviceSecret = data3.deviceSecret;
  const rawSetCookie = res3.headers.get('set-cookie') || '';

  assert(
    res3.status === 200 && 
    deviceToken && 
    deviceSecret && 
    deviceToken.startsWith(deviceSecret + '.') &&
    rawSetCookie.includes('Max-Age=15552000'),
    'Device Binding Succeeded with 180-Day Signed Cookie',
    `Signed token & raw secret generated (Cookie: Max-Age=15552000)`
  );

  // Verify security headers
  const cspHeader = res3.headers.get('content-security-policy');
  const xfoHeader = res3.headers.get('x-frame-options');
  const hstsHeader = res3.headers.get('strict-transport-security');
  assert(
    xfoHeader === 'DENY' && cspHeader && hstsHeader,
    'Strict Security Headers Attached',
    `X-Frame-Options: ${xfoHeader}, CSP: present, HSTS: present`
  );

  // Verify DB stores only hash, never raw token
  const storeCheck = JSON.parse(fs.readFileSync(DATA_STORE_PATH, 'utf-8'));
  const primaryDev = storeCheck.adminDevice;
  const rawHash = crypto.createHash('sha256').update(deviceSecret).digest('hex');
  assert(
    primaryDev.tokenHash === rawHash && !JSON.stringify(storeCheck).includes(deviceSecret),
    'Cryptographic Token Hashing in DB',
    'Store contains ONLY SHA-256 hash, raw secret never persisted in DB'
  );

  // -----------------------------------------------------------------
  // 4. PERMANENT LOCKOUT OF SETUP MODE AFTER INITIAL REGISTRATION
  // -----------------------------------------------------------------
  console.log('\n>>> Step 4: Testing Setup Mode Permanent Closure...');
  const res4 = await fetch(`${BASE_URL}/api/admin/register-device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password: PASSWORD,
      deviceName: 'Second Device Attempt',
      setupKey: SETUP_KEY
    })
  });
  assert(res4.status === 404, 'Setup Mode Permanently Closed (404 Concealment)', `Expected 404, got HTTP ${res4.status}`);

  // Also test alias /api/admin/setup
  const res4b = await fetch(`${BASE_URL}/api/admin/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password: PASSWORD,
      deviceName: 'Alias Setup Attempt',
      setupKey: SETUP_KEY
    })
  });
  assert(res4b.status === 404, 'Setup Alias Route /api/admin/setup Closed (404)', `Expected 404, got HTTP ${res4b.status}`);

  // -----------------------------------------------------------------
  // 5. UNREGISTERED / UNTRUSTED DEVICE CONCEALMENT (HTTP 404)
  // -----------------------------------------------------------------
  console.log('\n>>> Step 5: Testing Concealment (HTTP 404) for Unregistered Devices...');
  
  // 5.1 device-status returns 404 without valid cookie/header
  const res5a = await fetch(`${BASE_URL}/api/admin/device-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  assert(res5a.status === 404, 'Unregistered Device -> /device-status Concealed (404)', `Got HTTP ${res5a.status}`);

  // 5.2 login returns 404 without valid device token (even with correct password!)
  const res5b = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD })
  });
  assert(res5b.status === 404, 'Unregistered Device -> /login Concealed (404)', `Got HTTP ${res5b.status}`);

  // 5.3 Protected admin routes return 404
  const res5c = await fetch(`${BASE_URL}/api/admin/logs`, { method: 'GET' });
  assert(res5c.status === 404, 'Unregistered Device -> /logs Concealed (404)', `Got HTTP ${res5c.status}`);

  const res5d = await fetch(`${BASE_URL}/api/admin/settings`, { method: 'GET' });
  assert(res5d.status === 404, 'Unregistered Device -> /settings Concealed (404)', `Got HTTP ${res5d.status}`);

  // 5.4 Web reset route returns 404
  const res5e = await fetch(`${BASE_URL}/api/admin/reset-device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD })
  });
  assert(res5e.status === 404, 'Web Reset Route Disabled (404)', `Got HTTP ${res5e.status}`);

  // 5.5 Spoofed / Tampered Cookie Signature returns 404
  const spoofedCookie = `${deviceSecret}.tampered_signature_attacker_hex`;
  const res5f = await fetch(`${BASE_URL}/api/admin/device-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `admin_device_token=${spoofedCookie}`,
      'x-device-factor': deviceSecret
    },
    body: JSON.stringify({ fingerprint })
  });
  assert(res5f.status === 404, 'Tampered / Spoofed Cookie Signature Concealed (404)', `Got HTTP ${res5f.status}`);

  // -----------------------------------------------------------------
  // 6. LOGIN FROM BOUND TRUSTED WORKSTATION
  // -----------------------------------------------------------------
  console.log('\n>>> Step 6: Testing Authentication from Trusted Workstation...');

  // 6.1 Trusted device status passes
  const res6a = await fetch(`${BASE_URL}/api/admin/device-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `admin_device_token=${deviceToken}`,
      'x-device-factor': deviceSecret
    },
    body: JSON.stringify({ fingerprint })
  });
  const data6a = await res6a.json();
  assert(res6a.status === 200 && data6a.isThisDeviceTrusted === true, 
    'Trusted Device Verified by Status Check', `Device: ${data6a.deviceName}`);

  // 6.2 Wrong password on trusted device returns 401 (NOT 404, because device is recognized)
  const res6b = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `admin_device_token=${deviceToken}`,
      'x-device-factor': deviceSecret
    },
    body: JSON.stringify({ password: 'wrong-password-123', fingerprint })
  });
  const data6b = await res6b.json();
  assert(res6b.status === 401 && data6b.attemptsRemaining !== undefined, 
    'Trusted Device Wrong Password -> 401 with Attempts Remaining', `Attempts left: ${data6b.attemptsRemaining}`);

  // 6.3 Correct password login succeeds and issues 2-hour JWT session
  const res6c = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `admin_device_token=${deviceToken}`,
      'x-device-factor': deviceSecret
    },
    body: JSON.stringify({ password: PASSWORD, fingerprint })
  });
  const data6c = await res6c.json();
  const cookies6c = parseCookiesFromRes(res6c);
  const sessionJwt = cookies6c['admin_session'];
  const activeCsrf = cookies6c['admin_csrf'] || data6c.csrfToken;
  const rawLoginSetCookie = res6c.headers.get('set-cookie') || '';

  // Decode JWT payload to verify 2-hour expiry and device binding
  let jwtPayloadValid = false;
  if (sessionJwt && sessionJwt.split('.').length === 3) {
    const payload = JSON.parse(Buffer.from(sessionJwt.split('.')[1], 'base64url').toString('utf-8'));
    jwtPayloadValid = (payload.exp - payload.iat === 7200) && (payload.deviceTokenHash === primaryDev.tokenHash);
  }

  assert(
    res6c.status === 200 && data6c.success && sessionJwt && jwtPayloadValid && rawLoginSetCookie.includes('Max-Age=7200'),
    'Trusted Device Login Issues 2-Hour JWT Session',
    `Role: ${data6c.user?.role}, JWT HS256 exp=7200s, Max-Age=7200`
  );

  // -----------------------------------------------------------------
  // 7. CSRF PROTECTION & STATE MUTATION ON PROTECTED ADMIN ENDPOINTS
  // -----------------------------------------------------------------
  console.log('\n>>> Step 7: Testing Session & CSRF Protection on Protected Endpoints...');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `admin_device_token=${deviceToken}; admin_session=${sessionJwt}; admin_csrf=${activeCsrf}`,
    'x-device-factor': deviceSecret,
    'x-csrf-token': activeCsrf
  };

  // 7.1 Fetch logs with active session
  const res7a = await fetch(`${BASE_URL}/api/admin/logs`, {
    method: 'GET',
    headers: authHeaders
  });
  const data7a = await res7a.json();
  assert(res7a.status === 200 && Array.isArray(data7a.logs), 
    'Authenticated Admin Access to /logs', `Found ${data7a.logs?.length} audit records`);

  // 7.2 State-changing action with valid CSRF succeeds
  const res7b = await fetch(`${BASE_URL}/api/admin/settings`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      judgingSettings: { negativeMarking: 0.25 }
    })
  });
  const data7b = await res7b.json();
  assert(res7b.status === 200 && data7b.judgingSettings?.negativeMarking === 0.25, 
    'State-Changing Action with Valid CSRF Succeeded');

  // 7.3 State-changing action with INVALID CSRF is rejected with 403
  const badCsrfHeaders = { ...authHeaders, 'x-csrf-token': 'fake-csrf-token-123' };
  const res7c = await fetch(`${BASE_URL}/api/admin/settings`, {
    method: 'POST',
    headers: badCsrfHeaders,
    body: JSON.stringify({
      judgingSettings: { negativeMarking: 0.5 }
    })
  });
  assert(res7c.status === 403, 'CSRF Protection Enforced', `Expected 403, got HTTP ${res7c.status}`);

  // 7.4 Tampered JWT session rejected with 401
  const badJwtHeaders = {
    ...authHeaders,
    'Cookie': `admin_device_token=${deviceToken}; admin_session=${sessionJwt}bad; admin_csrf=${activeCsrf}`
  };
  const res7d = await fetch(`${BASE_URL}/api/admin/logs`, {
    method: 'GET',
    headers: badJwtHeaders
  });
  assert(res7d.status === 401, 'Tampered Session JWT Rejected (401)', `Got HTTP ${res7d.status}`);

  // -----------------------------------------------------------------
  // 8. RATE LIMITING & LOCKOUT PERSISTENCE IN DB
  // -----------------------------------------------------------------
  console.log('\n>>> Step 8: Testing Failed Login Rate Limiting (5 Attempts -> Lockout)...');
  
  // Make 5 consecutive failed attempts to trigger lockout
  for (let i = 1; i <= 5; i++) {
    await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `admin_device_token=${deviceToken}`,
        'x-device-factor': deviceSecret
      },
      body: JSON.stringify({ password: 'bad-password', fingerprint })
    });
  }

  // 6th attempt must trigger HTTP 429 lockout
  const res8Lockout = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `admin_device_token=${deviceToken}`,
      'x-device-factor': deviceSecret
    },
    body: JSON.stringify({ password: 'bad-password', fingerprint })
  });
  const data8Lockout = await res8Lockout.json();

  // Verify rate limit record is persisted in data-store.json (survives cold starts)
  const storeWithRateLimit = JSON.parse(fs.readFileSync(DATA_STORE_PATH, 'utf-8'));
  const hasDbRateLimit = Boolean(storeWithRateLimit.adminIpRateLimits && Object.keys(storeWithRateLimit.adminIpRateLimits).length > 0);

  assert(
    res8Lockout.status === 429 && data8Lockout.error.includes('lockout') && hasDbRateLimit,
    'Rate Limiting & Lockout Triggers after 5 Failed Logins (Stored in DB)',
    `Status: ${res8Lockout.status}, Lockout error: "${data8Lockout.error?.substring(0, 30)}...", DB persisted: ${hasDbRateLimit}`
  );

  // -----------------------------------------------------------------
  // 9. LOGOUT ENDPOINT REVOKES SESSION & CLEARS COOKIES
  // -----------------------------------------------------------------
  console.log('\n>>> Step 9: Testing Logout Session Revocation...');
  
  // Clear rate limit temporarily in DB so we can test logout with fresh session
  storeWithRateLimit.adminIpRateLimits = {};
  fs.writeFileSync(DATA_STORE_PATH, JSON.stringify(storeWithRateLimit, null, 2), 'utf-8');

  // Re-login to get active session
  const resLoginAgain = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `admin_device_token=${deviceToken}`,
      'x-device-factor': deviceSecret
    },
    body: JSON.stringify({ password: PASSWORD, fingerprint })
  });
  const cookiesAgain = parseCookiesFromRes(resLoginAgain);
  const freshSessionJwt = cookiesAgain['admin_session'];
  const freshCsrf = cookiesAgain['admin_csrf'];

  // Call logout endpoint
  const resLogout = await fetch(`${BASE_URL}/api/admin/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `admin_device_token=${deviceToken}; admin_session=${freshSessionJwt}; admin_csrf=${freshCsrf}`,
      'x-device-factor': deviceSecret,
      'x-csrf-token': freshCsrf
    }
  });
  const logoutSetCookie = resLogout.headers.get('set-cookie') || '';
  assert(
    resLogout.status === 200 && logoutSetCookie.includes('Max-Age=0'),
    'Admin Logout Revokes Session & Clears Cookies',
    `Status: ${resLogout.status}, Set-Cookie cleared with Max-Age=0`
  );

  // -----------------------------------------------------------------
  // 10. PUBLIC STUDENT ROUTE INTEGRITY (UNBROKEN)
  // -----------------------------------------------------------------
  console.log('\n>>> Step 10: Verifying Public Student Routes Remain Fully Functional...');
  const res10a = await fetch(`${BASE_URL}/api/certificates/public-settings`, { method: 'GET' });
  assert(res10a.status === 200, 'Public Certificate Settings Accessible (HTTP 200)');

  const res10b = await fetch(`${BASE_URL}/api/proctoring/status?userId=student-test-1&day=1`, { method: 'GET' });
  assert(res10b.status === 200, 'Public Proctoring Status Endpoint Accessible (HTTP 200)');

  // -----------------------------------------------------------------
  // 11. CLI RECOVERY RE-VERIFICATION
  // -----------------------------------------------------------------
  console.log('\n>>> Step 11: Testing CLI Recovery Script Security...');
  try {
    execSync(`node scripts/resetAdminDevice.js --setup-key=wrong-key`, { stdio: 'pipe' });
    assert(false, 'CLI Recovery rejected with wrong key');
  } catch (err) {
    assert(err.status === 1, 'CLI Recovery Rejects Unauthorized Invocation (Exit Code 1)');
  }

  // Final CLI recovery resets state
  try {
    const finalReset = execSync(`node scripts/resetAdminDevice.js --setup-key=${SETUP_KEY}`, { encoding: 'utf-8' });
    assert(finalReset.includes('[SUCCESS]'), 'CLI Recovery Successfully Resets Environment');
  } catch (e) {
    assert(false, 'Final CLI reset failed', e.message);
  }

  // Final summary
  console.log('\n===============================================================');
  console.log(` RESULTS: ${passedCount} / ${totalTests} TESTS PASSED (${((passedCount/totalTests)*100).toFixed(0)}%)`);
  console.log('===============================================================\n');

  if (passedCount === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
