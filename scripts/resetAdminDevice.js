/**
 * CLI Recovery Script for Admin Device Unbinding
 * Sir Visvesvaraya Institute of Technology (SVIT), Nashik
 * Technical Skill Development Hub
 * 
 * Usage:
 *   node scripts/resetAdminDevice.js --setup-key=<ADMIN_SETUP_KEY>
 *   or:
 *   ADMIN_SETUP_KEY=<KEY> node scripts/resetAdminDevice.js
 */

import fs from 'fs';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
let setupKeyArg = null;
for (const arg of args) {
  if (arg.startsWith('--setup-key=')) {
    setupKeyArg = arg.split('=')[1];
  } else if (arg === '--setup-key') {
    const nextIdx = args.indexOf(arg) + 1;
    if (nextIdx < args.length) setupKeyArg = args[nextIdx];
  }
}

// Read .env if present for default fallback
const envPath = path.resolve(process.cwd(), '.env');
let envSetupKey = process.env.ADMIN_SETUP_KEY;
if (!envSetupKey && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('ADMIN_SETUP_KEY=')) {
      envSetupKey = trimmed.split('=')[1]?.trim();
    }
  }
}

const EXPECTED_SETUP_KEY = envSetupKey || 'svit-technova-master-setup-key-2026-x9z';
const providedKey = setupKeyArg || process.env.ADMIN_SETUP_KEY;

const dataStorePath = path.resolve(process.cwd(), 'data-store.json');
let store = null;
try {
  if (fs.existsSync(dataStorePath)) {
    store = JSON.parse(fs.readFileSync(dataStorePath, 'utf-8'));
  }
} catch (e) {
  console.error('[ERROR] Could not parse data-store.json:', e);
}

if (!store) {
  console.error('[ERROR] data-store.json does not exist or is corrupted.');
  process.exit(1);
}

if (!providedKey || providedKey !== EXPECTED_SETUP_KEY) {
  console.error('\n======================================================');
  console.error(' [SECURITY VIOLATION] ACCESS DENIED: CLI RECOVERY');
  console.error('======================================================');
  console.error(' Device unbinding requires a valid ADMIN_SETUP_KEY.');
  console.error(' Provide the setup key via:');
  console.error('   npm run admin:reset-device -- --setup-key=<YOUR_KEY>');
  console.error(' or:');
  console.error('   node scripts/resetAdminDevice.js --setup-key=<YOUR_KEY>\n');

  // Audit log failed attempt
  store.adminLoginLogs = store.adminLoginLogs || [];
  store.adminLoginLogs.unshift({
    timestamp: new Date().toISOString(),
    ip: '127.0.0.1 (CLI)',
    userAgent: 'Node.js CLI Recovery Script',
    action: 'cli_device_reset_attempt',
    success: false,
    reason: 'invalid_setup_key'
  });
  try {
    fs.writeFileSync(dataStorePath, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {}
  process.exit(1);
}

// Authorized Reset
console.log('\n======================================================');
console.log(' [ADMIN RECOVERY] VALIDATING MASTER SETUP KEY: OK');
console.log('======================================================');

const previousPrimary = store.adminDevice?.deviceName || 'None';
const previousDevicesCount = (store.adminDevices || []).length;

store.adminDevice = null;
store.adminDevices = [];
store.adminSessions = [];
store.adminRateLimit = { failedAttempts: 0, lockedUntil: 0 };
store.adminIpRateLimits = {};

store.adminLoginLogs = store.adminLoginLogs || [];
store.adminLoginLogs.unshift({
  timestamp: new Date().toISOString(),
  ip: '127.0.0.1 (CLI)',
  userAgent: 'Node.js CLI Recovery Script',
  action: 'cli_device_reset_success',
  success: true,
  reason: 'manual_cli_recovery_executed',
  previousPrimary,
  clearedDevicesCount: previousDevicesCount
});

try {
  fs.writeFileSync(dataStorePath, JSON.stringify(store, null, 2), 'utf-8');
  console.log(' [SUCCESS] Admin hardware device binding has been completely wiped.');
  console.log(` [INFO] Cleared primary device (${previousPrimary}) and all active sessions.`);
  console.log(' [INFO] Setup mode has been PERMANENTLY re-opened.');
  console.log(' [NEXT STEP] Visit the admin route with your ADMIN_SETUP_KEY to register your new workstation.');
  console.log('======================================================\n');
  process.exit(0);
} catch (e) {
  console.error('[ERROR] Failed to save updated data-store.json:', e);
  process.exit(1);
}
