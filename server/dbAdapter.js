import fs from 'fs';
import os from 'os';
import path from 'path';

const ROOT_STORE_PATH = path.resolve(process.cwd(), 'data-store.json');
const TMP_STORE_PATH = path.join(os.tmpdir(), 'technova-code-sprint-store.json');

function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();
  if (!url || !key || url.includes('your_supabase')) return null;
  return { url, key };
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseConfig());
}

function getDefaultStore() {
  const defaultAllowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || 'svit.ac.in')
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean);

  return {
    students: [],
    submissions: [],
    certificates: [],
    manualOverrides: {},
    userConsentsMap: {},
    proctoringFlags: [],
    emailLogs: [],
    resultsPublished: false,
    allowExitedStudentsForCert: false,
    pendingVerifications: {},
    registrationRateLimits: {},
    registrationSettings: {
      allowlistEnabled: process.env.ALLOWED_EMAIL_DOMAINS_ENABLED === 'true',
      allowedDomains: defaultAllowedDomains,
      phoneVerificationRequired: process.env.PHONE_VERIFICATION_REQUIRED === 'true'
    },
    certificateAudit: {
      generationCount: 0,
      downloadCount: 0,
      revocationCount: 0,
      verificationCount: 0,
      logs: []
    },
    activeTestSessions: [],
    studentConsents: [],
    blockedAttempts: [],
    studentWhitelists: [],
    adminDevice: null,
    adminLoginLogs: [],
    adminRateLimit: { failedAttempts: 0, lockedUntil: 0 },
    proctoringExits: [],
    judgingSettings: {
      negativeMarking: 0,
      quizTimeLimitSeconds: 600,
      marksPerQuestion: 1.25,
      judgingCriteriaText: ''
    },
    proctoringSettings: {
      violationMode: 'immediate_exit',
      warningsAllowed: 0,
      noFaceSeconds: 10,
      phoneConfidence: 0.55
    }
  };
}

function normalizeStore(store) {
  const defaults = getDefaultStore();
  if (!store || typeof store !== 'object') return defaults;
  return {
    ...defaults,
    ...store,
    students: Array.isArray(store.students) ? store.students : [],
    submissions: Array.isArray(store.submissions) ? store.submissions : [],
    certificates: Array.isArray(store.certificates) ? store.certificates : [],
    manualOverrides: store.manualOverrides && typeof store.manualOverrides === 'object' ? store.manualOverrides : {},
    userConsentsMap: store.userConsentsMap && typeof store.userConsentsMap === 'object' ? store.userConsentsMap : {},
    proctoringFlags: Array.isArray(store.proctoringFlags) ? store.proctoringFlags : [],
    emailLogs: Array.isArray(store.emailLogs) ? store.emailLogs : [],
    resultsPublished: store.resultsPublished ?? false,
    allowExitedStudentsForCert: store.allowExitedStudentsForCert ?? false,
    pendingVerifications: store.pendingVerifications && typeof store.pendingVerifications === 'object' ? store.pendingVerifications : {},
    registrationRateLimits: store.registrationRateLimits && typeof store.registrationRateLimits === 'object' ? store.registrationRateLimits : {},
    registrationSettings: {
      ...defaults.registrationSettings,
      ...(store.registrationSettings && typeof store.registrationSettings === 'object' ? store.registrationSettings : {})
    },
    activeTestSessions: Array.isArray(store.activeTestSessions) ? store.activeTestSessions : [],
    studentConsents: Array.isArray(store.studentConsents) ? store.studentConsents : [],
    blockedAttempts: Array.isArray(store.blockedAttempts) ? store.blockedAttempts : [],
    studentWhitelists: Array.isArray(store.studentWhitelists) ? store.studentWhitelists : [],
    proctoringExits: Array.isArray(store.proctoringExits) ? store.proctoringExits : [],
    certificateAudit: store.certificateAudit || defaults.certificateAudit
  };
}

