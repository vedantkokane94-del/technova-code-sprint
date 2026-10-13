import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  SEED_TASKS, 
  SPRINT_SCHEDULE, 
  SPRINT_START_DATE, 
  SPRINT_END_DATE, 
  SPRINT_ISSUE_DATE, 
  getSprintDaySchedule,
  getEffectiveSprintDay,
  isDayUnlocked,
  getDayUnlockTimeUtc,
  getDayDeadlineTimeUtc
} from '../data/tasksSeed';
import { getTaskVariant, calculateTextSimilarity, detectAiGeneratedContent } from '../utils/hash';
import { calculateDayScore, computeUserSummary, formatScore, toScoreNumber, DAY_POINTS, PASS_MARK_POINTS, TOTAL_SPRINT_POINTS } from '../utils/scoring';
import { DEFAULT_TEMPLATE_CONFIG } from '../utils/certificateGenerator';
import { 
  checkAdminSession, 
  logoutAdminApi,
  fetchSharedStateApi,
  loginOrRegisterStudentApi,
  logoutStudentApi,
  submitTaskSolutionApi,
  syncLocalBrowserDataApi
} from '../services/api';

const AppContext = createContext();

// Fresh start: ready for real student registrations
const INITIAL_STUDENTS = [];
const INITIAL_SUBMISSIONS = [];

const SESSION_TOKEN_KEY = 'technova_session_token';

