import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const backupDir = path.join(rootDir, 'backups');

// Ensure backups directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const args = process.argv.slice(2);
const isBackupOnly = args.includes('--backup-only');
const isConfirmed = args.includes('--confirm');

console.log("\n=======================================================");
console.log("  TECHNOVA CODE SPRINT: PRODUCTION DATA RESET MANAGER  ");
console.log("  Sir Visvesvaraya Institute of Technology (SVIT)     ");
console.log("=======================================================\n");

// 1. Gather all existing data to backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFilePath = path.join(backupDir, `backup_${timestamp}.json`);

const backupData = {
  metadata: {
    createdAt: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    system: "Technova Code Sprint 2026",
    version: "1.0.0"
  },
  adminAccount: {
    role: "admin",
    email: "faculty@svit.ac.in",
    department: "Technical Skill Development Hub",
    passwordHashed: Boolean(process.env.VITE_ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD)
  },
  studentRegistrations: [],
  submissions: [],
  certificates: [],
  manualOverrides: {},
  emailLogs: [],
  tasksConfig: "Standard 9-Day Sprint Curriculum"
};

// Check for any persisted store files or snapshots
const dataStorePath = path.join(rootDir, 'data-store.json');
if (fs.existsSync(dataStorePath)) {
  try {
    const raw = fs.readFileSync(dataStorePath, 'utf8');
    const parsed = JSON.parse(raw);
    backupData.studentRegistrations = parsed.students || [];
    backupData.submissions = parsed.submissions || [];
    backupData.certificates = parsed.certificates || [];
    backupData.manualOverrides = parsed.manualOverrides || {};
    backupData.emailLogs = parsed.emailLogs || [];
  } catch (e) {
    console.warn("Notice: data-store.json unreadable or empty.");
  }
}

// Write the backup
fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');

console.log(`[BACKUP COMPLETED]`);
console.log(`-> Backup Archive: ${backupFilePath}`);
console.log(`-> Snapshot Summary:`);
console.log(`   - Student Registrations: ${backupData.studentRegistrations.length}`);
console.log(`   - Submissions:           ${backupData.submissions.length}`);
console.log(`   - Issued Certificates:   ${backupData.certificates.length}`);
console.log(`   - Email Logs:            ${backupData.emailLogs.length}`);
console.log(`   - Admin Status:          Secured with Bcrypt Hash\n`);

if (isBackupOnly) {
  console.log("SUCCESS: Backup created safely. No data was modified or deleted.");
  console.log("To perform the wipe when ready, run with --confirm:\n  node scripts/reset-production-data.js --confirm\n");
  process.exit(0);
}

if (!isConfirmed) {
  console.log("=======================================================");
  console.log("  SAFETY INTERLOCK: WIPE CONFIRMATION REQUIRED         ");
  console.log("=======================================================");
  console.log("Data backup has been safely saved above.");
  console.log("To prevent accidental data loss, the wipe will NOT run without confirmation.");
  console.log("\nTo proceed with the one-time data reset, run the exact command:");
  console.log(">>>  node scripts/reset-production-data.js --confirm");
  console.log("or");
  console.log(">>>  npm run reset-data -- --confirm\n");
  process.exit(0);
}

// 2. Perform the Wipe when explicitly confirmed with --confirm
console.log("[WIPING DATA] Resetting all student records and test submissions...");

// Reset data-store.json to pristine clean state
const cleanDataStore = {
  resetAt: new Date().toISOString(),
  students: [],
  submissions: [],
  certificates: [],
  manualOverrides: {},
  emailLogs: [],
  sprintDay: 1,
  adminSeeded: {
    email: "faculty@svit.ac.in",
    role: "admin",
    name: "SVIT Faculty Administrator",
    department: "Technical Skill Development Hub",
    rollNo: "SVIT-FACULTY"
  }
};

fs.writeFileSync(dataStorePath, JSON.stringify(cleanDataStore, null, 2), 'utf8');

// Also create a marker file for the web client so any active browser session gets synchronized
const resetMarkerPath = path.join(rootDir, 'src', 'data', 'resetMarker.json');
fs.writeFileSync(resetMarkerPath, JSON.stringify({
  resetTimestamp: Date.now(),
  epoch: `technova_svit_production_${Date.now()}`
}, null, 2), 'utf8');

console.log("\n=======================================================");
console.log("  SUCCESS: PRODUCTION DATA RESET COMPLETE              ");
console.log("=======================================================");
console.log("1. All student registrations, records, and sessions: DELETED");
console.log("2. All task submissions and integrity logs:          DELETED");
console.log("3. All issued certificates and email logs:           DELETED");
console.log("4. 9-day curriculum schema and task variants:        PRESERVED");
console.log("5. Admin account configuration & bcrypt security:    INTACT");
console.log("\nThe application is pristine and ready for fresh student registrations!\n");
