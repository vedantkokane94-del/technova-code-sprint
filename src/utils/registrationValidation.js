import { isDisposableEmailDomain } from '../data/disposableDomains.js';

/**
 * Shared Client & Server Registration Validation & Anti-Fake Normalization
 * Technova Code Sprint: 9 Days to Build — SVIT Nashik
 */

export const ALLOWED_BRANCHES = [
  { code: 'ECE', label: 'Electronics and Communication (ECE)' },
  { code: 'IT', label: 'Information Technology (IT)' },
  { code: 'COMP', label: 'Computer Engineering' },
  { code: 'CHEM', label: 'Chemical Engineering' }
];

export const VALID_BRANCH_CODES = ['ECE', 'IT', 'COMP', 'CHEM'];

export const BRANCH_CODE_TO_LABEL = {
  ECE: 'Electronics and Communication (ECE)',
  IT: 'Information Technology (IT)',
  COMP: 'Computer Engineering',
  CHEM: 'Chemical Engineering'
};

export function getBranchLabel(codeOrName) {
  if (!codeOrName) return '';
  const trimmed = String(codeOrName).trim();
  const upper = trimmed.toUpperCase();
  if (BRANCH_CODE_TO_LABEL[upper]) return BRANCH_CODE_TO_LABEL[upper];
  const found = ALLOWED_BRANCHES.find(b => b.label.toLowerCase() === trimmed.toLowerCase());
  if (found) return found.label;
  return trimmed;
}

export function normalizeBranchCode(codeOrName) {
  if (!codeOrName) return null;
  const trimmed = String(codeOrName).trim();
  const upper = trimmed.toUpperCase();
  if (VALID_BRANCH_CODES.includes(upper)) return upper;
  if (/^electronics\s*(?:and|&)\s*communication(?:\s*\(ece\))?$/i.test(trimmed) || /^ece$/i.test(trimmed)) return 'ECE';
  if (/^information\s*technology(?:\s*\(it\))?$/i.test(trimmed) || /^it$/i.test(trimmed)) return 'IT';
  if (/^computer(?:\s*engineering)?$/i.test(trimmed) || /^comp$/i.test(trimmed) || /^cse$/i.test(trimmed)) return 'COMP';
  if (/^chemical(?:\s*engineering)?$/i.test(trimmed) || /^chem$/i.test(trimmed)) return 'CHEM';
  return null;
}

export const VALID_BRANCHES = ALLOWED_BRANCHES.map(b => b.label);

export const VALID_YEARS = [
  'First Year (FE)',
  'Second Year (SE)',
  'Third Year (TE)',
  'Final Year (BE)'
];

export const VALID_DIVISIONS = ['A', 'B', 'C', 'D'];

export const VALID_TRACKS = ['C', 'C++', 'Java', 'Python'];

const OBVIOUS_FAKE_LOCAL_PARTS = new Set([
  'test',
  'testing',
  'tester',
  'dummy',
  'fake',
  'sample',
  'example',
  'demo',
  'temp',
  'user',
  'admin',
  'nobody',
  'noreply',
  'no-reply',
  'none',
  'null',
  'undefined',
  'asdf',
  'asdfg',
  'asdfgh',
  'asdfghjkl',
  'qwerty',
  'qwert',
  'qwertyuiop',
  'zxcv',
  'zxcvb',
  'zxcvbn',
  'abcd',
  'abcde',
  'abcdef',
  'abc',
  'xyz',
  'aaa',
  'aaaa',
  'bbb',
  'bbbb',
  '123',
  '1234',
  '12345',
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  '0000',
  '00000',
  '000000'
]);

const OBVIOUS_FAKE_DOMAINS = new Set([
  'test.com',
  'test.org',
  'test.net',
  'test.in',
  'testing.com',
  'example.com',
  'example.org',
  'example.net',
  'example.edu',
  'abc.com',
  'xyz.com',
  'fake.com',
  'dummy.com',
  'sample.com',
  'demo.com',
  'invalid.com',
  'localhost',
  'localdomain',
  'mail.test',
  'domain.com',
  'email.com',
  'none.com',
  'null.com',
  'qwerty.com',
  'asdf.com'
]);

const KEYBOARD_PATTERNS = [
  'qwerty',
  'asdfgh',
  'zxcvbn',
  '1234567',
  'abcdefg',
  '0987654'
];

