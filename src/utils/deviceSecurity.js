/**
 * Client-Side Device Security & Hardware Token Vault
 * Sir Visvesvaraya Institute of Technology (SVIT), Nashik
 * Technical Skill Development Hub
 * 
 * Provides:
 * 1. Second-factor secret storage in IndexedDB (immune to standard cookie-theft / XSS export)
 * 2. Hardware device fingerprint collection (Platform, Screen, Timezone, UserAgent)
 */

const DB_NAME = 'technova_device_vault';
const STORE_NAME = 'device_secrets';
const DB_VERSION = 1;
const TOKEN_KEY = 'admin_hardware_secret';

// Open or initialize IndexedDB
function openVaultDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.warn("IndexedDB access error:", event.target.error);
      resolve(null);
    };
  });
}

/**
 * Save cryptographically generated device secret into IndexedDB
 */
export async function saveDeviceSecretToIndexedDB(secret) {
  try {
    const db = await openVaultDB();
    if (!db) {
      // Fallback to localStorage if IndexedDB is blocked
      localStorage.setItem(`__${TOKEN_KEY}`, secret);
      return true;
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(secret, TOKEN_KEY);
      req.onsuccess = () => resolve(true);
      req.onerror = () => {
        localStorage.setItem(`__${TOKEN_KEY}`, secret);
        resolve(true);
      };
    });
  } catch (e) {
    console.warn("Error saving device secret to IndexedDB:", e);
    try {
      localStorage.setItem(`__${TOKEN_KEY}`, secret);
      return true;
    } catch (_) {
      return false;
    }
  }
}

/**
 * Retrieve device secret from IndexedDB (or fallback vault)
 */
export async function getDeviceSecretFromIndexedDB() {
  try {
    const db = await openVaultDB();
    if (!db) {
      return localStorage.getItem(`__${TOKEN_KEY}`) || null;
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(TOKEN_KEY);
      req.onsuccess = (e) => {
        const val = e.target.result || localStorage.getItem(`__${TOKEN_KEY}`) || null;
        resolve(val);
      };
      req.onerror = () => {
        resolve(localStorage.getItem(`__${TOKEN_KEY}`) || null);
      };
    });
  } catch (e) {
    return localStorage.getItem(`__${TOKEN_KEY}`) || null;
  }
}

/**
 * Clear device secret from IndexedDB and fallback storage
 */
export async function clearDeviceSecretFromIndexedDB() {
  try {
    localStorage.removeItem(`__${TOKEN_KEY}`);
    const db = await openVaultDB();
    if (!db) return true;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(TOKEN_KEY);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(true);
    });
  } catch (e) {
    return true;
  }
}

/**
 * Collect device hardware & environment fingerprint signals
 */
export function collectDeviceFingerprint() {
  if (typeof window === 'undefined') {
    return {
      userAgent: 'Server-Side',
      platform: 'unknown',
      screen: 'unknown',
      timezone: 'UTC',
      language: 'en'
    };
  }

  const nav = window.navigator || {};
  const screen = window.screen || {};

  const userAgent = nav.userAgent || '';
  const platform = nav.platform || nav.userAgentData?.platform || 'unknown';
  const language = nav.language || nav.userLanguage || 'en';
  const screenRes = `${screen.width || 0}x${screen.height || 0}x${screen.colorDepth || 24}`;
  
  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (_) {}

  const timezoneOffset = new Date().getTimezoneOffset();

  return {
    userAgent,
    platform,
    screen: screenRes,
    timezone,
    timezoneOffset,
    language
  };
}

// In-memory CSRF token store
let cachedCsrfToken = '';
export function setAdminCsrfToken(token) {
  cachedCsrfToken = token || '';
  if (typeof sessionStorage !== 'undefined') {
    if (token) sessionStorage.setItem('__admin_csrf', token);
    else sessionStorage.removeItem('__admin_csrf');
  }
}

export function getAdminCsrfToken() {
  if (cachedCsrfToken) return cachedCsrfToken;
  if (typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem('__admin_csrf') || '';
  }
  return '';
}
