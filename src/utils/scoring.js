/**
 * Points schedule per day:
 * Days 1-3: 10
 * Days 4-6: 15
 * Days 7-8: 20
 * Day 9: 25
 */
export const BASE_POINTS = {
  1: 10,
  2: 10,
  3: 10,
  4: 15,
  5: 15,
  6: 15,
  7: 20,
  8: 20,
  9: 25,
};

/**
 * Calculate earned points for a submission:
 * - base points (or 50% if caught up on missed day)
 * - +5 early bird if submitted before 9 PM IST on that active day
 * - viva penalty: 0 if failed viva
 */
export function calculateSubmissionPoints({ day, isCatchup = false, submittedAt = new Date(), failedViva = false }) {
  if (failedViva) return 0;
  const base = BASE_POINTS[day] || 10;
  let points = isCatchup ? Math.floor(base / 2) : base;

  // Early bird check: before 9 PM IST (21:00) on active day (not applicable to catch-up)
  if (!isCatchup) {
    const subDate = new Date(submittedAt);
    // Convert to IST hours (UTC + 5.5)
    const istHours = (subDate.getUTCHours() + 5 + Math.floor((subDate.getUTCMinutes() + 30) / 60)) % 24;
    if (istHours < 21) {
      points += 5; // Early bird bonus
    }
  }

  return points;
}

/**
 * Calculate user total score and streak
 * Submissions: Array of { day, points, status, failedViva, submittedAt }
 */
export function computeUserSummary(submissions = []) {
  let totalPoints = 0;
  let streak = 0;
  let completedDays = new Set();

  submissions.forEach((sub) => {
    if (sub.status === 'approved' || sub.status === 'submitted') {
      if (!sub.failedViva) {
        totalPoints += sub.points || 0;
        completedDays.add(sub.day);
      }
    }
  });

  // Calculate continuous consecutive streak up to completed days
  for (let d = 1; d <= 9; d++) {
    if (completedDays.has(d)) {
      streak++;
    } else {
      break;
    }
  }

  // Bonus for 9/9 perfect streak
  if (completedDays.size === 9) {
    totalPoints += 10;
  }

  return {
    totalPoints,
    streak,
    completedCount: completedDays.size,
    hasPerfectBonus: completedDays.size === 9,
  };
}

