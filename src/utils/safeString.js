/**
 * Safe String and Object Utilities
 * Prevents "Cannot read properties of undefined (reading 'replace' / 'toLowerCase' / 'trim' / 'split')"
 * and guarantees consistent defensive fallbacks across the Technova Code Sprint platform.
 */

export function safeString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return fallback;
}

export function safeTrim(value, fallback = '') {
  return safeString(value, fallback).trim();
}

export function safeLowerCase(value, fallback = '') {
  return safeString(value, fallback).toLowerCase();
}

export function safeUpperCase(value, fallback = '') {
  return safeString(value, fallback).toUpperCase();
}

export function safeReplace(value, pattern, replacement, fallback = '') {
  return safeString(value, fallback).replace(pattern, replacement);
}

export function safeSlice(value, start, end, fallback = '') {
  return safeString(value, fallback).slice(start, end);
}

export function safeSplit(value, separator, fallback = []) {
  const str = safeString(value, '');
  if (!str) return fallback;
  return str.split(separator);
}

/**
 * Returns a clean GitHub repository display string
 * e.g. "https://github.com/student/day1-task" -> "student/day1-task"
 */
export function safeGithubRepo(repo, fallback = '') {
  const str = safeTrim(repo, '');
  if (!str) return fallback;
  return str
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\/?/i, '')
    .replace(/\/+$/, '');
}

/**
 * Generates 1-2 character initials safely from any name
 * e.g. "Vedant Kokane" -> "VK", "Aarav" -> "AA", null -> "ST"
 */
export function safeInitials(name, fallback = 'ST') {
  const clean = safeTrim(name, '');
  if (!clean) return fallback;
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    const f = parts[0][0] || '';
    const l = parts[1][0] || '';
    return `${f}${l}`.toUpperCase() || fallback;
  }
  if (parts.length === 1 && parts[0]) {
    return parts[0].slice(0, 2).toUpperCase() || fallback;
  }
  return fallback;
}

/**
 * Sanitizes a student record to guarantee all required fields exist and are strings.
 */
export function sanitizeStudent(student = {}) {
  if (!student || typeof student !== 'object') {
    return {
      uid: `student-${Date.now()}`,
      name: 'Unknown Student',
      email: '',
      normalized_email: '',
      prn: '',
      phone: '',
      track: 'Python',
      language: 'Python',
      branch: 'Computer Engineering',
      year: 'Second Year (SE)',
      division: 'A',
      verified_status: 'unverified',
      role: 'student'
    };
  }

  const prn = safeTrim(student.prn || student.rollNo, '');
  const name = safeTrim(student.name || student.studentName, 'Student');
  const track = safeTrim(student.track || student.language, 'Python');
  const email = safeLowerCase(safeTrim(student.email), '');

  return {
    ...student,
    uid: safeString(student.uid, `student-${prn || Date.now()}`),
    name,
    email,
    normalized_email: safeLowerCase(safeTrim(student.normalized_email || student.normalizedEmail), email),
    prn,
    phone: safeTrim(student.phone, ''),
    track,
    language: track,
    branch: safeTrim(student.branch, 'Computer Engineering'),
    year: safeTrim(student.year, 'Second Year (SE)'),
    division: safeTrim(student.division, 'A'),
    verified_status: safeTrim(student.verified_status || student.verifiedStatus, 'unverified'),
    email_verified: Boolean(student.email_verified || student.emailVerified),
    phone_verified: Boolean(student.phone_verified || student.phoneVerified),
    flagged: Boolean(student.flagged),
    suspended: Boolean(student.suspended),
    role: safeTrim(student.role, 'student')
  };
}

/**
 * Sanitizes a submission record to guarantee no undefined fields crash table renders.
 */
export function sanitizeSubmission(sub = {}) {
  if (!sub || typeof sub !== 'object') {
    return {
      id: `sub-${Date.now()}`,
      userId: '',
      studentName: 'Student',
      prn: '',
      day: 1,
      track: 'Python',
      language: 'Python',
      githubRepo: '',
      commitCount: 1,
      firstCommitTime: '10:00 AM',
      lastCommitTime: '11:00 AM',
      solutionNote: '',
      points: 0,
      rawTotal: 0,
      programScore: 0,
      quizScore: 0,
      quizCorrect: 0,
      quizSubmitted: false,
      tabSwitches: 0,
      submittedAt: new Date().toISOString(),
      status: 'approved'
    };
  }

  const track = safeTrim(sub.track || sub.language, 'Python');
  const prn = safeTrim(sub.prn, '');

  return {
    ...sub,
    id: safeString(sub.id, `sub-${prn}-${sub.day || 1}`),
    userId: safeString(sub.userId, `user-${prn}`),
    studentName: safeTrim(sub.studentName || sub.name, 'Student'),
    prn,
    day: Number(sub.day || 1),
    track,
    language: track,
    githubRepo: safeTrim(sub.githubRepo, ''),
    commitCount: Number(sub.commitCount || 1),
    firstCommitTime: safeString(sub.firstCommitTime, '10:00 AM'),
    lastCommitTime: safeString(sub.lastCommitTime, '11:00 AM'),
    solutionNote: safeString(sub.solutionNote, ''),
    points: Number(sub.points || 0),
    rawTotal: Number(sub.rawTotal || sub.points || 0),
    programScore: Number(sub.programScore || 0),
    quizScore: Number(sub.quizScore || 0),
    quizCorrect: Number(sub.quizCorrect || 0),
    quizSubmitted: Boolean(sub.quizSubmitted),
    tabSwitches: Number(sub.tabSwitches || 0),
    submittedAt: safeString(sub.submittedAt, new Date().toISOString()),
    status: safeString(sub.status, 'approved')
  };
}