/**
 * Read store from memory -> /tmp (on serverless) -> root data-store.json
 */
export function readLocalStore() {
  const isVercel = Boolean(process.env.VERCEL);
  if (isVercel && globalThis.__TECHNOVA_SHARED_STORE__) {
    return normalizeStore(globalThis.__TECHNOVA_SHARED_STORE__);
  }

  let loaded = null;
  // 1. On Vercel serverless, check writable /tmp store first
  if (isVercel) {
    try {
      if (fs.existsSync(TMP_STORE_PATH)) {
        loaded = JSON.parse(fs.readFileSync(TMP_STORE_PATH, 'utf-8'));
      }
    } catch (e) {}
  }

  // 2. Read project root data-store.json
  if (!loaded) {
    try {
      if (fs.existsSync(ROOT_STORE_PATH)) {
        loaded = JSON.parse(fs.readFileSync(ROOT_STORE_PATH, 'utf-8'));
      }
    } catch (e) {}
  }

  const store = normalizeStore(loaded);
  globalThis.__TECHNOVA_SHARED_STORE__ = store;
  return store;
}

/**
 * Write store to memory, /tmp, and root data-store.json (when writable)
 */
export function writeLocalStore(store) {
  const normalized = normalizeStore(store);
  globalThis.__TECHNOVA_SHARED_STORE__ = normalized;
  const serialized = JSON.stringify(normalized, null, 2);

  // Always write to /tmp (writable on Vercel Serverless and local OS)
  try {
    fs.writeFileSync(TMP_STORE_PATH, serialized, 'utf-8');
  } catch (e) {}

  // Write to project root data-store.json when running locally (skip on Vercel read-only fs)
  if (!process.env.VERCEL) {
    try {
      fs.writeFileSync(ROOT_STORE_PATH, serialized, 'utf-8');
    } catch (e) {}
  }
}

/**
 * Merge two store objects non-destructively so no student or submission is ever lost
 */
export function mergeStores(target, incoming) {
  if (!incoming || typeof incoming !== 'object') return target;
  const out = normalizeStore(target);

  // 1. Merge students by normalized PRN or UID
  if (Array.isArray(incoming.students)) {
    for (const s of incoming.students) {
      if (!s || (!s.prn && !s.uid)) continue;
      const normPrn = String(s.prn || '').trim().toUpperCase();
      const idx = out.students.findIndex(
        ex => (normPrn && String(ex.prn || '').trim().toUpperCase() === normPrn) || (s.uid && ex.uid === s.uid)
      );
      if (idx >= 0) {
        out.students[idx] = {
          ...out.students[idx],
          ...s,
          prn: normPrn || out.students[idx].prn,
          sessionToken: s.sessionToken || out.students[idx].sessionToken
        };
      } else {
        out.students.push({
          ...s,
          prn: normPrn || s.prn
        });
      }
    }
  }

  // 2. Merge submissions by (PRN or userId) + day, keeping highest score
  if (Array.isArray(incoming.submissions)) {
    for (const sub of incoming.submissions) {
      if (!sub || !sub.day) continue;
      const normPrn = String(sub.prn || '').trim().toUpperCase();
      const dayNum = Number(sub.day);
      const idx = out.submissions.findIndex(
        ex =>
          Number(ex.day) === dayNum &&
          ((normPrn && String(ex.prn || '').trim().toUpperCase() === normPrn) ||
            (sub.userId && ex.userId === sub.userId))
      );
      if (idx >= 0) {
        const existing = out.submissions[idx];
        const existingPts = Number(existing.points || 0);
        const incomingPts = Number(sub.points || 0);
        if (incomingPts >= existingPts) {
          out.submissions[idx] = {
            ...existing,
            ...sub,
            prn: normPrn || existing.prn,
            points: Math.max(existingPts, incomingPts),
            programScore: Math.max(Number(existing.programScore || 0), Number(sub.programScore || 0)),
            quizScore: sub.quizDisqualified ? 0 : Math.max(Number(existing.quizScore || 0), Number(sub.quizScore || 0))
          };
        }
      } else {
        out.submissions.push({
          ...sub,
          prn: normPrn || sub.prn,
          day: dayNum
        });
      }
    }
  }

  // 3. Merge certificates by certificateId or PRN
  if (Array.isArray(incoming.certificates)) {
    for (const cert of incoming.certificates) {
      if (!cert || (!cert.certificateId && !cert.prn)) continue;
      const idx = out.certificates.findIndex(
        ex =>
          (cert.certificateId && ex.certificateId === cert.certificateId) ||
          (cert.prn && String(ex.prn || '').toUpperCase() === String(cert.prn).toUpperCase())
      );
      if (idx >= 0) {
        out.certificates[idx] = { ...out.certificates[idx], ...cert };
      } else {
        out.certificates.push(cert);
      }
    }
  }

  // 4. Merge maps
  if (incoming.manualOverrides && typeof incoming.manualOverrides === 'object') {
    out.manualOverrides = { ...out.manualOverrides, ...incoming.manualOverrides };
  }
  if (incoming.userConsentsMap && typeof incoming.userConsentsMap === 'object') {
    out.userConsentsMap = { ...out.userConsentsMap, ...incoming.userConsentsMap };
  }

  return out;
}

