import { 
  saveDeviceSecretToIndexedDB, 
  getDeviceSecretFromIndexedDB, 
  clearDeviceSecretFromIndexedDB, 
  collectDeviceFingerprint,
  setAdminCsrfToken,
  getAdminCsrfToken
} from '../utils/deviceSecurity';

/**
 * Client API Service for Admin Device Lock & Proctoring Auto-Exit Enforcement
 * Sir Visvesvaraya Institute of Technology (SVIT), Nashik
 */

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
    const res = await fetch('/api/proctoring/exit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exitData),
      credentials: 'same-origin'
    });
    return await res.json();
  } catch (err) {
    console.warn("reportProctoringExit warning:", err);
    return { success: false, locked: true };
  }
}

export async function checkProctoringStatus(userId, day, testType = 'all') {
  try {
    const res = await fetch('/api/proctoring/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, day, testType }),
      credentials: 'same-origin'
    });
    if (!res.ok) return { isLockedOut: false };
    return await res.json();
  } catch (err) {
    return { isLockedOut: false };
  }
}

export async function verifySubmissionAllowed(userId, day, testType = 'all', sessionToken = null, fingerprint = null) {
  try {
    const res = await fetch('/api/proctoring/verify-submission', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(sessionToken ? { 'x-test-session-token': sessionToken } : {})
      },
      body: JSON.stringify({ userId, day, testType, sessionToken, fingerprint }),
      credentials: 'same-origin'
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
    const res = await fetch('/api/proctoring/verify-browser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin'
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
    const res = await fetch('/api/proctoring/submit-consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin'
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function createTestSessionApi(payload) {
  try {
    const res = await fetch('/api/proctoring/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin'
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
    const res = await fetch('/api/proctoring/heartbeat', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(payload.token ? { 'x-test-session-token': payload.token } : {})
      },
      body: JSON.stringify(payload),
      credentials: 'same-origin'
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
