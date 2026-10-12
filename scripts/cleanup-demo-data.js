/**
 * Technova SVIT Code Sprint 2026
 * Demo Data Cleanup Script (scripts/cleanup-demo-data.js)
 * 
 * Purges every record marked with is_demo: true, demo PRNs, or demo IDs.
 * Restores data-store.json to 100% clean production state.
 */

import fs from 'fs';
import path from 'path';

const DATA_STORE_PATH = path.resolve(process.cwd(), 'data-store.json');

function cleanupDemoData() {
  console.log('Starting demo data cleanup...');
  if (!fs.existsSync(DATA_STORE_PATH)) {
    console.log('No data-store.json file found. Nothing to clean.');
    return;
  }

  const store = JSON.parse(fs.readFileSync(DATA_STORE_PATH, 'utf-8'));
  let removedCount = 0;

  const filterDemo = (item) => {
    if (!item) return false;
    const isDemo = Boolean(
      item.is_demo ||
      (item.prn && String(item.prn).startsWith('DEMO')) ||
      (item.id && String(item.id).includes('demo')) ||
      (item.userId && String(item.userId).includes('demo')) ||
      (item.studentId && String(item.studentId).includes('demo'))
    );
    if (isDemo) removedCount++;
    return !isDemo;
  };

  if (Array.isArray(store.students)) {
    store.students = store.students.filter(filterDemo);
  }
  if (Array.isArray(store.submissions)) {
    store.submissions = store.submissions.filter(filterDemo);
  }
  if (Array.isArray(store.certificates)) {
    store.certificates = store.certificates.filter(filterDemo);
  }
  if (Array.isArray(store.proctoringExits)) {
    store.proctoringExits = store.proctoringExits.filter(filterDemo);
  }
  if (Array.isArray(store.activeTestSessions)) {
    store.activeTestSessions = store.activeTestSessions.filter(filterDemo);
  }
  if (Array.isArray(store.studentConsents)) {
    store.studentConsents = store.studentConsents.filter(filterDemo);
  }

  fs.writeFileSync(DATA_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  console.log(`Cleanup complete! Removed ${removedCount} demo items from data-store.json.`);
}

cleanupDemoData();
