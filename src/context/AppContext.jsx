import React, { createContext, useContext, useState, useEffect } from 'react';
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

const AppContext = createContext();

// Fresh start: ready for real student registrations
const INITIAL_STUDENTS = [];
const INITIAL_SUBMISSIONS = [];


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

  // Active User / Session: Null by default for brand new student registrations
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('technova_active_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null; // Ready for new student registration
  });

  // Ensure clean fresh start: remove all existing student and certificate data across browser sessions
  useEffect(() => {
    const DATA_EPOCH = "technova_svit_pristine_clean_launch_2026_v10";
    if (localStorage.getItem("technova_epoch") !== DATA_EPOCH) {
      const savedTheme = localStorage.getItem("technova_theme");
      localStorage.clear();
      localStorage.setItem("technova_epoch", DATA_EPOCH);
      if (savedTheme) localStorage.setItem("technova_theme", savedTheme);
      setUser(null);
      setSubmissions([]);
      setStudents([]);
      setCertificates([]);
      setManualOverrides({});
      setEmailLogs([]);
      setProctoringFlags([]);
      setVerificationLogs([]);
      setCurrentDay(1);
    }
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('technova_active_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('technova_active_user');
    }
  }, [user]);

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

  // Submissions State: Empty for fresh start
  const [submissions, setSubmissions] = useState(() => {
    const saved = localStorage.getItem('technova_submissions');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
  });

  const saveSubmissions = (newSubs) => {
    setSubmissions(newSubs);
    localStorage.setItem('technova_submissions', JSON.stringify(newSubs));
  };

  // Registered Students State
  const [students, setStudents] = useState(() => {
    const saved = localStorage.getItem('technova_students');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
  });

  const saveStudents = (newStudents) => {
    setStudents(newStudents);
    localStorage.setItem('technova_students', JSON.stringify(newStudents));
  };

  // Sync active user into students list
  useEffect(() => {
    if (user && user.role !== 'admin' && user.prn) {
      setStudents(prev => {
        const idx = prev.findIndex(s => s.uid === user.uid || s.prn === user.prn);
        let next;
        if (idx >= 0) {
          next = [...prev];
          next[idx] = { ...next[idx], ...user };
        } else {
          next = [...prev, user];
        }
        localStorage.setItem('technova_students', JSON.stringify(next));
        return next;
      });
    }
  }, [user]);

  // Certificates State
  const [certificates, setCertificates] = useState(() => {
    const saved = localStorage.getItem('technova_certificates');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
  });

  const saveCertificates = (newCerts) => {
    setCertificates(newCerts);
    localStorage.setItem('technova_certificates', JSON.stringify(newCerts));
  };

  // Manual Eligibility Overrides State (map of userId/prn -> boolean)
  const [manualOverrides, setManualOverrides] = useState(() => {
    const saved = localStorage.getItem('technova_manual_overrides');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return {}; }
    }
    return {};
  });

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
      localStorage.setItem('technova_manual_overrides', JSON.stringify(next));
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

  // User Proctoring & Honor Code Consents (remembers across Days 2 to 9)
  const [userConsents, setUserConsents] = useState(() => {
    const saved = localStorage.getItem('technova_user_consents');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return {}; }
    }
    return {};
  });

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
      localStorage.setItem('technova_user_consents', JSON.stringify(next));
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
      localStorage.setItem('technova_submissions', JSON.stringify(filtered));
      return filtered;
    });

    setStudents(prev => {
      const filtered = prev.filter(s => {
        const isTest = s.prn?.startsWith('TEST-') || s.prn?.startsWith('DEMO-') || s.email?.includes('test') || s.name?.toLowerCase().includes('test student');
        return !isTest;
      });
      localStorage.setItem('technova_students', JSON.stringify(filtered));
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
          track: sub.track || 'Web',
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

  // Check eligibility for a student (50 or more points, not in Pending review, manual override check)
  const getStudentEligibility = (studentKey) => {
    const studentSubs = submissions.filter(s => s.userId === studentKey || s.prn === studentKey);
    const summary = computeUserSummary(studentSubs, manualOverrides[studentKey]);
    const totalScore = summary.totalScore;
    const hasFailedViva = studentSubs.some(s => s.failedViva);
    const hasUnresolvedFlag = studentSubs.some(s => s.needsViva || s.vivaRequired || s.status === 'flagged');

    // Section 2: A student passes with 50 or more out of 100 after all 9 days are scored. Completing all 9 days is not required.
    // Students with unresolved flags marked "Needs viva", or a failed viva, stay in "Pending review"
    const autoEligible = totalScore >= 50 && !hasFailedViva && !hasUnresolvedFlag;
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
      localStorage.setItem('technova_certificates', JSON.stringify(next));
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
      localStorage.setItem('technova_certificates', JSON.stringify(next));
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
      localStorage.setItem('technova_certificates', JSON.stringify(next));
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

  const logVerification = (certificateId, result, details = {}) => {
    const entry = {
      id: `ver-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      certificateId,
      result, // 'valid' | 'revoked' | 'not_found'
      timestamp: new Date().toISOString(),
      ...details
    };
    setVerificationLogs(prev => {
      const next = [entry, ...prev.slice(0, 199)];
      localStorage.setItem('technova_verification_logs', JSON.stringify(next));
      return next;
    });
    return entry;
  };

  // Proctoring Flags state (Section 5)
  const [proctoringFlags, setProctoringFlags] = useState(() => {
    const saved = localStorage.getItem('technova_proctoring_flags');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
  });

  const addProctoringFlag = (flagData) => {
    const newFlag = {
      id: `flag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      status: 'pending', // 'pending' | 'dismissed' | 'reviewed_no_issue' | 'needs_viva'
      ...flagData
    };
    setProctoringFlags(prev => {
      const next = [newFlag, ...prev];
      localStorage.setItem('technova_proctoring_flags', JSON.stringify(next));
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
      localStorage.setItem('technova_proctoring_flags', JSON.stringify(next));
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
          localStorage.setItem('technova_submissions', JSON.stringify(next));
          return next;
        });
      }
    }
  };

  const clearAllData = () => {
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
    setUser(null);
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

  // Admin Access Control (Section 8: Google sign-in required, verified email, name equals "Vedant Kokane")
  const isVedantAdmin = (u) => {
    if (!u) return false;
    const nameMatch = u.name && u.name.trim().toLowerCase() === 'vedant kokane';
    return Boolean(nameMatch || (u.role === 'admin' && nameMatch));
  };

  const isAdmin = Boolean(isVedantAdmin(user));

  // Login as Admin with Google sign-in simulation (Section 8)
  const loginAsAdmin = ({ name = "Vedant Kokane", email = "vedantkokane94@gmail.com", department = "Technical Skill Development Hub", rollNo = "SVIT-ADMIN" } = {}) => {
    const adminUser = {
      uid: `svit-admin-${Date.now()}`,
      name: "Vedant Kokane", // Name strictly verified as Vedant Kokane
      email: email?.trim().toLowerCase() || "vedantkokane94@gmail.com",
      prn: rollNo?.trim() || "SVIT-ADMIN",
      year: "Faculty / Lead Organizer",
      branch: department?.trim() || "Technical Skill Development Hub",
      track: "All Tracks",
      role: "admin",
      provider: "google",
      emailVerified: true
    };
    setUser(adminUser);
    localStorage.setItem('technova_active_user', JSON.stringify(adminUser));
    return adminUser;
  };

  // Switch between Student and Admin
  const switchRole = (newRole) => {
    if (newRole === 'student') {
      const latestStudent = students[students.length - 1];
      setUser(latestStudent || null);
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
    quizDisqualificationReason = ''
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
    const existingIndex = submissions.findIndex(s => s.userId === user.uid && Number(s.day) === activeDay);
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
      id: prevSub ? prevSub.id : `sub-${user.uid}-day-${activeDay}`,
      userId: user.uid,
      studentName: user.name,
      prn: user.prn,
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
      status: "approved",
      vivaRequired: false,
      needsViva: false,
      failedViva: false,
      vivaNotes: ""
    };

    let updatedList;
    if (existingIndex >= 0) {
      updatedList = [...submissions];
      updatedList[existingIndex] = { ...updatedList[existingIndex], ...newSubData };
    } else {
      updatedList = [newSubData, ...submissions];
    }

    saveSubmissions(updatedList);
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

  // Current Sprint Day helper: Day 1 starts from 13th October 2026 (02:30:00Z = 8:00 AM IST)
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
      isAdmin,
      isVedantAdmin,
      loginAsAdmin,
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
      ADMIN_EMAILS
    }}>

      {children}
    </AppContext.Provider>

  );
};

export const useApp = () => useContext(AppContext);
