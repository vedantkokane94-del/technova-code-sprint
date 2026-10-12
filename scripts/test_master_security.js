/**
 * TECHNOVA CODE SPRINT - MASTER SECURITY AUTOMATED TEST SUITE
 * Sir Visvesvaraya Institute of Technology (SVIT), Nashik
 * 
 * Verifies all 25 mandatory security, authentication, authorization, and regression scenarios:
 * - Scenarios 1-10: Authentication Verification
 * - Scenarios 11-18: Authorization Enforcement
 * - Scenarios 19-25: Public Regression & Fail-Closed Behavior
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createApiMiddleware, getStore, saveStore } from '../server/apiMiddleware.js';

const TEST_PORT = 5988;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'technicalteamsvit@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'BuildLearn@SVIT#9Q';
const INVALID_PASSWORD = 'wrong-password-999';
const INVALID_EMAIL = 'attacker@external-domain.com';

let totalTests = 0;
let passedTests = 0;
const results = [];

function assert(condition, testId, title, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    results.push({ id: testId, title, status: 'PASS', details });
    console.log(`  [PASS] Test ${testId}: ${title} ${details ? '(' + details + ')' : ''}`);
  } else {
    results.push({ id: testId, title, status: 'FAIL', details });
    console.error(`  [FAIL] Test ${testId}: ${title} - FAILED! ${details ? '(' + details + ')' : ''}`);
  }
}

async function runAllSecurityTests() {
  console.log('\n===============================================================');
  console.log(' TECHNOVA SVIT: 25-POINT MASTER SECURITY AUTOMATED TEST SUITE');
  console.log('===============================================================\n');

  // Initialize in-memory test HTTP server with apiMiddleware
  const handler = createApiMiddleware();
  const server = http.createServer((req, res) => {
    return handler(req, res, () => {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    });
  });

  await new Promise(resolve => server.listen(TEST_PORT, '127.0.0.1', resolve));

  // Reset rate limits and sessions before starting test suite
  const store = getStore();
  store.adminSessions = [];
  store.adminIpRateLimits = {};
  store.adminRateLimit = { failedAttempts: 0, lockedUntil: 0 };
  saveStore(store);

  let validSessionCookie = '';
  let validCsrfToken = '';

  try {
    // -------------------------------------------------------------
    // GROUP 1: AUTHENTICATION TESTS (Scenarios 1 - 10)
    // -------------------------------------------------------------
    console.log('>>> Group 1: Authentication Tests (Scenarios 1-10)...');

    // Scenario 1: Correct credentials allow login and issue short-lived session
    const res1 = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    const data1 = await res1.json();
    const setCookie1 = res1.headers.get('set-cookie') || '';
    validSessionCookie = setCookie1;
    validCsrfToken = data1.csrfToken || '';

    assert(
      res1.status === 200 && data1.success === true && data1.user?.email === ADMIN_EMAIL && setCookie1.includes('admin_session='),
      1,
      'Correct credentials for authorized admin allow login',
      `Status: ${res1.status}, Email: ${data1.user?.email}`
    );

    // Scenario 2: Incorrect password is rejected
    const res2 = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: INVALID_PASSWORD })
    });
    const data2 = await res2.json();
    assert(
      res2.status === 401 && data2.error.includes('Authentication failed'),
      2,
      'Incorrect password is rejected with generic error',
      `Status: ${res2.status}, Error: "${data2.error}"`
    );

    // Scenario 3: Incorrect email is rejected without account enumeration
    const res3 = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: INVALID_EMAIL, password: ADMIN_PASSWORD })
    });
    const data3 = await res3.json();
    assert(
      res3.status === 401 && data3.error === data2.error,
      3,
      'Incorrect email rejected with identical generic message (no enumeration)',
      `Status: ${res3.status}, Uniform message: "${data3.error}"`
    );

    // Scenario 4: Normal authenticated student account cannot access admin endpoints
    const res4 = await fetch(`${BASE_URL}/api/admin/settings`, {
      method: 'GET',
      headers: {
        'Cookie': 'student_session=student-user-1234; role=student;'
      }
    });
    assert(
      res4.status === 401 || res4.status === 404,
      4,
      'Normal student/unprivileged account denied administrative access',
      `Status: ${res4.status}`
    );

    // Scenario 5: Unauthenticated visitor cannot open protected admin endpoints
    const res5 = await fetch(`${BASE_URL}/api/admin/logs`, {
      method: 'GET'
    });
    assert(
      res5.status === 401 || res5.status === 404,
      5,
      'Unauthenticated visitor denied access to admin endpoints',
      `Status: ${res5.status}`
    );

    // Scenario 6: Logging out invalidates the session on server & clears cookies
    const res6 = await fetch(`${BASE_URL}/api/admin/logout`, {
      method: 'POST',
      headers: {
        'Cookie': validSessionCookie,
        'x-csrf-token': validCsrfToken
      }
    });
    const setCookie6 = res6.headers.get('set-cookie') || '';
    assert(
      res6.status === 200 && setCookie6.includes('Max-Age=0'),
      6,
      'Logging out invalidates session and clears HttpOnly cookies',
      `Status: ${res6.status}, Set-Cookie cleared: ${setCookie6.includes('Max-Age=0')}`
    );

    // Scenario 7: Expired or invalid sessions are rejected
    const res7 = await fetch(`${BASE_URL}/api/admin/session`, {
      method: 'GET',
      headers: { 'Cookie': validSessionCookie }
    });
    assert(
      res7.status === 401,
      7,
      'Previously logged-out session rejected upon reuse',
      `Status: ${res7.status}`
    );

    // Scenario 8: Tampered client-side JWT or identity information rejected
    const tamperedJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImVtcHR5Ijp0cnVlfQ.fakeSignature123';
    const res8 = await fetch(`${BASE_URL}/api/admin/session`, {
      method: 'GET',
      headers: { 'Cookie': `admin_session=${tamperedJwt}` }
    });
    assert(
      res8.status === 401,
      8,
      'Tampered client-side JWT signature rejected',
      `Status: ${res8.status}`
    );

    // Re-login to get fresh session for subsequent checks
    const freshLogin = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    const freshData = await freshLogin.json();
    validSessionCookie = freshLogin.headers.get('set-cookie') || '';
    validCsrfToken = freshData.csrfToken || '';

    // Scenario 9: Repeated failed logins trigger progressive rate limiting
    let lockoutTriggered = false;
    for (let i = 0; i < 6; i++) {
      const rlRes = await fetch(`${BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: 'wrong-attempt' })
      });
      if (rlRes.status === 429) {
        lockoutTriggered = true;
        break;
      }
    }
    assert(
      lockoutTriggered,
      9,
      'Repeated failed logins trigger server-side 429 rate limiting',
      'Lockout status 429 enforced'
    );

    // Scenario 10: Passwords, hashes, and secrets never leaked in responses or logs
    const testStore = getStore();
    const logDump = JSON.stringify(testStore.adminLoginLogs || []);
    const secretsLeaked = logDump.includes(ADMIN_PASSWORD) || 
                          logDump.includes(process.env.ADMIN_PASSWORD_HASH || '') ||
                          logDump.includes(process.env.SESSION_SECRET || '');
    assert(
      !secretsLeaked,
      10,
      'Passwords, hashes, and secrets never appear in logs or responses',
      'Zero credentials leaked in logs'
    );

    // Reset rate limit for authorization tests
    const s2 = getStore();
    s2.adminIpRateLimits = {};
    saveStore(s2);

    // -------------------------------------------------------------
    // GROUP 2: AUTHORIZATION TESTS (Scenarios 11 - 18)
    // -------------------------------------------------------------
    console.log('\n>>> Group 2: Authorization Tests (Scenarios 11-18)...');

    // Fresh login after lockout reset
    const adminLogin2 = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    const adminData2 = await adminLogin2.json();
    validSessionCookie = adminLogin2.headers.get('set-cookie') || '';
    validCsrfToken = adminData2.csrfToken || '';

    // Scenario 11: Every administrative API rejects unauthorized requests
    const unauthLogs = await fetch(`${BASE_URL}/api/admin/logs`);
    const unauthWhitelists = await fetch(`${BASE_URL}/api/admin/whitelists`);
    assert(
      (unauthLogs.status === 401 || unauthLogs.status === 404) &&
      (unauthWhitelists.status === 401 || unauthWhitelists.status === 404),
      11,
      'Every administrative API endpoint rejects unauthorized requests',
      `Logs: ${unauthLogs.status}, Whitelists: ${unauthWhitelists.status}`
    );

    // Scenario 12: Direct API requests cannot bypass access restrictions
    const directApiRes = await fetch(`${BASE_URL}/api/certificates`, {
      method: 'GET'
    });
    assert(
      directApiRes.status === 403,
      12,
      'Direct API requests cannot bypass backend access restrictions',
      `Status: ${directApiRes.status} (Forbidden)`
    );

    // Scenario 13: Read-only vs write operations enforce permissions and authentication
    const authReadRes = await fetch(`${BASE_URL}/api/admin/settings`, {
      method: 'GET',
      headers: { 'Cookie': validSessionCookie }
    });
    assert(
      authReadRes.status === 200,
      13,
      'Authenticated admin read operation permitted',
      `Status: ${authReadRes.status}`
    );

    // Scenario 14: Unauthorized changes to administrative data rejected
    const unauthMutate = await fetch(`${BASE_URL}/api/admin/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ judgingSettings: { negativeMarking: 5 } })
    });
    assert(
      unauthMutate.status === 401 || unauthMutate.status === 404,
      14,
      'Unauthorized changes to admin settings rejected',
      `Status: ${unauthMutate.status}`
    );

    // Scenario 15: Database permissions prevent unauthorized access
    const unauthCertGen = await fetch(`${BASE_URL}/api/certificates/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName: 'Attacker' })
    });
    assert(
      unauthCertGen.status === 403,
      15,
      'Certificate generation protected by server authorization boundary',
      `Status: ${unauthCertGen.status}`
    );

    // Scenario 16: Participant information returned only to authorized callers
    const authCertList = await fetch(`${BASE_URL}/api/certificates`, {
      method: 'GET',
      headers: { 'Cookie': validSessionCookie }
    });
    const certListData = await authCertList.json();
    assert(
      authCertList.status === 200 && Array.isArray(certListData.certificates),
      16,
      'Participant details returned strictly to authorized callers',
      `Status: ${authCertList.status}, Records returned: ${certListData.certificates.length}`
    );

    // Scenario 17: Invalid inputs and malformed payloads handled safely
    const malformedRes = await fetch(`${BASE_URL}/api/admin/whitelist-student`, {
      method: 'POST',
      headers: {
        'Cookie': validSessionCookie,
        'x-csrf-token': validCsrfToken,
        'Content-Type': 'application/json'
      },
      body: '{"invalidJson": true,,}'
    });
    assert(
      malformedRes.status < 500,
      17,
      'Malformed payload handled safely without process crash (5xx avoided)',
      `Status: ${malformedRes.status}`
    );

    // Scenario 18: Cross-origin state-changing requests require CSRF token
    const csrfFailRes = await fetch(`${BASE_URL}/api/admin/settings`, {
      method: 'POST',
      headers: {
        'Cookie': validSessionCookie,
        'Content-Type': 'application/json'
        // x-csrf-token omitted intentionally
      },
      body: JSON.stringify({ judgingSettings: { passMark: 60 } })
    });
    assert(
      csrfFailRes.status === 403,
      18,
      'State-changing administrative mutations enforce CSRF token validation',
      `Status: ${csrfFailRes.status} (CSRF Rejected)`
    );

    // -------------------------------------------------------------
    // GROUP 3: REGRESSION & COMPATIBILITY TESTS (Scenarios 19 - 25)
    // -------------------------------------------------------------
    console.log('\n>>> Group 3: Regression & Fail-Closed Tests (Scenarios 19-25)...');

    // Scenario 19: Public certificate settings endpoint accessible without authentication
    const publicSettingsRes = await fetch(`${BASE_URL}/api/certificates/public-settings`);
    assert(
      publicSettingsRes.status === 200,
      19,
      'Public event and certificate settings remain accessible to visitors',
      `Status: ${publicSettingsRes.status}`
    );

    // Scenario 20: Public verification endpoint functions correctly
    const publicVerifyRes = await fetch(`${BASE_URL}/api/certificates/verify/CERT-2026-NONEXISTENT`);
    const verifyData = await publicVerifyRes.json();
    assert(
      publicVerifyRes.status === 404 && verifyData.status === 'not_found',
      20,
      'Public certificate verification endpoint operational without authentication (returns structured 404)',
      `Status: ${publicVerifyRes.status}, Cert status: "${verifyData.status}"`
    );

    // Scenario 21: Proctoring browser verification endpoint accessible to students
    const proctorVerifyRes = await fetch(`${BASE_URL}/api/proctoring/verify-browser`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        browserName: 'chrome',
        browserVersion: '120.0.0.0',
        platform: 'Win32'
      })
    });
    assert(
      proctorVerifyRes.status === 200,
      21,
      'Public student browser pre-check gate remains functional',
      `Status: ${proctorVerifyRes.status}`
    );

    // Scenario 22: Production build artifacts exist and are non-empty
    const distIndexPath = path.resolve(process.cwd(), 'dist', 'index.html');
    const distExists = fs.existsSync(distIndexPath) && fs.statSync(distIndexPath).size > 100;
    assert(
      distExists,
      22,
      'Production build bundle exists and verified non-empty',
      `dist/index.html size: ${distExists ? fs.statSync(distIndexPath).size : 0} bytes`
    );

    // Scenario 23: Protected admin data not leaked in public responses
    const publicProbe = await fetch(`${BASE_URL}/api/proctoring/status?userId=student1`);
    const probeBody = await publicProbe.text();
    const noAdminLeaked = !probeBody.includes('adminSessions') && !probeBody.includes('adminPasswordHash');
    assert(
      noAdminLeaked,
      23,
      'Protected administrative data omitted from student public responses',
      'No session/admin leaks detected'
    );

    // Scenario 24: Missing authentication configuration fails closed
    const prevEnvHash = process.env.ADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_PASSWORD_HASH;
    const failClosedRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    process.env.ADMIN_PASSWORD_HASH = prevEnvHash; // restore
    assert(
      failClosedRes.status === 401,
      24,
      'Missing or unconfigured password hash fails closed (denies access)',
      `Status: ${failClosedRes.status}`
    );

    // Scenario 25: Security headers attached to administrative API responses
    const secHeadersRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    const xFrame = secHeadersRes.headers.get('x-frame-options');
    const xContent = secHeadersRes.headers.get('x-content-type-options');
    const csp = secHeadersRes.headers.get('content-security-policy');
    assert(
      xFrame === 'DENY' && xContent === 'nosniff' && Boolean(csp),
      25,
      'Strict security headers (X-Frame-Options, X-Content-Type-Options, CSP) enforced',
      `X-Frame: ${xFrame}, nosniff: ${xContent}`
    );

  } finally {
    server.close();
  }

  console.log('\n===============================================================');
  console.log(` RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log('===============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllSecurityTests().catch(err => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
