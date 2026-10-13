import { 
  saveDeviceSecretToIndexedDB, 
  getDeviceSecretFromIndexedDB, 
  clearDeviceSecretFromIndexedDB, 
  collectDeviceFingerprint,
  setAdminCsrfToken,
  getAdminCsrfToken
} from '../utils/deviceSecurity';

/**
 * Client API Service for Shared Database Sync, Student Auth, Submissions, Leaderboard,
 * Admin Device Lock & Proctoring Auto-Exit Enforcement
 * Sir Visvesvaraya Institute of Technology (SVIT), Nashik
 */

/**
 * Canonical API Base URL:
 * Ensures that even if a user accesses the secondary Vercel deployment (technova-code-sprint.vercel.app),
 * all student/leaderboard/submission API requests hit the single canonical production backend
 * (https://technova-code-sprint-tq2j.vercel.app) so every device shares one backend.
 */
export function getApiBaseUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    if (host === 'technova-code-sprint.vercel.app') {
      return 'https://technova-code-sprint-tq2j.vercel.app';
    }
  }
  return '';
}

function apiUrl(path) {
  return `${getApiBaseUrl()}${path}`;
}

async function getAdminHeaders(extraHeaders = {}) {
  const secret = await getDeviceSecretFromIndexedDB();
  const csrf = getAdminCsrfToken();
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders
  };
  if (secret) headers['x-device-factor'] = secret;
  if (csrf) headers['x-csrf-token'] = csrf;
  return headers;
}

export async function checkAdminDeviceStatus() {
  try {
    const fingerprint = collectDeviceFingerprint();
    const headers = await getAdminHeaders();
    const res = await fetch('/api/admin/device-status', {
      method: 'POST',
      headers,
      body: JSON.stringify({ fingerprint }),
      credentials: 'same-origin'
    });
    if (res.status === 404) {
      return {
        isRegistered: true,
        isThisDeviceTrusted: false,
        notFound: true,
        error: "Not found"
      };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("API checkAdminDeviceStatus warning:", err);
    return {
      isRegistered: true,
      isThisDeviceTrusted: false,
      notFound: true,
      error: err.message
    };
  }
}

export async function registerAdminDevice(password, deviceName = '', setupKey = '') {
  try {
    const fingerprint = collectDeviceFingerprint();
    const res = await fetch('/api/admin/register-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, deviceName, setupKey, fingerprint }),
      credentials: 'same-origin'
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || `HTTP ${res.status}`, notFound: res.status === 404 };
    }
    if (data.deviceSecret) {
      await saveDeviceSecretToIndexedDB(data.deviceSecret);
    }
    if (data.csrfToken) {
      setAdminCsrfToken(data.csrfToken);
    }
    return { success: true, ...data };
  } catch (err) {
    return { success: false, error: err.message || "Network request failed" };
  }
}

export async function loginAdminWithEmailAndPassword(email, password) {
  try {
    const fingerprint = collectDeviceFingerprint();
    const headers = await getAdminHeaders();
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: email.trim().toLowerCase(), password, fingerprint }),
      credentials: 'same-origin'
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: data.error || "Authentication failed. Invalid administrator credentials.",
        attemptsRemaining: data.attemptsRemaining
      };
    }
    if (data.csrfToken) {
      setAdminCsrfToken(data.csrfToken);
    }
    return { success: true, ...data };
  } catch (err) {
    return { success: false, error: err.message || "Network request failed" };
  }
}

export async function checkAdminSession() {
  try {
    const res = await fetch('/api/admin/session', {
      method: 'GET',
      credentials: 'same-origin'
    });
    if (!res.ok) return { authenticated: false };
    const data = await res.json();
    return data;
  } catch (err) {
    return { authenticated: false, error: err.message };
  }
}

export async function logoutAdminApi() {
  try {
    const headers = await getAdminHeaders();
    const res = await fetch('/api/admin/logout', {
      method: 'POST',
      headers,
      credentials: 'same-origin'
    });
    clearDeviceSecretFromIndexedDB().catch(() => {});
    return res.ok;
  } catch (err) {
    return false;
  }
}

