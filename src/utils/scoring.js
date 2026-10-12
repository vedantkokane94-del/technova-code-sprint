/**
 * Technova Code Sprint (SVIT Nashik) - Scoring Engine
 * 
 * TOTAL POINTS = EXACTLY 100
 * Day Points Schedule:
 * Day 1: 5 pts  (Program 3.5, Quiz 1.5)
 * Day 2: 5 pts  (Program 3.5, Quiz 1.5)
 * Day 3: 8 pts  (Program 5.6, Quiz 2.4)
 * Day 4: 10 pts (Program 7.0, Quiz 3.0)
 * Day 5: 12 pts (Program 8.4, Quiz 3.6)
 * Day 6: 12 pts (Program 8.4, Quiz 3.6)
 * Day 7: 13 pts (Program 9.1, Quiz 3.9)
 * Day 8: 15 pts (Program 10.5, Quiz 4.5)
 * Day 9: 20 pts (Program 14.0, Quiz 6.0)
 * Total = 100.0 pts (Program 70.0 pts, Quiz 30.0 pts)
 */

export const DAY_POINTS = {
  1: 5,
  2: 5,
  3: 8,
  4: 10,
  5: 12,
  6: 12,
  7: 13,
  8: 15,
  9: 20
};

export const TOTAL_SPRINT_POINTS = 100;
export const PASS_MARK_POINTS = 50;

/**
 * Format score to 1 decimal place without rounding errors.
 */
export function formatScore(num) {
  if (num === null || num === undefined || isNaN(num)) return "0.0";
  // Truncate/display to 1 decimal place without round-up bias
  const fixed = (Math.floor(num * 10) / 10).toFixed(1);
  return fixed;
}

/**
 * Parse score as a number with 1 decimal precision.
 */
export function toScoreNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return 0;
  return Math.floor(Number(num) * 10) / 10;
}

/**
 * Calculate earned day points:
 * - 70% program score
 * - 30% quiz score: 30% * (correctAnswers / 8)
 * - Catch-up multiplier: 0.5 (applied last)
 * - Confirmed integrity violation or failed viva: 0 points
 * - Grand total strictly capped at day max
 */
export function calculateDayScore({
  day,
  programScore = 0, // already calculated out of (DAY_POINTS[day] * 0.70)
  quizCorrect = 0,
  quizTotal = 8,
  isCatchup = false,
  failedViva = false,
  hasIntegrityViolation = false,
  quizDisqualified = false
}) {
  if (failedViva || hasIntegrityViolation) {
    return {
      programScore: 0,
      quizScore: 0,
      rawTotal: 0,
      dayTotal: 0,
      isCatchup,
      failedViva,
      hasIntegrityViolation,
      quizDisqualified
    };
  }

  const maxDayPoints = DAY_POINTS[day] || 10;
  const maxProgram = maxDayPoints * 0.70;
  const maxQuiz = maxDayPoints * 0.30;

  // Ensure programScore doesn't exceed 70% of day points
  const safeProgram = Math.min(Math.max(0, programScore), maxProgram);

  // Quiz score: 30% * (correct / 8) - strictly 0 if disqualified from quiz due to tab switching
  const quizRatio = (!quizDisqualified && quizTotal > 0) ? Math.min(1, Math.max(0, quizCorrect / quizTotal)) : 0;
  const safeQuiz = quizDisqualified ? 0 : (maxQuiz * quizRatio);

  const rawTotal = safeProgram + safeQuiz;

  // Apply catch-up multiplier (0.5) last
  const catchupMultiplier = isCatchup ? 0.5 : 1.0;
  const finalDayScore = Math.min(maxDayPoints, rawTotal * catchupMultiplier);

  return {
    programScore: toScoreNumber(safeProgram),
    quizScore: toScoreNumber(safeQuiz),
    rawTotal: toScoreNumber(rawTotal),
    dayTotal: toScoreNumber(finalDayScore),
    isCatchup,
    failedViva,
    hasIntegrityViolation,
    quizDisqualified
  };
}

/**
 * Compute student total summary:
 * - Sum of day scores (capped strictly at 100)
 * - Pass status (>= 50)
 * - Progress status: "On track", "Below pass mark", "Passed", "Pending review", "Pass mark not reached"
 * - Badges: "Early Bird" (submitted before 9 PM IST), "9-Day Streak" (completed all 9 days) - NO extra points!
 * - On-time days count and last submission timestamp for leaderboard tie-breakers
 */