/**
 * 1. Validate Full Name:
 * - Letters and spaces only
 * - Minimum 2 words (each word at least 2 letters)
 * - Trimmed and normalized single spaces
 */
export function validateFullName(rawName) {
  const cleaned = String(rawName || '')
    .trim()
    .replace(/\s+/g, ' ');

  if (!cleaned) {
    return { valid: false, value: '', error: 'Full name is required.' };
  }

  if (!/^[A-Za-z ]+$/.test(cleaned)) {
    return {
      valid: false,
      value: cleaned,
      error: 'Full name must contain letters and spaces only (no numbers or special characters).'
    };
  }

  const words = cleaned.split(' ').filter(Boolean);
  if (words.length < 2) {
    return {
      valid: false,
      value: cleaned,
      error: 'Please enter your full name (minimum 2 words, e.g. First Name and Last Name).'
    };
  }

  for (const w of words) {
    if (w.length < 2) {
      return {
        valid: false,
        value: cleaned,
        error: 'Each part of your name must be at least 2 letters long.'
      };
    }
    if (/(.)\1{3,}/i.test(w)) {
      return {
        valid: false,
        value: cleaned,
        error: 'Please enter a genuine full name without repeated characters.'
      };
    }
  }

  if (cleaned.length < 4 || cleaned.length > 80) {
    return {
      valid: false,
      value: cleaned,
      error: 'Full name must be between 4 and 80 characters.'
    };
  }

  return { valid: true, value: cleaned, error: null };
}

/**
 * 2. Normalize Email Address:
 * - Lowercase & trim
 * - Strip +alias for all providers
 * - For gmail.com / googlemail.com: remove all dots (.) in local part and canonicalize domain to gmail.com
 *   so `v.e.d.a.n.t+sprint@gmail.com` and `vedant@gmail.com` resolve to the exact same normalized address.
 */
export function normalizeEmail(rawEmail) {
  const cleaned = String(rawEmail || '').trim().toLowerCase();
  if (!cleaned || !cleaned.includes('@')) return cleaned;

  const [rawLocal, rawDomain] = cleaned.split('@');
  if (!rawLocal || !rawDomain) return cleaned;

  // Strip +alias
  let local = rawLocal.split('+')[0];
  let domain = rawDomain;

  if (domain === 'googlemail.com') {
    domain = 'gmail.com';
  }
  if (domain === 'gmail.com') {
    local = local.replace(/\./g, '');
  }

  return `${local}@${domain}`;
}

/**
 * 3. Validate Email Address (Syntax, Disposable Blocklist, Fake/Pattern Rejection, Optional Domain Allowlist)
 */
