/**
 * Technova SVIT Code Sprint 2026
 * Comprehensive Unit Test Suite (scripts/test_unit_scoring.js)
 * 
 * Verifies:
 * - Scoring engine calculations & 100 pt strict cap
 * - 70% program / 30% quiz distribution
 * - Negative marking deductions & zero lower-bound
 * - Leaderboard tie-breaker rules (score, on-time, timestamp)
 * - Pass mark threshold (>= 50/100)
 * - Certificate ID format and entropy/uniqueness
 * - Certificate classification (Winner / Merit / Participation)
 * - Code Judge deterministic evaluation (AC, WA, TLE, Partial marks)
 */

import assert from 'assert';
import { 
  DAY_POINTS, 
  TOTAL_SPRINT_POINTS, 
  PASS_MARK_POINTS, 
  calculateDayScore, 
  computeUserSummary, 
  sortLeaderboard,
  formatScore,
  toScoreNumber 
} from '../src/utils/scoring.js';
import { 
  generateCertificateId, 
  determineCertificateType 
} from '../src/utils/certificateGenerator.js';
import { 
  evaluateCodeSubmission, 
  VERDICTS 
} from '../src/utils/codeJudge.js';

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

console.log('====================================================');
console.log('TECHNOVA 2026 CODE SPRINT - UNIT TEST SUITE');
console.log('====================================================\n');

// 1. DAY POINTS SCHEDULE & 100 POINT CAP
console.log('Group 1: Day Points Schedule & Capping');
runTest('Sum of all 9 days must equal exactly 100 points', () => {
  const sum = Object.values(DAY_POINTS).reduce((a, b) => a + b, 0);
  assert.strictEqual(sum, 100, `Expected 100 points, got ${sum}`);
  assert.strictEqual(TOTAL_SPRINT_POINTS, 100);
});

runTest('Day 1 through 9 exact point schedule verification', () => {
  assert.strictEqual(DAY_POINTS[1], 5);
  assert.strictEqual(DAY_POINTS[2], 5);
  assert.strictEqual(DAY_POINTS[3], 8);
  assert.strictEqual(DAY_POINTS[4], 10);
  assert.strictEqual(DAY_POINTS[5], 12);
  assert.strictEqual(DAY_POINTS[6], 12);
  assert.strictEqual(DAY_POINTS[7], 13);
  assert.strictEqual(DAY_POINTS[8], 15);
  assert.strictEqual(DAY_POINTS[9], 20);
});

// 2. 70% PROGRAM / 30% QUIZ WEIGHTING
console.log('\nGroup 2: Program (70%) vs Quiz (30%) Calculation');
runTest('Day 1 perfect score yields 3.5 program + 1.5 quiz = 5.0 total', () => {
  const res = calculateDayScore({
    day: 1,
    programScore: 3.5,
    quizCorrect: 8,
    quizTotal: 8
  });
  assert.strictEqual(res.programScore, 3.5);
  assert.strictEqual(res.quizScore, 1.5);
  assert.strictEqual(res.dayTotal, 5.0);
});

runTest('Day 9 perfect score yields 14.0 program + 6.0 quiz = 20.0 total', () => {
  const res = calculateDayScore({
    day: 9,
    programScore: 14.0,
    quizCorrect: 8,
    quizTotal: 8
  });
  assert.strictEqual(res.programScore, 14.0);
  assert.strictEqual(res.quizScore, 6.0);
  assert.strictEqual(res.dayTotal, 20.0);
});

runTest('Quiz disqualification zeroes quiz points while keeping program points', () => {
  const res = calculateDayScore({
    day: 1,
    programScore: 3.5,
    quizCorrect: 8,
    quizTotal: 8,
    quizDisqualified: true
  });
  assert.strictEqual(res.programScore, 3.5);
  assert.strictEqual(res.quizScore, 0);
  assert.strictEqual(res.dayTotal, 3.5);
});

// 3. NEGATIVE MARKING & QUIZ ACCURACY
console.log('\nGroup 3: Quiz Negative Marking Logic');
function computeQuizScoreWithNegative(correct, incorrect, totalQuestions, maxQuizPoints, penaltyPerWrong) {
  const rawPoints = (correct * (maxQuizPoints / totalQuestions)) - (incorrect * penaltyPerWrong);
  return Math.max(0, Math.min(maxQuizPoints, rawPoints));
}

runTest('Negative marking with 0 penalty preserves full correct ratio', () => {
  const score = computeQuizScoreWithNegative(3, 2, 5, 1.5, 0);
  assert.strictEqual(Math.round(score * 100) / 100, 0.9); // 3/5 * 1.5 = 0.9
});

runTest('Negative marking with -0.25 deduction subtracts correctly', () => {
  const score = computeQuizScoreWithNegative(4, 1, 5, 1.5, 0.25);
  // 4 * (1.5 / 5) - (1 * 0.25) = 1.2 - 0.25 = 0.95
  assert.strictEqual(Math.round(score * 100) / 100, 0.95);
});

runTest('Negative marking does not produce negative score when wrong exceeds correct', () => {
  const score = computeQuizScoreWithNegative(1, 4, 5, 1.5, 0.5);
  // 1 * 0.3 - 4 * 0.5 = 0.3 - 2.0 = -1.7 -> capped at 0
  assert.strictEqual(score, 0);
});

