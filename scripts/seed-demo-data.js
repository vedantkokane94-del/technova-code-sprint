/**
 * Technova SVIT Code Sprint 2026
 * Demo Data Seeder (scripts/seed-demo-data.js)
 * 
 * Creates 3 realistic demo students:
 * 1. demo-student-normal: Completes Day 1 task normally with passing test cases & quiz
 * 2. demo-student-violation: Triggers a proctoring violation (tab switch) and is auto-exited/disqualified
 * 3. demo-student-timeout: Times out during quiz and is auto-submitted
 * 
 * All items are marked with is_demo: true for 100% clean teardown.
 */

import fs from 'fs';
import path from 'path';

const DATA_STORE_PATH = path.resolve(process.cwd(), 'data-store.json');

function seedDemoData() {
  console.log('Seeding demo data into data-store.json...');
  let store = {};
  if (fs.existsSync(DATA_STORE_PATH)) {
    store = JSON.parse(fs.readFileSync(DATA_STORE_PATH, 'utf-8'));
  }

  store.students = store.students || [];
  store.submissions = store.submissions || [];
  store.certificates = store.certificates || [];
  store.proctoringExits = store.proctoringExits || [];

  // Remove any previous demo records before seeding
  store.students = store.students.filter(s => !s.is_demo);
  store.submissions = store.submissions.filter(s => !s.is_demo);
  store.certificates = store.certificates.filter(s => !s.is_demo);
  store.proctoringExits = store.proctoringExits.filter(p => !p.is_demo);

  const demoStudents = [
    {
      uid: 'demo-student-1',
      id: 'demo-student-1',
      name: 'Aarav Sharma',
      prn: 'DEMO202601',
      email: 'aarav.demo@svit.ac.in',
      department: 'Computer Engineering',
      year: 'Third Year',
      track: 'Python',
      role: 'student',
      is_demo: true,
      registeredAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      uid: 'demo-student-2',
      id: 'demo-student-2',
      name: 'Priya Patel',
      prn: 'DEMO202602',
      email: 'priya.demo@svit.ac.in',
      department: 'Information Technology',
      year: 'Third Year',
      track: 'Python',
      role: 'student',
      is_demo: true,
      registeredAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      uid: 'demo-student-3',
      id: 'demo-student-3',
      name: 'Rohan Kulkarni',
      prn: 'DEMO202603',
      email: 'rohan.demo@svit.ac.in',
      department: 'Computer Engineering',
      year: 'Third Year',
      track: 'Python',
      role: 'student',
      is_demo: true,
      registeredAt: new Date(Date.now() - 3600000).toISOString()
    }
  ];

  // 1. Normal Completion Submission (Day 1: 5 points total - 3.5 program, 1.5 quiz)
  // Student 1 passes all test cases, answers 4 of 5 correctly with 1 wrong (-0.25 negative mark)
  const normalSubmission = {
    id: 'sub-demo-normal-d1',
    studentId: 'demo-student-1',
    studentName: 'Aarav Sharma',
    prn: 'DEMO202601',
    day: 1,
    track: 'Python',
    code: 'import sys\nname = sys.stdin.readline().strip()\nyear = sys.stdin.readline().strip()\nprint(f"Welcome {name}! Sprint Year: {year}")',
    testResults: [
      { id: 't1', name: 'Basic Welcome', passed: true, type: 'pass' },
      { id: 't2', name: 'Alphanumeric Format', passed: true, type: 'pass' },
      { id: 't3', name: 'Edge Case Trailing Spaces', passed: true, type: 'edge' }
    ],
    codeScore: 3.5,
    quizScore: 1.2, // 4 correct, 1 wrong with negative marking
    points: 4.7,
    submittedAt: new Date(Date.now() - 1800000).toISOString(),
    quizAnswers: { 0: 0, 1: 1, 2: 2, 3: 1, 4: 0 }, // 4 correct, 1 wrong
    quizCorrect: 4,
    quizTotal: 5,
    quizSubmitted: true,
    tabSwitches: 0,
    similarityScore: 0,
    is_demo: true
  };

  // 2. Violation Auto-Exit Submission
  // Student 2 switched tabs during quiz/code task
  const violationSubmission = {
    id: 'sub-demo-violation-d1',
    studentId: 'demo-student-2',
    studentName: 'Priya Patel',
    prn: 'DEMO202602',
    day: 1,
    track: 'Python',
    code: '# Partial code before window blur / tab switch\nimport sys\n',
    testResults: [
      { id: 't1', name: 'Basic Welcome', passed: false, type: 'fail' }
    ],
    codeScore: 0,
    quizScore: 0,
    points: 0,
    submittedAt: new Date(Date.now() - 1200000).toISOString(),
    tabSwitches: 1,
    isExited: true,
    exitReason: 'Exited: Tab switch detected during active assessment',
    exitedAt: new Date(Date.now() - 1200000).toISOString(),
    is_demo: true
  };

  const proctoringExit = {
    id: 'exit-demo-2',
    userId: 'demo-student-2',
    prn: 'DEMO202602',
    studentName: 'Priya Patel',
    day: 1,
    reason: 'Tab switch / window blur detected',
    timestamp: new Date(Date.now() - 1200000).toISOString(),
    is_demo: true
  };

  // 3. Timeout Submission
  // Student 3 ran out of timer during quiz; auto-submitted answers
  const timeoutSubmission = {
    id: 'sub-demo-timeout-d1',
    studentId: 'demo-student-3',
    studentName: 'Rohan Kulkarni',
    prn: 'DEMO202603',
    day: 1,
    track: 'Python',
    code: 'import sys\nprint("Welcome Demo! Sprint Year: 2026")',
    testResults: [
      { id: 't1', name: 'Basic Welcome', passed: true, type: 'pass' },
      { id: 't2', name: 'Alphanumeric Format', passed: false, type: 'fail' },
      { id: 't3', name: 'Edge Case Trailing Spaces', passed: false, type: 'edge' }
    ],
    codeScore: 1.5,
    quizScore: 0.6,
    points: 2.1,
    submittedAt: new Date(Date.now() - 600000).toISOString(),
    timedOut: true,
    autoSubmitted: true,
    quizSubmitted: true,
    tabSwitches: 0,
    is_demo: true
  };

  store.students.push(...demoStudents);
  store.submissions.push(normalSubmission, violationSubmission, timeoutSubmission);
  store.proctoringExits.push(proctoringExit);

  fs.writeFileSync(DATA_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  console.log(`Successfully seeded 3 demo students and submissions into ${DATA_STORE_PATH}`);
}

seedDemoData();