export function validateEmailAddress(rawEmail, options = {}) {
  const displayEmail = String(rawEmail || '').trim().toLowerCase();
  if (!displayEmail) {
    return { valid: false, email: '', normalizedEmail: '', domain: '', error: 'Email address is required.' };
  }

  // Strict RFC-style syntax check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(displayEmail) || displayEmail.includes('..')) {
    return {
      valid: false,
      email: displayEmail,
      normalizedEmail: '',
      domain: '',
      error: 'Please enter a valid email address (e.g. student@svit.ac.in or name@gmail.com).'
    };
  }

  const [rawLocal, domain] = displayEmail.split('@');
  const normalized = normalizeEmail(displayEmail);
  const [normLocal] = normalized.split('@');

  // 3a. Reject disposable or temporary email domains
  if (isDisposableEmailDomain(domain)) {
    return {
      valid: false,
      email: displayEmail,
      normalizedEmail: normalized,
      domain,
      error: `Disposable or temporary email addresses (@${domain}) are strictly blocked. Please use your permanent college or personal email.`
    };
  }

  // 3b. Reject obvious fake domains
  if (OBVIOUS_FAKE_DOMAINS.has(domain)) {
    return {
      valid: false,
      email: displayEmail,
      normalizedEmail: normalized,
      domain,
      error: `The email domain "@${domain}" is not a genuine email provider.`
    };
  }

  // 3c. Reject local part == domain name (e.g. test@test.com, abc@abc.com, svit@svit.com)
  const domainBase = domain.split('.')[0];
  if (normLocal === domainBase || rawLocal === domainBase) {
    return {
      valid: false,
      email: displayEmail,
      normalizedEmail: normalized,
      domain,
      error: 'Dummy or placeholder email addresses (such as name@name.com) are not allowed.'
    };
  }

  // 3d. Reject obvious fake local parts (test, abc, fake, dummy, qwerty, asdf, 12345, etc.)
  const localAlphaNum = normLocal.replace(/[^a-z0-9]/g, '');
  if (
    OBVIOUS_FAKE_LOCAL_PARTS.has(normLocal) ||
    OBVIOUS_FAKE_LOCAL_PARTS.has(localAlphaNum) ||
    /^(test|fake|dummy|sample|demo|temp|user|student|abc|xyz)\d*$/i.test(localAlphaNum)
  ) {
    return {
      valid: false,
      email: displayEmail,
      normalizedEmail: normalized,
      domain,
      error: 'Dummy or test email addresses are not permitted. Please enter your genuine email address.'
    };
  }

  // 3e. Reject repeated characters (e.g. aaaaa@gmail.com, 111111@gmail.com) or keyboard walks
  if (/(.)\1{4,}/.test(localAlphaNum) || /^\d+$/.test(localAlphaNum)) {
    return {
      valid: false,
      email: displayEmail,
      normalizedEmail: normalized,
      domain,
      error: 'Please enter a genuine email address (repeated characters or numeric-only usernames are rejected).'
    };
  }

  for (const pat of KEYBOARD_PATTERNS) {
    if (localAlphaNum.includes(pat)) {
      return {
        valid: false,
        email: displayEmail,
        normalizedEmail: normalized,
        domain,
        error: 'Keyboard-pattern email addresses (e.g. qwerty / asdfgh / 123456) are rejected.'
      };
    }
  }

  if (normLocal.length < 3) {
    return {
      valid: false,
      email: displayEmail,
      normalizedEmail: normalized,
      domain,
      error: 'Email username is too short to be valid.'
    };
  }

  // 3f. Optional Allowed Email Domains Allowlist (if enabled in config)
  const allowlistEnabled = Boolean(options.allowlistEnabled);
  const allowedDomains = Array.isArray(options.allowedDomains)
    ? options.allowedDomains.map(d => String(d).trim().toLowerCase()).filter(Boolean)
    : [];

  if (allowlistEnabled && allowedDomains.length > 0) {
    const isAllowed = allowedDomains.some(allowed => domain === allowed || domain.endsWith(`.${allowed}`));
    if (!isAllowed) {
      return {
        valid: false,
        email: displayEmail,
        normalizedEmail: normalized,
        domain,
        error: `Only official emails from [${allowedDomains.join(', ')}] are currently allowed to register.`
      };
    }
  }

  return {
    valid: true,
    email: displayEmail,
    normalizedEmail: normalized,
    domain,
    error: null
  };
}

/**
 * 4. Normalize & Validate 10-Digit Indian Mobile Number:
 * - Starts with 6, 7, 8, or 9
 * - Stored as +91XXXXXXXXXX
 * - Rejects 0000000000, 1234567890, repeated digits (9999999999), sequential digits, alternating digits
 */