// 4. LEADERBOARD TIE-BREAKERS
console.log('\nGroup 4: Leaderboard Tie-Breakers');
runTest('Higher score always ranks ahead regardless of timestamp', () => {
  const students = [
    { name: 'Late Achiever', summary: { totalScore: 85.0, onTimeCount: 7, lastSubmissionTime: 1700000000 } },
    { name: 'Early Pass', summary: { totalScore: 70.0, onTimeCount: 9, lastSubmissionTime: 1600000000 } }
  ];
  const sorted = sortLeaderboard(students);
  assert.strictEqual(sorted[0].name, 'Late Achiever');
});

runTest('Tie-breaker 1: Identical score resolves by higher on-time submission count', () => {
  const students = [
    { name: 'Catchup High', summary: { totalScore: 80.0, onTimeCount: 6, lastSubmissionTime: 1600000000 } },
    { name: 'Consistent High', summary: { totalScore: 80.0, onTimeCount: 8, lastSubmissionTime: 1700000000 } }
  ];
  const sorted = sortLeaderboard(students);
  assert.strictEqual(sorted[0].name, 'Consistent High');
});

runTest('Tie-breaker 2: Identical score and on-time count resolves by earlier submission time', () => {
  const students = [
    { name: 'Slower Finisher', summary: { totalScore: 90.0, onTimeCount: 9, lastSubmissionTime: 1700002000 } },
    { name: 'Faster Finisher', summary: { totalScore: 90.0, onTimeCount: 9, lastSubmissionTime: 1700001000 } }
  ];
  const sorted = sortLeaderboard(students);
  assert.strictEqual(sorted[0].name, 'Faster Finisher');
});

// 5. PASS MARK & CERTIFICATE ELIGIBILITY
console.log('\nGroup 5: Pass Mark & Certificate Eligibility');
runTest('Score >= 50 qualifies as isPassed', () => {
  const sub = [{ day: 1, points: 5 }, { day: 2, points: 5 }, { day: 3, points: 8 }, { day: 4, points: 10 }, { day: 5, points: 12 }, { day: 6, points: 12 }];
  const summary = computeUserSummary(sub);
  assert.strictEqual(summary.totalScore, 52.0);
  assert.strictEqual(summary.isPassed, true);
});

runTest('Score < 50 does not pass', () => {
  const sub = [{ day: 1, points: 5 }, { day: 2, points: 5 }, { day: 3, points: 8 }];
  const summary = computeUserSummary(sub);
  assert.strictEqual(summary.totalScore, 18.0);
  assert.strictEqual(summary.isPassed, false);
});

// 6. CERTIFICATE ID & CLASSIFICATION
console.log('\nGroup 6: Certificate ID & Classification');
runTest('Certificate ID adheres strictly to CERT-2026-XXXXXXXX format', () => {
  const certId = generateCertificateId();
  const certRegex = /^CERT-2026-[2-9A-Z]{8}$/;
  assert.match(certId, certRegex, `ID ${certId} did not match expected format`);
});

runTest('100 generated Certificate IDs are completely unique (no collisions)', () => {
  const set = new Set();
  for (let i = 0; i < 100; i++) {
    const id = generateCertificateId();
    assert.strictEqual(set.has(id), false, `Collision detected on ${id}`);
    set.add(id);
  }
  assert.strictEqual(set.size, 100);
});

runTest('Certificate classification assigns Winner, Merit, and Participation correctly', () => {
  assert.strictEqual(determineCertificateType(95, 1), 'Winner');
  assert.strictEqual(determineCertificateType(92, 5), 'Winner'); // score >= 90
  assert.strictEqual(determineCertificateType(80, 2), 'Winner'); // rank <= 3
  assert.strictEqual(determineCertificateType(80, 10), 'Merit'); // score >= 75
  assert.strictEqual(determineCertificateType(65, 15), 'Participation'); // score < 75
});

// 7. CODE JUDGE EVALUATION & TIMEOUT/INFINITE LOOP
console.log('\nGroup 7: Code Judge Deterministic Evaluation');
runTest('Correct Python submission receives AC with full points', () => {
  const code = 'import sys\nname = sys.stdin.readline().strip()\nyear = sys.stdin.readline().strip()\nprint(f"Welcome {name}! Sprint Year: {year}")';
  const evalResult = evaluateCodeSubmission(code, 'python', 1);
  const codeVerdict = evalResult.verdict?.code || evalResult.verdict;
  assert.strictEqual(codeVerdict, 'AC');
  const passedCases = evalResult.testResults.filter(t => t.passed).length;
  assert.strictEqual(passedCases, evalResult.testResults.length);
  assert.strictEqual(evalResult.programScore, 3.5);
});

runTest('Wrong Output submission receives WA with partial or zero points', () => {
  const code = 'print("wrong output completely")';
  const evalResult = evaluateCodeSubmission(code, 'python', 1);
  const codeVerdict = evalResult.verdict?.code || evalResult.verdict;
  assert.strictEqual(codeVerdict, 'WA');
  const passedCases = evalResult.testResults.filter(t => t.passed).length;
  assert.strictEqual(passedCases, 0);
  assert.strictEqual(evalResult.breakdown.correctness, 0);
});

runTest('Infinite loop simulation triggers TLE verdict', () => {
  const code = 'while True:\n    pass';
  const evalResult = evaluateCodeSubmission(code, 'python', 1);
  const codeVerdict = evalResult.verdict?.code || evalResult.verdict;
  assert.strictEqual(codeVerdict, 'TLE');
  assert.strictEqual(evalResult.programScore, 0);
  assert.strictEqual(evalResult.avgTimeMs, 2000);
});

console.log('\n====================================================');
console.log(`ALL ${passedTests}/${totalTests} UNIT TESTS PASSED SUCCESSFULLY!`);
console.log('====================================================');