export async function loginAdminWithPassword(password) {
  try {
    const fingerprint = collectDeviceFingerprint();
    const headers = await getAdminHeaders();
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ password, fingerprint }),
      credentials: 'same-origin'
    });
    if (res.status === 404) {
      return {
        success: false,
        notFound: true,
        error: "Not found"
      };
    }
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.error || "Authentication failed. Invalid credentials or unauthorized device.",
        attemptsRemaining: data.attemptsRemaining
      };
    }
    if (data.csrfToken) {
      setAdminCsrfToken(data.csrfToken);
    }
    return { success: true, ...data };
  } catch (err) {
    return { success: false, error: err.message || "Network request failed" };
  }
}

export async function fetchAdminLogs() {
  try {
    const headers = await getAdminHeaders();
    const res = await fetch('/api/admin/logs', {
      method: 'GET',
      headers,
      credentials: 'same-origin'
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("fetchAdminLogs error:", err);
    return null;
  }
}

export async function resetAdminDevice(password) {
  return { 
    success: false, 
    error: "Web-based unbinding is disabled for security. Use the server recovery command: npm run admin:reset-device" 
  };
}

export async function fetchExamSettings() {
  try {
    const headers = await getAdminHeaders();
    const res = await fetch('/api/admin/settings', {
      method: 'GET',
      headers,
      credentials: 'same-origin'
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function saveExamSettings(payload) {
  try {
    const headers = await getAdminHeaders();
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      credentials: 'same-origin'
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true, ...data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function reportProctoringExit(exitData) {
  try {
    const res = await fetch(apiUrl('/api/proctoring/exit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exitData)
    });
    return await res.json();
  } catch (err) {
    console.warn("reportProctoringExit warning:", err);
    return { success: false, locked: true };
  }
}

export async function checkProctoringStatus(userId, day, testType = 'all') {
  try {
    const res = await fetch(apiUrl('/api/proctoring/status'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, day, testType })
    });
    if (!res.ok) return { isLockedOut: false };
    return await res.json();
  } catch (err) {
    return { isLockedOut: false };
  }
}

export async function verifySubmissionAllowed(userId, day, testType = 'all', sessionToken = null, fingerprint = null) {
  try {
    const res = await fetch(apiUrl('/api/proctoring/verify-submission'), {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(sessionToken ? { 'x-test-session-token': sessionToken } : {})
      },
      body: JSON.stringify({ userId, day, testType, sessionToken, fingerprint })
    });
    const data = await res.json();
    if (!res.ok) {
      return { allowed: false, error: data.error, exitRecord: data.exitRecord };
    }
    return { allowed: true };
  } catch (err) {
    // If network drop, client proctoring lock in localStorage is authoritative
    return { allowed: true };
  }
}

export async function verifyBrowserIntegrityApi(payload) {
  try {
    const res = await fetch(apiUrl('/api/proctoring/verify-browser'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      return { allowed: false, reason: data.reason || `HTTP ${res.status}`, signals: data.signals || [] };
    }
    return data;
  } catch (err) {
    return { allowed: true, error: err.message };
  }
}

export async function submitServerConsentApi(payload) {
  try {
    const res = await fetch(apiUrl('/api/proctoring/submit-consent'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function createTestSessionApi(payload) {
  try {
    const res = await fetch(apiUrl('/api/proctoring/create-session'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }
    return data;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function sendTestHeartbeatApi(payload) {
  try {
    const res = await fetch(apiUrl('/api/proctoring/heartbeat'), {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(payload.token ? { 'x-test-session-token': payload.token } : {})
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      return { active: false, error: data.error || `HTTP ${res.status}` };
    }
    return data;
  } catch (err) {
    return { active: true, warning: 'Heartbeat network failure' };
  }
}

export async function fetchBlockedAttemptsApi() {
  try {
    const headers = await getAdminHeaders();
    const res = await fetch('/api/admin/blocked-attempts', {
      method: 'GET',
      headers,
      credentials: 'same-origin'
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.blockedAttempts || [];
  } catch (err) {
    return [];
  }
}

export async function whitelistStudentApi(payload) {
  try {
    const headers = await getAdminHeaders();
    const res = await fetch('/api/admin/whitelist-student', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      credentials: 'same-origin'
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function fetchWhitelistsApi() {
  try {
    const headers = await getAdminHeaders();
    const res = await fetch('/api/admin/whitelists', {
      method: 'GET',
      headers,
      credentials: 'same-origin'
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.whitelists || [];
  } catch (err) {
    return [];
  }
}

export async function removeWhitelistApi(userId) {
  try {
    const headers = await getAdminHeaders();
    const res = await fetch('/api/admin/remove-whitelist', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId }),
      credentials: 'same-origin'
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/* ============================================================================
 * SHARED DATABASE API CLIENT (USERS, SESSIONS, SUBMISSIONS, LEADERBOARD, SYNC)
 * ============================================================================ */

export async function fetchSharedStateApi(sessionToken = null) {
  try {
    const headers = { 'Accept': 'application/json' };
    if (sessionToken) {
      headers['x-student-session-token'] = sessionToken;
    }
    const res = await fetch(apiUrl('/api/state'), {
      method: 'GET',
      headers,
      cache: 'no-store'
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[api] fetchSharedStateApi warning:', err);
    return null;
  }
}

export async function loginOrRegisterStudentApi(payload) {
  try {
    const res = await fetch(apiUrl('/api/students/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        notFound: Boolean(data.notFound),
        requiresVerification: Boolean(data.requiresVerification),
        prn: data.prn,
        email: data.email,
        phone: data.phone,
        error: data.error || `HTTP ${res.status}`
      };
    }
    return data;
  } catch (err) {
    return { success: false, error: err.message || 'Network request failed' };
  }
}

export async function startRegistrationApi(payload) {
  try {
    const res = await fetch(apiUrl('/api/auth/register/start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: data.error || `HTTP ${res.status}`,
        fieldErrors: data.fieldErrors || {},
        retryAfterSeconds: data.retryAfterSeconds
      };
    }
    return data;
  } catch (err) {
    return { success: false, error: err.message || 'Network request failed' };
  }
}

export async function resendOtpApi(payload) {
  try {
    const res = await fetch(apiUrl('/api/auth/otp/resend'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: data.error || `HTTP ${res.status}`,
        retryAfterSeconds: data.retryAfterSeconds
      };
    }
    return data;
  } catch (err) {
    return { success: false, error: err.message || 'Network request failed' };
  }
}

export async function verifyEmailOtpApi(payload) {
  try {
    const res = await fetch(apiUrl('/api/auth/otp/verify-email'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: data.error || `HTTP ${res.status}`,
        expired: Boolean(data.expired),
        attemptsRemaining: data.attemptsRemaining,
        maxAttemptsReached: Boolean(data.maxAttemptsReached)
      };
    }
    return data;
  } catch (err) {
    return { success: false, error: err.message || 'Network request failed' };
  }
}

export async function verifyPhoneOtpApi(payload) {
  try {
    const res = await fetch(apiUrl('/api/auth/otp/verify-phone'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: data.error || `HTTP ${res.status}`,
        expired: Boolean(data.expired),
        attemptsRemaining: data.attemptsRemaining
      };
    }
    return data;
  } catch (err) {
    return { success: false, error: err.message || 'Network request failed' };
  }
}

export async function fetchAdminRegistrationsApi() {
  try {
    const headers = await getAdminHeaders();
    const res = await fetch('/api/admin/registrations', {
      method: 'GET',
      headers,
      credentials: 'same-origin',
      cache: 'no-store'
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[api] fetchAdminRegistrationsApi warning:', err);
    return null;
  }
}

export async function adminRegistrationActionApi(payload) {
  try {
    const headers = await getAdminHeaders();
    const res = await fetch('/api/admin/registrations/action', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      credentials: 'same-origin'
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }
    return data;
  } catch (err) {
    return { success: false, error: err.message || 'Network request failed' };
  }
}

export async function logoutStudentApi(sessionToken) {
  try {
    const res = await fetch(apiUrl('/api/students/logout'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { 'x-student-session-token': sessionToken } : {})
      },
      body: JSON.stringify({ sessionToken })
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

export async function submitTaskSolutionApi(submission, sessionToken = null) {
  try {
    const res = await fetch(apiUrl('/api/submissions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { 'x-student-session-token': sessionToken } : {})
      },
      body: JSON.stringify({ submission })
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }
    return data;
  } catch (err) {
    return { success: false, error: err.message || 'Network request failed' };
  }
}

export async function fetchLeaderboardApi(track = 'All', search = '') {
  try {
    const params = new URLSearchParams();
    if (track && track !== 'All') params.set('track', track);
    if (search) params.set('search', search);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(apiUrl(`/api/leaderboard${query}`), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function syncLocalBrowserDataApi(payload) {
  try {
    const res = await fetch(apiUrl('/api/sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[api] syncLocalBrowserDataApi warning:', err);
    return null;
  }
}