export function normalizeIndianPhone(rawPhone) {
  let digits = String(rawPhone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (/^[6-9]\d{9}$/.test(digits)) {
    return `+91${digits}`;
  }
  return digits ? `+91${digits}` : '';
}

export function validateIndianPhone(rawPhone) {
  let digits = String(rawPhone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (!digits) {
    return { valid: false, phone: '', digits: '', error: 'Mobile number is required.' };
  }

  if (!/^[6-9]\d{9}$/.test(digits)) {
    return {
      valid: false,
      phone: '',
      digits,
      error: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.'
    };
  }

  // Reject all identical digits (e.g. 9999999999, 8888888888) or 6+ identical consecutive digits
  if (/^(\d)\1{9}$/.test(digits) || /(\d)\1{5,}/.test(digits)) {
    return {
      valid: false,
      phone: '',
      digits,
      error: 'Invalid mobile number: repeated digit patterns (e.g. 9999999999) are not allowed.'
    };
  }

  // Reject sequential / obvious dummy numbers
  const bannedNumbers = new Set([
    '9876543210',
    '9876543211',
    '9123456789',
    '9012345678',
    '8765432109',
    '7654321098',
    '6543210987',
    '6789012345',
    '7890123456',
    '8901234567',
    '9000000000',
    '8000000000',
    '7000000000',
    '6000000000'
  ]);
  if (bannedNumbers.has(digits) || /123456|654321|012345|543210/.test(digits)) {
    return {
      valid: false,
      phone: '',
      digits,
      error: 'Invalid mobile number: sequential or dummy number patterns are rejected.'
    };
  }

  // Reject alternating 2-digit repeats (e.g. 9898989898, 9090909090)
  if (/^(\d\d)\1{4}$/.test(digits)) {
    return {
      valid: false,
      phone: '',
      digits,
      error: 'Invalid mobile number: repeating pair patterns are rejected.'
    };
  }

  return {
    valid: true,
    phone: `+91${digits}`,
    digits,
    error: null
  };
}

/**
 * 5. Validate College Roll Number
 */
export function validateRollNumber(rawPrn) {
  const cleaned = String(rawPrn || '').trim().toUpperCase();
  if (!cleaned) {
    return { valid: false, prn: '', error: 'College Roll Number is required.' };
  }
  if (!/^[A-Z0-9-]{1,20}$/.test(cleaned)) {
    return {
      valid: false,
      prn: cleaned,
      error: 'Roll Number must contain only letters, numbers, or hyphens (e.g. 33 or 24CS089).'
    };
  }
  if (/^0+$/.test(cleaned) || /^(TEST|FAKE|DUMMY|ADMIN|NONE|NULL|ABC|XYZ)$/i.test(cleaned)) {
    return {
      valid: false,
      prn: cleaned,
      error: 'Please enter your genuine College Roll Number.'
    };
  }
  return { valid: true, prn: cleaned, error: null };
}

/**
 * 6. Validate Complete Registration Payload (All 1.1 - 1.7 Fields)
 */
export function validateRegistrationPayload(payload = {}, options = {}) {
  const errors = {};

  const nameCheck = validateFullName(payload.name);
  if (!nameCheck.valid) errors.name = nameCheck.error;

  const emailCheck = validateEmailAddress(payload.email, options);
  if (!emailCheck.valid) errors.email = emailCheck.error;

  const phoneCheck = validateIndianPhone(payload.phone);
  if (!phoneCheck.valid) errors.phone = phoneCheck.error;

  const prnCheck = validateRollNumber(payload.prn);
  if (!prnCheck.valid) errors.prn = prnCheck.error;

  const rawBranch = String(payload.branch || '').trim();
  const normalizedBranch = normalizeBranchCode(rawBranch);
  if (!normalizedBranch) {
    errors.branch = 'Please choose one of the available branches.';
  }

  const year = String(payload.year || '').trim();
  if (!VALID_YEARS.includes(year)) {
    errors.year = 'Please select your Academic Year of Study.';
  }

  const division = String(payload.division || '').trim().toUpperCase();
  if (!VALID_DIVISIONS.includes(division)) {
    errors.division = 'Please select your Division (A, B, C, or D).';
  }

  const language = String(payload.language || payload.track || '').trim();
  const matchedTrack = VALID_TRACKS.find(t => t.toLowerCase() === language.toLowerCase());
  if (!matchedTrack) {
    errors.language = 'Please choose a valid Programming Track (C, C++, Java, or Python).';
  }

  if (payload.genuineConsent !== true) {
    errors.genuineConsent = 'You must confirm: "The details I entered are genuine."';
  }

  const isValid = Object.keys(errors).length === 0;
  const cleanPayload = {
    name: nameCheck.value,
    email: emailCheck.email,
    normalizedEmail: emailCheck.normalizedEmail,
    emailDomain: emailCheck.domain,
    phone: phoneCheck.phone,
    phoneDigits: phoneCheck.digits,
    branch: normalizedBranch || rawBranch,
    branchCode: normalizedBranch || rawBranch,
    branchLabel: getBranchLabel(normalizedBranch || rawBranch),
    division,
    language: matchedTrack || 'Python',
    track: matchedTrack || 'Python',
    genuineConsent: Boolean(payload.genuineConsent)
  };
  return {
    valid: isValid,
    errors,
    firstError: isValid ? null : Object.values(errors)[0],
    sanitized: cleanPayload,
    normalized: cleanPayload
  };
}
