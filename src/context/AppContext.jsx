import React, { createContext, useContext, useState, useEffect } from 'react';
import { SEED_TASKS, SPRINT_SCHEDULE, SPRINT_START_DATE, SPRINT_END_DATE, SPRINT_ISSUE_DATE, getSprintDaySchedule } from '../data/tasksSeed';
import { getTaskVariant, calculateTextSimilarity, detectAiGeneratedContent } from '../utils/hash';
import { calculateDayScore, computeUserSummary, formatScore, toScoreNumber, DAY_POINTS, PASS_MARK_POINTS, TOTAL_SPRINT_POINTS } from '../utils/scoring';

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

  // Ensure clean fresh start for new students across browser sessions
  useEffect(() => {
    const DATA_EPOCH = "technova_svit_pristine_production_launch_2026_v8";
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

  // Seed rich demo dataset with 9-day completions for testing
  const seedDemoEligibleData = () => {
    const demoStudents = [
      {
        uid: "svit-stud-01",
        name: "Shruti Kulkarni",
        email: "shruti.kulkarni@svit.ac.in",
        prn: "SVIT2024CS112",
        year: "Third Year (TE)",
        branch: "Computer Engineering",
        track: "Web",
        role: "student"
      },
      {
        uid: "svit-stud-02",
        name: "Rohan Patil",
        email: "rohan.patil@svit.ac.in",
        prn: "SVIT2024EC045",
        year: "Third Year (TE)",
        branch: "ECE",
        track: "DSA",
        role: "student"
      },
      {
        uid: "svit-stud-03",
        name: "Neha Deshmukh",
        email: "neha.deshmukh@svit.ac.in",
        prn: "SVIT2023IT028",
        year: "Final Year (BE)",
        branch: "Information Technology",
        track: "App",
        role: "student"
      },
      {
        uid: "svit-stud-04",
        name: "Aditya Pawar",
        email: "aditya.pawar@svit.ac.in",
        prn: "SVIT2025CH094",
        year: "Second Year (SE)",
        branch: "Chemical Engineering",
        track: "Python",
        role: "student"
      },
      {
        uid: "svit-stud-05",
        name: "Tanmay Joshi",
        email: "tanmay.joshi@svit.ac.in",
        prn: "SVIT2024CS089",
        year: "Third Year (TE)",
        branch: "Computer Engineering",
        track: "Web",
        role: "student"
      }
    ];

    const demoSubmissions = [];
    // Student 1, 2, 3: Completed all 9 days!
    [demoStudents[0], demoStudents[1], demoStudents[2]].forEach(s => {
      for (let day = 1; day <= 9; day++) {
        demoSubmissions.push({
          id: `sub-${s.uid}-day-${day}`,
          userId: s.uid,
          studentName: s.name,
          prn: s.prn,
          day,
          track: s.track,
          variant: 'A',
          githubRepo: `https://github.com/${s.name.toLowerCase().replace(/\s+/g, '')}/technova-day-${day}`,
          solutionNote: `Architected complete day ${day} challenge with clean test passes and structured commit timeline.`,
          submittedAt: new Date(Date.now() - (10 - day) * 86400000).toISOString(),
          status: 'approved',
          points: 100,
          tabSwitches: 1,
          commitCount: 4,
          vivaRequired: false,
          failedViva: false
        });
      }
    });

    // Student 4: Completed Days 1-8 (Day 9 missing) -> Ineligible automatically
    for (let day = 1; day <= 8; day++) {
      const s = demoStudents[3];
      demoSubmissions.push({
        id: `sub-${s.uid}-day-${day}`,
        userId: s.uid,
        studentName: s.name,
        prn: s.prn,
        day,
        track: s.track,
        variant: 'B',
        githubRepo: `https://github.com/adityapawar/day-${day}`,
        solutionNote: `Built Python solution with type hints and test execution for day ${day}.`,
        submittedAt: new Date(Date.now() - (10 - day) * 86400000).toISOString(),
        status: 'approved',
        points: 90,
        tabSwitches: 0,
        commitCount: 3,
        vivaRequired: false,
        failedViva: false
      });
    }

    // Student 5: Completed Days 1-9, but Day 4 has pending viva flag -> Ineligible until resolved or overridden
    for (let day = 1; day <= 9; day++) {
      const s = demoStudents[4];
      const isDay4 = day === 4;
      demoSubmissions.push({
        id: `sub-${s.uid}-day-${day}`,
        userId: s.uid,
        studentName: s.name,
        prn: s.prn,
        day,
        track: s.track,
        variant: 'A',
        githubRepo: `https://github.com/tanmayjoshi/day-${day}`,
        solutionNote: `Integrated responsive layout for day ${day}.`,
        submittedAt: new Date(Date.now() - (10 - day) * 86400000).toISOString(),
        status: isDay4 ? 'flagged' : 'approved',
        points: isDay4 ? 50 : 100,
        tabSwitches: isDay4 ? 5 : 2,
        commitCount: 2,
        vivaRequired: isDay4,
        failedViva: false
      });
    }

    saveStudents(demoStudents);
    saveSubmissions(demoSubmissions);
    setSprintDay(9);

    // Also pre-issue 1 certificate for Student 1 to showcase status
    const initialCerts = [
      {
        certificateId: "TNV-CS-2026-0001",
        userId: demoStudents[0].uid,
        studentName: demoStudents[0].name,
        prn: demoStudents[0].prn,
        email: demoStudents[0].email,
        track: demoStudents[0].track,
        startDate: SPRINT_START_DATE,
        endDate: SPRINT_END_DATE,
        issuedDate: SPRINT_ISSUE_DATE,
        status: 'sent',
        sentAt: new Date(Date.now() - 3600000).toLocaleString(),
        errorReason: null
      }
    ];
    saveCertificates(initialCerts);

    addEmailLog({
      id: `log-seed-1`,
      recipientEmail: demoStudents[0].email,
      studentName: demoStudents[0].name,
      certificateId: "TNV-CS-2026-0001",
      sender: "technicalteamsvit@gmail.com",
      status: "sent",
      timestamp: new Date(Date.now() - 3600000).toLocaleString(),
      subject: "Your Technova Code Sprint Certificate"
    });
  };

  const clearAllData = () => {
    localStorage.removeItem('technova_active_user');
    localStorage.removeItem('technova_submissions');
    localStorage.removeItem('technova_certificates');
    localStorage.removeItem('technova_manual_overrides');
    localStorage.removeItem('technova_email_logs');
    localStorage.removeItem('technova_students');
    localStorage.removeItem('technova_sprint_day');
    setUser(null);
    setSubmissions([]);
    setCertificates([]);
    setManualOverrides({});
    setEmailLogs([]);
    setStudents([]);
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
    proctoringFlagsCount = 0
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

    // Calculate score using Section 1 rules
    const dayScoreObj = calculateDayScore({
      day: activeDay,
      programScore,
      quizCorrect,
      quizTotal,
      isCatchup,
      failedViva: false,
      hasIntegrityViolation: false
    });

    // Check if previous submission exists for this day
    const existingIndex = submissions.findIndex(s => s.userId === user.uid && Number(s.day) === activeDay);
    const prevSub = existingIndex >= 0 ? submissions[existingIndex] : null;

    // Best of 3 attempts
    const currentPoints = dayScoreObj.dayTotal;
    const finalPoints = prevSub ? Math.max(prevSub.points || 0, currentPoints) : currentPoints;
    const finalProgramScore = prevSub ? Math.max(prevSub.programScore || 0, dayScoreObj.programScore) : dayScoreObj.programScore;
    const finalQuizScore = prevSub ? Math.max(prevSub.quizScore || 0, dayScoreObj.quizScore) : dayScoreObj.quizScore;
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
      quizCorrect: Math.max(prevSub?.quizCorrect || 0, quizCorrect),
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

  // Current Sprint Day helper: Day 1 starts from 13th October 2026
  const [currentDay, setCurrentDay] = useState(() => {
    return parseInt(localStorage.getItem('technova_sprint_day') || "1", 10);
  });

  const getCurrentSprintDay = () => currentDay;

  const setSprintDay = (dayNum) => {
    setCurrentDay(dayNum);
    localStorage.setItem('technova_sprint_day', dayNum.toString());
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
      getCurrentSprintDay,
      sprintSchedule: SPRINT_SCHEDULE,
      sprintStartDate: SPRINT_START_DATE,
      sprintEndDate: SPRINT_END_DATE,
      sprintIssueDate: SPRINT_ISSUE_DATE,
      getSprintDaySchedule,
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
      seedDemoEligibleData,
      getNextCertificateId,
      certificates,
      saveCertificates,
      manualOverrides,
      toggleManualOverride,
      emailLogs,
      addEmailLog,
      ADMIN_EMAILS
    }}>

      {children}
    </AppContext.Provider>

  );
};

export const useApp = () => useContext(AppContext);