export function computeUserSummary(submissions = [], manualOverrides = {}, studentVivaStatus = null) {
  let totalScore = 0;
  let onTimeCount = 0;
  let completedDays = new Set();
  let earlyBirdCount = 0;
  let lastSubmissionTime = 0;
  let hasPendingReview = false;

  const dayScores = {};

  submissions.forEach((sub) => {
    const day = Number(sub.day);
    if (!day || day < 1 || day > 9) return;

    // Check if admin marked "Needs viva" or viva failed
    const needsViva = sub.needsViva || sub.vivaRequired || sub.status === 'flagged';
    const failedViva = sub.failedViva || sub.vivaStatus === 'failed';
    const integrityViolation = sub.integrityViolation || false;

    if (needsViva && !sub.vivaPassed && !sub.clearedByAdmin) {
      hasPendingReview = true;
    }

    if (failedViva || integrityViolation) {
      dayScores[day] = 0;
      return;
    }

    // Submission score
    let score = Number(sub.score ?? sub.points ?? 0);

    // Apply manual override if set by admin
    if (manualOverrides && manualOverrides[day] !== undefined) {
      score = Number(manualOverrides[day]);
    }

    dayScores[day] = toScoreNumber(score);
    totalScore += dayScores[day];
    completedDays.add(day);

    if (!sub.isCatchup) {
      onTimeCount++;
    }

    // Check early bird timestamp (before 9 PM / 21:00 IST on active day)
    if (sub.submittedAt) {
      const subDate = new Date(sub.submittedAt);
      const subTime = subDate.getTime();
      if (subTime > lastSubmissionTime) {
        lastSubmissionTime = subTime;
      }
      const istHours = (subDate.getUTCHours() + 5 + Math.floor((subDate.getUTCMinutes() + 30) / 60)) % 24;
      if (istHours < 21 && !sub.isCatchup) {
        earlyBirdCount++;
      }
    }
  });

  // Strict 100-point cap
  if (totalScore > TOTAL_SPRINT_POINTS) {
    console.warn(`[SCORING ENGINE] Score ${totalScore} exceeded 100 cap. Clamping to 100.`);
    totalScore = TOTAL_SPRINT_POINTS;
  }

  totalScore = toScoreNumber(totalScore);

  // Badges carry 0 points
  const badges = [];
  if (earlyBirdCount >= 3) {
    badges.push({ id: 'early_bird', label: 'Early Bird', icon: '🌅', description: 'Consistently submitted before 9 PM IST' });
  }
  if (completedDays.size === 9) {
    badges.push({ id: 'streak_9', label: '9-Day Streak', icon: '🔥', description: 'Maintained unbroken consistency across all 9 sprint days' });
  }

  // Pass mark check (50/100)
  const isPassed = totalScore >= PASS_MARK_POINTS && !hasPendingReview;

  // Deadline check: 21 Oct 2026, 11:59:59 PM IST
  const deadlineIST = new Date("2026-10-21T18:29:59.000Z"); // 23:59:59 IST is 18:29:59 UTC
  const isPastDeadline = Date.now() > deadlineIST.getTime();

  let progressStatus = "On track";
  if (hasPendingReview || studentVivaStatus === 'needs_viva') {
    progressStatus = "Pending review";
  } else if (isPassed) {
    progressStatus = "Passed";
  } else if (isPastDeadline && totalScore < PASS_MARK_POINTS) {
    progressStatus = "Pass mark not reached";
  } else if (totalScore < PASS_MARK_POINTS) {
    progressStatus = "Below pass mark";
  }

  return {
    totalPoints: totalScore,
    totalScore,
    maxPoints: TOTAL_SPRINT_POINTS,
    passMark: PASS_MARK_POINTS,
    isPassed,
    isEligibleForCertificate: isPassed && !hasPendingReview,
    progressStatus, // "On track" | "Below pass mark" | "Passed" | "Pending review" | "Pass mark not reached"
    completedDays: Array.from(completedDays),
    completedCount: completedDays.size,
    onTimeCount,
    earlyBirdCount,
    lastSubmissionTime,
    dayScores,
    badges,
    hasPendingReview
  };
}

/**
 * Sort students for the leaderboard:
 * 1. Total score out of 100 (descending)
 * 2. On-time days count (descending tie-breaker)
 * 3. Earlier last-submission time (ascending tie-breaker)
 */
export function sortLeaderboard(studentsWithSummaries = []) {
  return [...studentsWithSummaries].sort((a, b) => {
    const scoreA = a.summary?.totalScore ?? a.totalPoints ?? 0;
    const scoreB = b.summary?.totalScore ?? b.totalPoints ?? 0;
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    const onTimeA = a.summary?.onTimeCount ?? 0;
    const onTimeB = b.summary?.onTimeCount ?? 0;
    if (onTimeB !== onTimeA) {
      return onTimeB - onTimeA;
    }

    const timeA = a.summary?.lastSubmissionTime ?? Infinity;
    const timeB = b.summary?.lastSubmissionTime ?? Infinity;
    return timeA - timeB;
  });
}