export const AppProvider = ({ children }) => {
  // Theme state: light / dark
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('technova_theme') || 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('technova_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Student Session Token: Only the session token is stored in the browser (Step 4)
  const [sessionToken, setSessionTokenState] = useState(() => {
    return localStorage.getItem(SESSION_TOKEN_KEY) || null;
  });

  const setSessionToken = useCallback((token) => {
    setSessionTokenState(token);
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  }, []);

  // Active User loaded from shared database via sessionToken
  const [user, setUserState] = useState(null);

  // Tasks State
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('technova_tasks');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return SEED_TASKS; }
    }
    return SEED_TASKS;
  });

  const updateTasks = (newTasks) => {
    setTasks(newTasks);
    localStorage.setItem('technova_tasks', JSON.stringify(newTasks));
  };

  // Submissions State (single source of truth: shared database)
  const [submissions, setSubmissions] = useState([]);

  const saveSubmissions = (newSubs) => {
    setSubmissions(newSubs);
    syncLocalBrowserDataApi({ submissions: newSubs }).catch(() => {});
  };

  // Registered Students State (single source of truth: shared database)
  const [students, setStudents] = useState([]);

  const saveStudents = (newStudents) => {
    setStudents(newStudents);
    syncLocalBrowserDataApi({ students: newStudents }).catch(() => {});
  };

  // Certificates State (single source of truth: shared database)
  const [certificates, setCertificates] = useState([]);

  const saveCertificates = (newCerts) => {
    setCertificates(newCerts);
    syncLocalBrowserDataApi({ certificates: newCerts }).catch(() => {});
  };

  // Manual Eligibility Overrides State (map of userId/prn -> boolean)
  const [manualOverrides, setManualOverrides] = useState({});

  const toggleManualOverride = (studentKey) => {
    setManualOverrides(prev => {
      const currentVal = prev[studentKey];
      const next = { ...prev };
      if (currentVal === undefined) {
        // Toggle from current auto state
        const auto = getStudentEligibility(studentKey).autoEligible;
        next[studentKey] = !auto;
      } else {
        next[studentKey] = !currentVal;
      }
      syncLocalBrowserDataApi({ manualOverrides: next }).catch(() => {});
      return next;
    });
  };

  // Email delivery logs state
  const [emailLogs, setEmailLogs] = useState(() => {
    const saved = localStorage.getItem('technova_email_logs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
  });

  const addEmailLog = (logEntry) => {
    setEmailLogs(prev => {
      const next = [logEntry, ...prev];
      localStorage.setItem('technova_email_logs', JSON.stringify(next));
      return next;
    });
  };

  // Section 9.4: Daily send limit (default 400 for Gmail reliability)
  const [dailySendLimit, setDailySendLimit] = useState(() => {
    const saved = localStorage.getItem('technova_daily_send_limit');
    return saved ? parseInt(saved, 10) : 400;
  });

  const updateDailySendLimit = (newLimit) => {
    const val = Math.max(1, parseInt(newLimit, 10) || 400);
    setDailySendLimit(val);
    localStorage.setItem('technova_daily_send_limit', String(val));
  };

  // Section 9.4: Track daily sent count for Gmail quota
  const getTodayDateKey = () => new Date().toISOString().slice(0, 10);

  const [dailySentStats, setDailySentStats] = useState(() => {
    const saved = localStorage.getItem('technova_daily_sent_stats');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.date === getTodayDateKey()) return parsed;
      } catch (e) {}
    }
    return { date: getTodayDateKey(), count: 0 };
  });

  const incrementDailySentCount = (inc = 1) => {
    setDailySentStats(prev => {
      const today = getTodayDateKey();
      const current = prev.date === today ? prev.count : 0;
      const next = { date: today, count: current + inc };
      localStorage.setItem('technova_daily_sent_stats', JSON.stringify(next));
      return next;
    });
  };

  // Section 9.6: Resend requests made by students (maximum 2 per student)
  const [resendRequests, setResendRequests] = useState(() => {
    const saved = localStorage.getItem('technova_resend_requests');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return {}; }
    }
    return {};
  });

  const requestCertificateResend = (studentKey, reason = '') => {
    const current = resendRequests[studentKey] || { count: 0, requests: [] };
    if (current.count >= 2) {
      return { success: false, message: "Maximum of 2 resend requests reached." };
    }
    const nextEntry = {
      count: current.count + 1,
      lastRequestedAt: new Date().toISOString(),
      requests: [
        ...current.requests,
        { requestedAt: new Date().toISOString(), reason }
      ]
    };
    const next = { ...resendRequests, [studentKey]: nextEntry };
    setResendRequests(next);
    localStorage.setItem('technova_resend_requests', JSON.stringify(next));
    return { 
      success: true, 
      count: nextEntry.count, 
      message: `Resend request submitted to faculty admin (${nextEntry.count} of 2 used).` 
    };
  };

  // Section 9.5: Batch run audit logs (who started each run and when)
  const [emailAuditRuns, setEmailAuditRuns] = useState(() => {
    const saved = localStorage.getItem('technova_email_audit_runs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
  });

  const logEmailAuditRun = (runRecord) => {
    setEmailAuditRuns(prev => {
      const entry = {
        id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        ...runRecord
      };
      const next = [entry, ...prev.slice(0, 99)];
      localStorage.setItem('technova_email_audit_runs', JSON.stringify(next));
      return next;
    });
  };

  // User Proctoring & Honor Code Consents (remembers across Days 2 to 9, synced with shared DB)
  const [userConsents, setUserConsents] = useState({});

  const saveUserConsent = (userId, consentData = {}) => {
    if (!userId) return;
    setUserConsents(prev => {
      const next = {
        ...prev,
        [userId]: {
          ...(prev[userId] || {}),
          ...consentData,
          consentGiven: true,
          consentedAt: consentData.consentedAt || new Date().toISOString()
        }
      };
      syncLocalBrowserDataApi({ userConsents: next }).catch(() => {});
      return next;
    });
  };

  const hasUserGivenConsent = (userId) => {
    if (!userId) return false;
    return Boolean(userConsents[userId]?.consentGiven);
  };

  // Section 4: Certificate Template Configuration & Approval
  const [templateConfig, setTemplateConfig] = useState(() => {
    const saved = localStorage.getItem('technova_cert_template_config');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return DEFAULT_TEMPLATE_CONFIG; }
    }
    return DEFAULT_TEMPLATE_CONFIG;
  });

  const updateTemplateConfig = (patch) => {
    setTemplateConfig(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem('technova_cert_template_config', JSON.stringify(next));
      return next;
    });
  };

  const approveCertificateTemplate = (approverName = "Vedant Kokane") => {
    setTemplateConfig(prev => {
      const next = {
        ...prev,
        isApproved: true,
        approvedAt: new Date().toISOString(),
        approvedBy: approverName
      };
      localStorage.setItem('technova_cert_template_config', JSON.stringify(next));
      return next;
    });
  };

  const unlockCertificateTemplate = () => {
    setTemplateConfig(prev => {
      const next = {
        ...prev,
        isApproved: false,
        approvedAt: null,
        approvedBy: null
      };
      localStorage.setItem('technova_cert_template_config', JSON.stringify(next));
      return next;
    });
  };

  // Section 2 & 3: Exam Judging & Proctoring Settings
  const DEFAULT_EXAM_SETTINGS = {
    negativeMarking: 0,
    quizTimeLimitSeconds: 600,
    passMark: 50,
    judgingCriteriaText: '',
    violationMode: 'immediate_exit',
    warningsAllowed: 0,
    noFaceSeconds: 10,
    phoneConfidence: 0.55
  };

  const [examSettings, setExamSettings] = useState(() => {
    const saved = localStorage.getItem('technova_exam_settings');
    if (saved) {
      try { return { ...DEFAULT_EXAM_SETTINGS, ...JSON.parse(saved) }; } catch (e) {}
    }
    return DEFAULT_EXAM_SETTINGS;
  });

  const updateExamSettings = (patch) => {
    setExamSettings(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem('technova_exam_settings', JSON.stringify(next));
      fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ judgingSettings: next, proctoringSettings: next }),
        credentials: 'same-origin'
      }).catch(() => {});
      return next;
    });
  };

  // Results Published and Certificate Eligibility Settings (synced with server)
  const [resultsPublished, setResultsPublished] = useState(false);
  const [allowExitedStudentsForCert, setAllowExitedStudentsForCert] = useState(false);

  const toggleResultsPublished = async (newVal) => {
    const val = Boolean(newVal !== undefined ? newVal : !resultsPublished);
    setResultsPublished(val);
    try {
      await fetch('/api/certificates/toggle-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultsPublished: val }),
        credentials: 'same-origin'
      });
    } catch (e) {}
    return val;
  };

  const toggleAllowExitedForCert = async (newVal) => {
    const val = Boolean(newVal !== undefined ? newVal : !allowExitedStudentsForCert);
    setAllowExitedStudentsForCert(val);
    try {
      await fetch('/api/certificates/toggle-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowExitedStudentsForCert: val }),
        credentials: 'same-origin'
      });
    } catch (e) {}
    return val;
  };

  // Admin Test Mode & Simulated Server Time
  const [adminTestMode, setAdminTestModeState] = useState(() => {
    return localStorage.getItem('technova_admin_test_mode') === 'true';
  });

  const setAdminTestMode = (val) => {
    setAdminTestModeState(Boolean(val));
    localStorage.setItem('technova_admin_test_mode', String(Boolean(val)));
  };

  const [simulatedServerTime, setSimulatedServerTimeState] = useState(() => {
    const saved = localStorage.getItem('technova_simulated_time');
    return saved ? parseInt(saved, 10) : null;
  });

  const setSimulatedServerTime = (timeMsOrNull) => {
    if (timeMsOrNull === null || timeMsOrNull === undefined) {
      setSimulatedServerTimeState(null);
      localStorage.removeItem('technova_simulated_time');
    } else {
      setSimulatedServerTimeState(timeMsOrNull);
      localStorage.setItem('technova_simulated_time', String(timeMsOrNull));
    }
  };

  const getEffectiveServerTime = () => {
    return simulatedServerTime || Date.now();
  };

  const clearTestStudentData = () => {
    setSubmissions(prev => {
      const filtered = prev.filter(s => {
        const isTest = s.prn?.startsWith('TEST-') || s.prn?.startsWith('DEMO-') || s.email?.includes('test') || s.studentName?.toLowerCase().includes('test student');
        return !isTest;
      });
      return filtered;
    });

    setStudents(prev => {
      const filtered = prev.filter(s => {
        const isTest = s.prn?.startsWith('TEST-') || s.prn?.startsWith('DEMO-') || s.email?.includes('test') || s.name?.toLowerCase().includes('test student');
        return !isTest;
      });
      return filtered;
    });
  };

  // Combined directory of all students
  const getAllStudents = () => {
    const map = new Map();
    students.forEach(s => map.set(s.uid || s.prn, s));
    submissions.forEach(sub => {
      const key = sub.userId || sub.prn;
      if (!map.has(key)) {
        map.set(key, {
          uid: sub.userId,
          name: sub.studentName,
          prn: sub.prn,
          email: sub.email || `${sub.prn?.toLowerCase()}@svit.ac.in`,
          language: sub.language || sub.track || 'Python',
          track: sub.track || sub.language || 'Python',
          role: 'student'
        });
      }
    });
    if (user && user.role !== 'admin' && user.prn) {
      const key = user.uid || user.prn;
      if (!map.has(key)) {
        map.set(key, user);
      }
    }
    return Array.from(map.values());
  };

  // Check eligibility for a student (pass mark points, not in Pending review, proctoring exit check, manual override check)
  const getStudentEligibility = (studentKey) => {
    const studentSubs = submissions.filter(s => s.userId === studentKey || s.prn === studentKey);
    const summary = computeUserSummary(studentSubs, manualOverrides[studentKey] ?? manualOverrides[studentSubs[0]?.prn]);
    const totalScore = summary.totalScore;
    const hasFailedViva = studentSubs.some(s => s.failedViva);
    const hasUnresolvedFlag = studentSubs.some(s => s.needsViva || s.vivaRequired || s.status === 'flagged');
    const hasDisqualification = studentSubs.some(s => s.status === 'exited' || s.quizDisqualified);

    const passMark = Number(examSettings?.passMark) || 50;
    const isBlockedByExit = hasDisqualification && !allowExitedStudentsForCert;

    // Disqualified or exited students (tab switch, proctoring violation) are not eligible by default unless allowExitedStudentsForCert is enabled
    const autoEligible = totalScore >= passMark && !hasFailedViva && !hasUnresolvedFlag && !isBlockedByExit;
    const isOverridden = manualOverrides[studentKey] !== undefined;
    const isEligible = isOverridden ? manualOverrides[studentKey] : autoEligible;

    return {
      isEligible,
      autoEligible,
      isOverridden,
      overrideValue: manualOverrides[studentKey],
      totalScore,
      summary,
      daysCount: summary.completedCount,
      hasFailedViva,
      hasUnresolvedFlag,
      hasDisqualification,
      isBlockedByExit,
      submissionsCount: studentSubs.length,
      progressStatus: summary.progressStatus
    };
  };

  // Generate random 4-character suffix for Certificate IDs (TNV-CS-2026-0001-K7Q2)
  const generateRandomSuffix = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let res = "";
    for (let i = 0; i < 4; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  // Next Certificate ID generator: TNV-CS-2026-0001-K7Q2
  const getNextCertificateId = () => {
    let maxNum = 0;
    certificates.forEach(c => {
      if (c.certificateId && c.certificateId.startsWith('TNV-CS-2026-')) {
        const parts = c.certificateId.split('-');
        if (parts.length >= 4) {
          const numPart = parseInt(parts[3], 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        }
      }
    });
    const nextNum = maxNum + 1;
    const seqStr = String(nextNum).padStart(4, '0');
    return `TNV-CS-2026-${seqStr}-${generateRandomSuffix()}`;
  };

  // Issue or fetch Certificate for student
  const issueCertificate = (student) => {
    const existing = certificates.find(c => c.userId === student.uid || c.prn === student.prn);
    if (existing) return existing;

    const studentSubs = submissions.filter(s => s.userId === student.uid || s.prn === student.prn);
    const summary = computeUserSummary(studentSubs, manualOverrides[student.uid || student.prn]);

    const certId = getNextCertificateId();
    const newCert = {
      certificateId: certId,
      userId: student.uid,
      studentName: student.name,
      prn: student.prn,
      email: student.email || `${student.prn?.toLowerCase()}@svit.ac.in`,
      language: student.language || student.track || 'Python',
      track: student.language || student.track || 'Python',
      score: summary.totalScore,
      startDate: SPRINT_START_DATE,
      endDate: SPRINT_END_DATE,
      issuedDate: SPRINT_ISSUE_DATE,
      pdfUrl: null,
      status: 'valid', // 'valid' | 'revoked'
      revokedReason: null,
      revokedAt: null,
      errorReason: null,
      sentAt: null
    };

    const nextCerts = [...certificates, newCert];
    saveCertificates(nextCerts);
    return newCert;
  };

  // Revoke a certificate with reason
  const revokeCertificate = (certificateId, reason) => {
    setCertificates(prev => {
      const next = prev.map(c => {
        if (c.certificateId === certificateId) {
          return {
            ...c,
            status: 'revoked',
            revokedReason: reason || "Administrative revocation",
            revokedAt: new Date().toISOString()
          };
        }
        return c;
      });
      syncLocalBrowserDataApi({ certificates: next }).catch(() => {});
      return next;
    });
  };

  // Reissue a revoked certificate
  const reissueCertificate = (certificateId) => {
    setCertificates(prev => {
      const next = prev.map(c => {
        if (c.certificateId === certificateId) {
          return {
            ...c,
            status: 'valid',
            revokedReason: null,
            revokedAt: null,
            reissuedAt: new Date().toISOString()
          };
        }
        return c;
      });
      syncLocalBrowserDataApi({ certificates: next }).catch(() => {});
      return next;
    });
  };

  // Update status for a certificate
  const updateCertificateStatus = (certificateId, statusUpdate) => {
    setCertificates(prev => {
      const next = prev.map(c => {
        if (c.certificateId === certificateId) {
          return { ...c, ...statusUpdate };
        }
        return c;
      });
      syncLocalBrowserDataApi({ certificates: next }).catch(() => {});
      return next;
    });
  };

  // Verification Logs state (Section 4)
  const [verificationLogs, setVerificationLogs] = useState(() => {
    const saved = localStorage.getItem('technova_verification_logs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
  });

  const logVerification = useCallback((certificateId, result, details = {}) => {
    const entry = {
      id: `ver-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      certificateId,
      result, // 'valid' | 'revoked' | 'not_found'
      timestamp: new Date().toISOString(),
      ...details
    };
    setVerificationLogs(prev => {
      const next = [entry, ...prev.slice(0, 199)];
      try {
        localStorage.setItem('technova_verification_logs', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    return entry;
  }, []);

  // Proctoring Flags state (Section 5, synced with shared DB)
  const [proctoringFlags, setProctoringFlags] = useState([]);

  const addProctoringFlag = (flagData) => {
    const newFlag = {
      id: `flag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      status: 'pending', // 'pending' | 'dismissed' | 'reviewed_no_issue' | 'needs_viva'
      ...flagData
    };
    setProctoringFlags(prev => {
      const next = [newFlag, ...prev];
      syncLocalBrowserDataApi({ proctoringFlags: next }).catch(() => {});
      return next;
    });
    return newFlag;
  };

  const updateProctoringFlag = (flagId, newStatus, adminNotes = "") => {
    setProctoringFlags(prev => {
      const next = prev.map(f => {
        if (f.id === flagId) {
          return {
            ...f,
            status: newStatus,
            adminNotes,
            reviewedAt: new Date().toISOString()
          };
        }
        return f;
      });
      syncLocalBrowserDataApi({ proctoringFlags: next }).catch(() => {});
      return next;
    });

    // If admin marks "Needs viva", set vivaRequired on that student's submission
    if (newStatus === 'needs_viva') {
      const flag = proctoringFlags.find(f => f.id === flagId);
      if (flag) {
        setSubmissions(prev => {
          const next = prev.map(s => {
            if (s.userId === flag.userId && Number(s.day) === Number(flag.day)) {
              return {
                ...s,
                needsViva: true,
                vivaRequired: true,
                status: 'flagged',
                vivaNotes: adminNotes || flag.reason
              };
            }
            return s;
          });
          syncLocalBrowserDataApi({ submissions: next }).catch(() => {});
          return next;
        });
      }
    }
  };

  const clearAllData = () => {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem('technova_active_user');
    localStorage.removeItem('technova_submissions');
    localStorage.removeItem('technova_certificates');
    localStorage.removeItem('technova_manual_overrides');
    localStorage.removeItem('technova_email_logs');
    localStorage.removeItem('technova_students');
    localStorage.removeItem('technova_proctoring_flags');
    localStorage.removeItem('technova_verification_logs');
    localStorage.removeItem('technova_daily_sent_stats');
    localStorage.removeItem('technova_resend_requests');
    localStorage.removeItem('technova_email_audit_runs');
    localStorage.removeItem('technova_sprint_day');
    setSessionToken(null);
    setUserState(null);
    setSubmissions([]);
    setCertificates([]);
    setManualOverrides({});
    setEmailLogs([]);
    setStudents([]);
    setProctoringFlags([]);
    setVerificationLogs([]);
    setDailySentStats({ date: getTodayDateKey(), count: 0 });
    setResendRequests({});
    setEmailAuditRuns([]);
    setCurrentDay(1);
  };

  // Admin emails list
  const ADMIN_EMAILS = [
    "vedantkokane94@gmail.com",
    "admin@svit.ac.in",
    "faculty@svit.ac.in"
  ];

  // Server-Verified Administrator Session State
  const [isServerAdminAuthenticated, setIsServerAdminAuthenticated] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const isServerAdminRef = useRef(false);

  useEffect(() => {
    isServerAdminRef.current = isServerAdminAuthenticated;
  }, [isServerAdminAuthenticated]);

  /**
   * Refresh shared database state (users, submissions, certificates, leaderboard, settings)
   * and load the logged-in student's profile from the database using their sessionToken.
   */
  const refreshSharedState = useCallback(async (overrideToken = undefined) => {
    const activeToken = overrideToken !== undefined ? overrideToken : localStorage.getItem(SESSION_TOKEN_KEY);
    const data = await fetchSharedStateApi(activeToken);
    if (!data) return null;

    if (Array.isArray(data.students)) setStudents(data.students);
    if (Array.isArray(data.submissions)) setSubmissions(data.submissions);
    if (Array.isArray(data.certificates)) setCertificates(data.certificates);
    if (data.manualOverrides && typeof data.manualOverrides === 'object') setManualOverrides(data.manualOverrides);
    if (data.userConsents && typeof data.userConsents === 'object') setUserConsents(data.userConsents);
    if (Array.isArray(data.proctoringFlags)) setProctoringFlags(data.proctoringFlags);
    if (data.resultsPublished !== undefined) setResultsPublished(Boolean(data.resultsPublished));
    if (data.allowExitedStudentsForCert !== undefined) setAllowExitedStudentsForCert(Boolean(data.allowExitedStudentsForCert));

    // Step 4: Load the user's name, roll number and track from the database using the session token
    if (!isServerAdminRef.current) {
      if (data.user) {
        setUserState(data.user);
      } else if (!activeToken) {
        setUserState(prev => (prev?.role === 'admin' ? prev : null));
      }
    }
    return data;
  }, []);

  /**
   * Step 6 & Step 4:
   * 1. Migrate any existing browser-stored localStorage data into the shared database non-destructively.
   * 2. Remove raw user/student/submission keys from localStorage, keeping only `technova_session_token`.
   * 3. Hydrate all state from the shared database and poll periodically so every device shows the same data.
   */
  useEffect(() => {
    let isMounted = true;

    async function initializeAuthAndSharedDatabase() {
      try {
        // 1. Check Admin session cookie
        const adminRes = await checkAdminSession().catch(() => ({ authenticated: false }));
        if (isMounted && adminRes && adminRes.authenticated && adminRes.user) {
          setIsServerAdminAuthenticated(true);
          isServerAdminRef.current = true;
          setUserState(adminRes.user);
        } else if (isMounted) {
          setIsServerAdminAuthenticated(false);
          isServerAdminRef.current = false;
        }

        // 2. Step 6: Check if this browser has legacy localStorage data that needs to be migrated into the shared DB
        let currentToken = localStorage.getItem(SESSION_TOKEN_KEY);
        const rawLegacyUser = localStorage.getItem('technova_active_user');
        const rawLegacyStudents = localStorage.getItem('technova_students');
        const rawLegacySubmissions = localStorage.getItem('technova_submissions');
        const rawLegacyCerts = localStorage.getItem('technova_certificates');
        const rawLegacyOverrides = localStorage.getItem('technova_manual_overrides');
        const rawLegacyConsents = localStorage.getItem('technova_user_consents');

        const hasLegacyBrowserData = Boolean(
          rawLegacyUser || rawLegacyStudents || rawLegacySubmissions || rawLegacyCerts || rawLegacyOverrides || rawLegacyConsents
        );

        if (hasLegacyBrowserData) {
          const parseSafe = (str, fallback) => {
            if (!str) return fallback;
            try { return JSON.parse(str); } catch (e) { return fallback; }
          };
          const legacyUser = parseSafe(rawLegacyUser, null);
          const legacyStudents = parseSafe(rawLegacyStudents, []);
          const legacySubmissions = parseSafe(rawLegacySubmissions, []);
          const legacyCerts = parseSafe(rawLegacyCerts, []);
          const legacyOverrides = parseSafe(rawLegacyOverrides, {});
          const legacyConsents = parseSafe(rawLegacyConsents, {});

          const syncRes = await syncLocalBrowserDataApi({
            user: legacyUser && legacyUser.role !== 'admin' ? legacyUser : null,
            students: legacyStudents,
            submissions: legacySubmissions,
            certificates: legacyCerts,
            manualOverrides: legacyOverrides,
            userConsents: legacyConsents
          });

          if (syncRes && syncRes.success) {
            if (syncRes.sessionToken) {
              currentToken = syncRes.sessionToken;
              if (isMounted) setSessionToken(syncRes.sessionToken);
            }
            // Remove raw student/submission objects from localStorage so only the session token remains in the browser
            localStorage.removeItem('technova_active_user');
            localStorage.removeItem('technova_students');
            localStorage.removeItem('technova_submissions');
            localStorage.removeItem('technova_certificates');
            localStorage.removeItem('technova_manual_overrides');
            localStorage.removeItem('technova_user_consents');
            localStorage.removeItem('technova_proctoring_flags');
          }
        }

        // 3. Hydrate state from shared database
        await refreshSharedState(currentToken);
      } finally {
        if (isMounted) setIsSessionLoading(false);
      }
    }

    initializeAuthAndSharedDatabase();

    // Poll every 8 seconds and on window focus so all devices stay synchronized
    const interval = setInterval(() => {
      refreshSharedState();
    }, 8000);

    const handleFocus = () => {
      refreshSharedState();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshSharedState, setSessionToken]);

  /**
   * Step 4: Student Login / Registration via Shared Database
   * Supports both:
   * - mode: 'lookup' (sign in on any laptop/phone using Roll Number or Email)
   * - mode: 'register_or_update' (new student registration or profile update)
   * Keeps ONLY `technova_session_token` in browser localStorage.
   */
  const loginStudent = async (payload) => {
    const res = await loginOrRegisterStudentApi(payload);
    if (!res || !res.success) {
      return res || { success: false, error: 'Unable to sign in.' };
    }
    if (res.sessionToken) {
      setSessionToken(res.sessionToken);
    }
    localStorage.removeItem('technova_active_user');
    if (res.user) {
      setUserState(res.user);
    }
    if (Array.isArray(res.students)) {
      setStudents(res.students);
    }
    if (Array.isArray(res.submissions)) {
      setSubmissions(res.submissions);
    }
    return res;
  };

  /**
   * Student Logout: clears session token from browser and server
   */
  const logoutStudent = async () => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    setSessionToken(null);
    localStorage.removeItem('technova_active_user');
    setUserState(null);
    if (token) {
      await logoutStudentApi(token).catch(() => {});
    }
  };

  /**
   * Compatible setUser wrapper:
   * - If called with null, logs out and clears session token.
   * - If called with a student object, persists to the shared database and stores only the session token in localStorage.
   */
  const setUser = useCallback((nextUserOrUpdater) => {
    setUserState(prev => {
      const resolved = typeof nextUserOrUpdater === 'function' ? nextUserOrUpdater(prev) : nextUserOrUpdater;
      if (!resolved) {
        const token = localStorage.getItem(SESSION_TOKEN_KEY);
        localStorage.removeItem(SESSION_TOKEN_KEY);
        localStorage.removeItem('technova_active_user');
        if (token) logoutStudentApi(token).catch(() => {});
        return null;
      }
      if (resolved.role === 'admin') {
        return resolved;
      }
      // Sync student profile to shared database and store only session token
      localStorage.removeItem('technova_active_user');
      loginOrRegisterStudentApi({
        mode: 'register_or_update',
        ...resolved
      }).then(res => {
        if (res && res.success) {
          if (res.sessionToken) {
            setSessionToken(res.sessionToken);
          }
          if (res.user) {
            setUserState(res.user);
          }
          if (Array.isArray(res.students)) {
            setStudents(res.students);
          }
          if (Array.isArray(res.submissions)) {
            setSubmissions(res.submissions);
          }
        }
      }).catch(() => {});
      return resolved;
    });
  }, [setSessionToken]);

  // Admin Access Control: Server session must be verified (tamper-resistant)
  const isVedantAdmin = (u) => {
    if (!u) return false;
    return Boolean(isServerAdminAuthenticated && (u.role === 'admin' || (u.name && u.name.trim().toLowerCase() === 'vedant kokane')));
  };

  const isAdmin = Boolean(isServerAdminAuthenticated || (user?.role === 'admin' && isServerAdminAuthenticated));

  // Set authenticated admin user state
  const loginAsAdmin = (adminUser) => {
    setIsServerAdminAuthenticated(true);
    isServerAdminRef.current = true;
    const u = {
      uid: adminUser?.uid || `svit-admin-${Date.now()}`,
      name: adminUser?.name || "Vedant Kokane",
      email: adminUser?.email || "technicalteamsvit@gmail.com",
      prn: adminUser?.rollNo || adminUser?.prn || "SVIT-ADMIN-LEAD",
      year: "Faculty / Lead Organizer",
      branch: adminUser?.department || "Technical Skill Development Hub",
      track: "All Tracks",
      role: "admin",
      department: adminUser?.department || "Technical Skill Development Hub"
    };
    setUserState(u);
    return u;
  };

  // Logout admin session from server and client
  const logoutAdmin = async () => {
    try {
      await logoutAdminApi();
    } catch (e) {}
    setIsServerAdminAuthenticated(false);
    isServerAdminRef.current = false;
    setUserState(null);
    localStorage.removeItem('technova_active_user');
  };

  // Switch between Student and Admin
  const switchRole = (newRole) => {
    if (newRole === 'student') {
      const latestStudent = students[students.length - 1];
      setUserState(latestStudent || null);
    }
  };

  // Submit or edit task solution (strictly disabled for admin users; AI strictly prohibited)
  const submitTaskSolution = ({ 
    day, 
    code = '',
    language = 'Python',
    programScore = 0,
    quizScore = 0,
    quizCorrect = 0,
    quizTotal = 8,
    attempts = 1,
    testResults = null,
    githubRepo = '', 
    solutionNote = '', 
    demoLink = '', 
    tabSwitches = 0,
    fullScreenExits = 0,
    proctoringFlagsCount = 0,
    quizDisqualified = false,
    quizDisqualificationReason = '',
    status = null,
    exitReason = null,
    exitedAt = null
  }) => {
    if (!user) return { success: false, message: "Please sign in first." };
    if (user.role === 'admin' || isAdmin) {
      return { success: false, message: "Administrators cannot submit sprint tasks. Only registered students can submit." };
    }

    // Strict AI prohibition validation if solution note provided
    if (solutionNote && solutionNote.length > 20) {
      const aiCheck = detectAiGeneratedContent(solutionNote);
      if (aiCheck.isAiSuspected) {
        return {
          success: false,
          message: `${aiCheck.reason} Technova Code Sprint strictly prohibits the use of AI modules for code and explanation generation.`
        };
      }
    }

    const activeDay = Number(day);
    const isCatchup = activeDay < getCurrentSprintDay(); // Catch-up if submitted for a past day
    const assignedVariant = getTaskVariant(user.uid, activeDay);

    // Check if previous submission exists for this day
    const existingIndex = submissions.findIndex(
      s => (s.userId === user.uid || (s.prn && user.prn && s.prn.toUpperCase() === user.prn.toUpperCase())) && Number(s.day) === activeDay
    );
    const prevSub = existingIndex >= 0 ? submissions[existingIndex] : null;

    // Disqualify quiz if tab switched while attempting task, or explicitly disqualified
    const isDisqualifiedFromQuiz = Boolean(
      quizDisqualified || 
      prevSub?.quizDisqualified || 
      (tabSwitches > 0 && !prevSub?.quizSubmitted && !quizScore)
    );
    const effectiveQuizCorrect = isDisqualifiedFromQuiz ? 0 : quizCorrect;

    // Calculate score using Section 1 rules
    const dayScoreObj = calculateDayScore({
      day: activeDay,
      programScore,
      quizCorrect: effectiveQuizCorrect,
      quizTotal,
      isCatchup,
      failedViva: false,
      hasIntegrityViolation: false,
      quizDisqualified: isDisqualifiedFromQuiz
    });

    // Best of 3 attempts
    const finalProgramScore = prevSub ? Math.max(prevSub.programScore || 0, dayScoreObj.programScore) : dayScoreObj.programScore;
    const finalQuizScore = isDisqualifiedFromQuiz ? 0 : (prevSub ? Math.max(prevSub.quizScore || 0, dayScoreObj.quizScore) : dayScoreObj.quizScore);
    const currentPoints = isDisqualifiedFromQuiz 
      ? toScoreNumber(finalProgramScore * (isCatchup ? 0.5 : 1.0))
      : dayScoreObj.dayTotal;
    const finalPoints = prevSub 
      ? (isDisqualifiedFromQuiz ? currentPoints : Math.max(prevSub.points || 0, currentPoints)) 
      : currentPoints;
    const attemptCount = (prevSub?.attempts || 0) + (attempts > 1 ? 0 : 1);

    const newSubData = {
      id: prevSub ? prevSub.id : `sub-${user.prn || user.uid}-day-${activeDay}`,
      userId: user.uid,
      studentName: user.name,
      prn: user.prn,
      email: user.email || '',
      day: activeDay,
      language: language || user.language || user.track || 'Python',
      track: language || user.language || user.track || 'Python',
      code: code || prevSub?.code || '',
      variant: assignedVariant,
      githubRepo: githubRepo ? githubRepo.trim() : (prevSub?.githubRepo || ''),
      solutionNote: solutionNote ? solutionNote.trim() : (prevSub?.solutionNote || 'Verified solution code.'),
      demoLink: demoLink ? demoLink.trim() : (prevSub?.demoLink || ''),
      tabSwitches: (prevSub?.tabSwitches || 0) + tabSwitches,
      fullScreenExits: (prevSub?.fullScreenExits || 0) + fullScreenExits,
      proctoringFlagsCount: (prevSub?.proctoringFlagsCount || 0) + proctoringFlagsCount,
      attempts: attemptCount,
      testResults: testResults || prevSub?.testResults || null,
      programScore: finalProgramScore,
      quizScore: finalQuizScore,
      quizCorrect: isDisqualifiedFromQuiz ? 0 : Math.max(prevSub?.quizCorrect || 0, quizCorrect),
      quizDisqualified: isDisqualifiedFromQuiz,
      quizDisqualificationReason: isDisqualifiedFromQuiz 
        ? (quizDisqualificationReason || prevSub?.quizDisqualificationReason || "Tab switching detected while attempting or submitting task") 
        : null,
      quizSubmitted: !isDisqualifiedFromQuiz && (Boolean(prevSub?.quizSubmitted) || quizScore > 0 || quizCorrect > 0),
      points: finalPoints,
      rawTotal: dayScoreObj.rawTotal,
      isCatchup,
      submittedAt: new Date().toISOString(),
      status: status || (prevSub?.status === 'exited' ? 'exited' : 'approved'),
      exitReason: exitReason || prevSub?.exitReason || null,
      exitedAt: exitedAt || prevSub?.exitedAt || (status === 'exited' ? new Date().toISOString() : null),
      vivaRequired: false,
      needsViva: false,
      failedViva: false,
      vivaNotes: exitReason ? `Auto-Exit Triggered: ${exitReason}` : ""
    };

    let updatedList;
    if (existingIndex >= 0) {
      updatedList = [...submissions];
      updatedList[existingIndex] = { ...updatedList[existingIndex], ...newSubData };
    } else {
      updatedList = [newSubData, ...submissions];
    }

    setSubmissions(updatedList);

    // Persist submission immediately to shared database (Step 3 & Step 5)
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    submitTaskSolutionApi(newSubData, token).then(res => {
      if (res && res.success && Array.isArray(res.submissions)) {
        setSubmissions(res.submissions);
      }
    }).catch(() => {});

    return { 
      success: true, 
      points: finalPoints, 
      programScore: finalProgramScore,
      quizScore: finalQuizScore,
      attempts: attemptCount,
      message: `Day ${activeDay} recorded! Total: ${finalPoints.toFixed(1)} / ${DAY_POINTS[activeDay]} pts` 
    };
  };

  // Admin Actions
  const toggleVivaStatus = (submissionId, vivaRequired) => {
    const updated = submissions.map(s => {
      if (s.id === submissionId) {
        return { 
          ...s, 
          vivaRequired, 
          needsViva: vivaRequired,
          status: vivaRequired ? 'under_review' : s.status 
        };
      }
      return s;
    });
    saveSubmissions(updated);
  };

  const evaluateViva = (submissionId, passed, notes = "") => {
    const updated = submissions.map(s => {
      if (s.id === submissionId) {
        const failedViva = !passed;
        return {
          ...s,
          vivaRequired: false,
          needsViva: false,
          failedViva,
          vivaNotes: notes || (passed ? "Viva verified successfully." : "Failed viva explanation. Points revoked."),
          points: failedViva ? 0 : s.points,
          programScore: failedViva ? 0 : s.programScore,
          quizScore: failedViva ? 0 : s.quizScore,
          status: passed ? "approved" : "rejected"
        };
      }
      return s;
    });
    saveSubmissions(updated);
  };

  const flagSubmission = (submissionId, customReason) => {
    const updated = submissions.map(s => {
      if (s.id === submissionId) {
        return {
          ...s,
          vivaRequired: true,
          needsViva: true,
          status: "flagged",
          vivaNotes: customReason || "Flagged by admin for investigation."
        };
      }
      return s;
    });
    saveSubmissions(updated);
  };

  // Current Sprint Day helper: Day 1 starts from 14th October 2026 (2026-10-14T08:00:00+05:30 = 8:00 AM IST)
  const [dayOverride, setDayOverride] = useState(() => {
    const saved = localStorage.getItem('technova_sprint_day_override');
    return saved !== null ? parseInt(saved, 10) : null;
  });

  const calculateCurrentSprintDay = () => {
    if (dayOverride !== null) return dayOverride;
    const effTime = simulatedServerTime || Date.now();
    return getEffectiveSprintDay(effTime);
  };

  const [currentDay, setCurrentDay] = useState(() => calculateCurrentSprintDay());

  // Reactive interval: auto-unlocks when schedule arrives (e.g. 8:00 AM IST) without page reload
  useEffect(() => {
    const updateDay = () => {
      const next = calculateCurrentSprintDay();
      setCurrentDay(next);
    };
    updateDay();
    const interval = setInterval(updateDay, 1000);
    return () => clearInterval(interval);
  }, [simulatedServerTime, dayOverride]);

  const getCurrentSprintDay = () => currentDay;

  const setSprintDay = (dayNum) => {
    const n = Number(dayNum);
    setDayOverride(n);
    setCurrentDay(n);
    localStorage.setItem('technova_sprint_day_override', String(n));
  };

  const clearDayOverride = () => {
    setDayOverride(null);
    localStorage.removeItem('technova_sprint_day_override');
    const autoDay = getEffectiveSprintDay(simulatedServerTime || Date.now());
    setCurrentDay(autoDay);
  };

  // Reset demo data back to default
  const resetToSeedData = () => {
    localStorage.removeItem('technova_submissions');
    localStorage.removeItem('technova_tasks');
    setTasks(SEED_TASKS);
    setSubmissions(INITIAL_SUBMISSIONS);
  };

  return (
    <AppContext.Provider value={{
      theme,
      toggleTheme,
      user,
      setUser,
      sessionToken,
      loginStudent,
      logoutStudent,
      refreshSharedState,
      isAdmin,
      isSessionLoading,
      isVedantAdmin,
      loginAsAdmin,
      logoutAdmin,
      switchRole,
      tasks,
      updateTasks,
      submissions,
      saveSubmissions,
      currentDay,
      setSprintDay,
      clearDayOverride,
      dayOverride,
      getCurrentSprintDay,
      sprintSchedule: SPRINT_SCHEDULE,
      sprintStartDate: SPRINT_START_DATE,
      sprintEndDate: SPRINT_END_DATE,
      sprintIssueDate: SPRINT_ISSUE_DATE,
      getSprintDaySchedule,
      isDayUnlocked,
      getDayUnlockTimeUtc,
      getDayDeadlineTimeUtc,
      getEffectiveSprintDay,
      submitTaskSolution,
      toggleVivaStatus,
      evaluateViva,
      flagSubmission,
      resetToSeedData,
      clearAllData,
      students,
      saveStudents,
      getAllStudents,
      getStudentEligibility,
      issueCertificate,
      updateCertificateStatus,
      revokeCertificate,
      reissueCertificate,
      verificationLogs,
      logVerification,
      proctoringFlags,
      addProctoringFlag,
      updateProctoringFlag,
      getNextCertificateId,
      certificates,
      saveCertificates,
      manualOverrides,
      toggleManualOverride,
      emailLogs,
      addEmailLog,
      dailySendLimit,
      updateDailySendLimit,
      dailySentStats,
      incrementDailySentCount,
      resendRequests,
      requestCertificateResend,
      emailAuditRuns,
      logEmailAuditRun,
      userConsents,
      saveUserConsent,
      hasUserGivenConsent,
      templateConfig,
      updateTemplateConfig,
      approveCertificateTemplate,
      unlockCertificateTemplate,
      adminTestMode,
      setAdminTestMode,
      simulatedServerTime,
      setSimulatedServerTime,
      getEffectiveServerTime,
      clearTestStudentData,
      ADMIN_EMAILS,
      examSettings,
      updateExamSettings,
      resultsPublished,
      setResultsPublished,
      toggleResultsPublished,
      allowExitedStudentsForCert,
      toggleAllowExitedForCert
    }}>

      {children}
    </AppContext.Provider>

  );
};

export const useApp = () => useContext(AppContext);