/**
 * Hydrate store from Supabase (if SUPABASE_URL & key are configured)
 */
export async function syncFromSupabaseIfConfigured(localStore) {
  const cfg = getSupabaseConfig();
  if (!cfg) return localStore;

  const headers = {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Fetch app_state snapshot + users + submissions from Supabase REST API
    const [stateRes, usersRes, subsRes, certsRes] = await Promise.all([
      fetch(`${cfg.url}/rest/v1/app_state?key=eq.main_store&select=value`, { headers }).catch(() => null),
      fetch(`${cfg.url}/rest/v1/users?select=*`, { headers }).catch(() => null),
      fetch(`${cfg.url}/rest/v1/submissions?select=*`, { headers }).catch(() => null),
      fetch(`${cfg.url}/rest/v1/certificates?select=*`, { headers }).catch(() => null)
    ]);

    let merged = normalizeStore(localStore);

    if (stateRes && stateRes.ok) {
      const rows = await stateRes.json();
      if (Array.isArray(rows) && rows[0]?.value) {
        merged = mergeStores(merged, rows[0].value);
      }
    }

    if (usersRes && usersRes.ok) {
      const dbUsers = await usersRes.json();
      if (Array.isArray(dbUsers) && dbUsers.length > 0) {
        const mappedUsers = dbUsers.map(u => ({
          uid: u.uid,
          prn: u.prn,
          name: u.name,
          email: u.email,
          normalizedEmail: u.normalized_email || (u.email ? String(u.email).trim().toLowerCase() : ''),
          phone: u.phone || '',
          year: u.year,
          branch: u.branch,
          division: u.division || 'A',
          language: u.language || u.track || 'Python',
          track: u.track || u.language || 'Python',
          role: u.role || 'student',
          genuineConsent: u.genuine_consent !== false,
          emailVerified: Boolean(u.email_verified),
          phoneVerified: Boolean(u.phone_verified),
          verifiedAt: u.verified_at || null,
          accountStatus: u.account_status || (u.email_verified ? 'verified' : 'unverified'),
          suspendedReason: u.suspended_reason || null,
          needsLegacyVerification: Boolean(u.needs_legacy_verification),
          registeredAt: u.registered_at || u.created_at || null,
          sessionToken: u.session_token || null
        }));
        merged = mergeStores(merged, { students: mappedUsers });
      }
    }

    if (subsRes && subsRes.ok) {
      const dbSubs = await subsRes.json();
      if (Array.isArray(dbSubs) && dbSubs.length > 0) {
        const mappedSubs = dbSubs.map(s => ({
          id: s.id,
          userId: s.user_id,
          prn: s.prn,
          studentName: s.student_name,
          day: Number(s.day),
          language: s.language || s.track || 'Python',
          track: s.track || s.language || 'Python',
          code: s.code || '',
          variant: s.variant || 'A',
          githubRepo: s.github_repo || '',
          solutionNote: s.solution_note || '',
          demoLink: s.demo_link || '',
          programScore: Number(s.program_score || 0),
          quizScore: Number(s.quiz_score || 0),
          quizCorrect: Number(s.quiz_correct || 0),
          quizTotal: Number(s.quiz_total || 8),
          quizSubmitted: Boolean(s.quiz_submitted),
          quizDisqualified: Boolean(s.quiz_disqualified),
          quizDisqualificationReason: s.quiz_disqualification_reason || null,
          points: Number(s.points || 0),
          rawTotal: Number(s.raw_total || 0),
          isCatchup: Boolean(s.is_catchup),
          attempts: Number(s.attempts || 1),
          testResults: s.test_results || null,
          tabSwitches: Number(s.tab_switches || 0),
          fullScreenExits: Number(s.full_screen_exits || 0),
          proctoringFlagsCount: Number(s.proctoring_flags_count || 0),
          status: s.status || 'approved',
          exitReason: s.exit_reason || null,
          exitedAt: s.exited_at || null,
          vivaRequired: Boolean(s.viva_required),
          needsViva: Boolean(s.needs_viva),
          failedViva: Boolean(s.failed_viva),
          vivaNotes: s.viva_notes || '',
          submittedAt: s.submitted_at
        }));
        merged = mergeStores(merged, { submissions: mappedSubs });
      }
    }

    if (certsRes && certsRes.ok) {
      const dbCerts = await certsRes.json();
      if (Array.isArray(dbCerts) && dbCerts.length > 0) {
        const mappedCerts = dbCerts.map(c => ({
          certificateId: c.certificate_id,
          userId: c.user_id,
          prn: c.prn,
          studentName: c.student_name,
          email: c.email,
          language: c.language || c.track || 'Python',
          track: c.track || c.language || 'Python',
          score: Number(c.score || 0),
          rank: c.rank,
          type: c.type || 'Participation',
          startDate: c.start_date || '14 Oct 2026',
          endDate: c.end_date || '22 Oct 2026',
          issueDate: c.issue_date || '23 Oct 2026',
          issuedDate: c.issue_date || '23 Oct 2026',
          status: c.status || 'valid',
          revokedReason: c.revoked_reason,
          revokedAt: c.revoked_at,
          verificationCount: Number(c.verification_count || 0),
          downloadCount: Number(c.download_count || 0),
          generatedAt: c.generated_at
        }));
        merged = mergeStores(merged, { certificates: mappedCerts });
      }
    }

    writeLocalStore(merged);
    return merged;
  } catch (err) {
    console.error('[dbAdapter] Supabase read warning:', err.message);
    return localStore;
  }
}

/**
 * Persist store changes to Supabase (if configured)
 */
export async function pushToSupabaseIfConfigured(store) {
  const cfg = getSupabaseConfig();
  if (!cfg) return;

  const headers = {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates'
  };

  try {
    const promises = [];

    // 1. Upsert app_state snapshot
    promises.push(
      fetch(`${cfg.url}/rest/v1/app_state?on_conflict=key`, {
        method: 'POST',
        headers,
        body: JSON.stringify([{
          key: 'main_store',
          value: store,
          updated_at: new Date().toISOString()
        }])
      }).catch(() => null)
    );

    // 2. Upsert users table
    if (Array.isArray(store.students) && store.students.length > 0) {
      const userRows = store.students
        .filter(u => u && u.prn)
        .map(u => ({
          uid: u.uid || `svit-stu-${String(u.prn).trim().toUpperCase()}`,
          prn: String(u.prn).trim().toUpperCase(),
          name: u.name || 'Student',
          email: u.email || `${String(u.prn).trim().toLowerCase()}@svit.ac.in`,
          normalized_email: u.normalizedEmail || (u.email ? String(u.email).trim().toLowerCase() : null),
          phone: u.phone || null,
          year: u.year || 'First Year (FE)',
          branch: u.branch || 'Computer Engineering',
          division: u.division || 'A',
          language: u.language || u.track || 'Python',
          track: u.track || u.language || 'Python',
          role: u.role || 'student',
          genuine_consent: u.genuineConsent !== false,
          email_verified: Boolean(u.emailVerified),
          phone_verified: Boolean(u.phoneVerified),
          verified_at: u.verifiedAt || null,
          account_status: u.accountStatus || (u.emailVerified ? 'verified' : 'unverified'),
          suspended_reason: u.suspendedReason || null,
          needs_legacy_verification: Boolean(u.needsLegacyVerification),
          registered_at: u.registeredAt || new Date().toISOString(),
          session_token: u.sessionToken || null,
          updated_at: new Date().toISOString()
        }));
      if (userRows.length > 0) {
        promises.push(
          fetch(`${cfg.url}/rest/v1/users?on_conflict=prn`, {
            method: 'POST',
            headers,
            body: JSON.stringify(userRows)
          }).catch(() => null)
        );
      }
    }

    // 3. Upsert submissions table
    if (Array.isArray(store.submissions) && store.submissions.length > 0) {
      const subRows = store.submissions
        .filter(s => s && s.day && (s.prn || s.userId))
        .map(s => {
          const prn = String(s.prn || s.userId).trim().toUpperCase();
          return {
            id: s.id || `sub-${prn}-day-${s.day}`,
            user_id: s.userId || `svit-stu-${prn}`,
            prn,
            student_name: s.studentName || 'Student',
            day: Number(s.day),
            language: s.language || s.track || 'Python',
            track: s.track || s.language || 'Python',
            code: s.code || '',
            variant: s.variant || 'A',
            github_repo: s.githubRepo || '',
            solution_note: s.solutionNote || '',
            demo_link: s.demoLink || '',
            program_score: Number(s.programScore || 0),
            quiz_score: Number(s.quizScore || 0),
            quiz_correct: Number(s.quizCorrect || 0),
            quiz_total: Number(s.quizTotal || 8),
            quiz_submitted: Boolean(s.quizSubmitted),
            quiz_disqualified: Boolean(s.quizDisqualified),
            quiz_disqualification_reason: s.quizDisqualificationReason || null,
            points: Number(s.points || 0),
            raw_total: Number(s.rawTotal || 0),
            is_catchup: Boolean(s.isCatchup),
            attempts: Number(s.attempts || 1),
            test_results: s.testResults || null,
            tab_switches: Number(s.tabSwitches || 0),
            full_screen_exits: Number(s.fullScreenExits || 0),
            proctoring_flags_count: Number(s.proctoringFlagsCount || 0),
            status: s.status || 'approved',
            exit_reason: s.exitReason || null,
            exited_at: s.exitedAt || null,
            viva_required: Boolean(s.vivaRequired),
            needs_viva: Boolean(s.needsViva),
            failed_viva: Boolean(s.failedViva),
            viva_notes: s.vivaNotes || '',
            submitted_at: s.submittedAt || new Date().toISOString()
          };
        });
      if (subRows.length > 0) {
        promises.push(
          fetch(`${cfg.url}/rest/v1/submissions?on_conflict=prn,day`, {
            method: 'POST',
            headers,
            body: JSON.stringify(subRows)
          }).catch(() => null)
        );
      }
    }

    await Promise.all(promises);
  } catch (err) {
    console.error('[dbAdapter] Supabase write warning:', err.message);
  }
}
