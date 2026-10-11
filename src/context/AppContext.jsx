import React, { createContext, useContext, useState, useEffect } from 'react';
import { SEED_TASKS } from '../data/tasksSeed';
import { getTaskVariant, calculateTextSimilarity, detectAiGeneratedContent } from '../utils/hash';
import { calculateSubmissionPoints, computeUserSummary } from '../utils/scoring';

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

  // Check eligibility for a student (all 9 days completed, clean integrity, manual override check)
  const getStudentEligibility = (studentKey) => {
    const studentSubs = submissions.filter(s => s.userId === studentKey || s.prn === studentKey);
    const validDays = new Set(
      studentSubs
        .filter(s => !s.failedViva && (s.status === 'approved' || s.status === 'submitted'))
        .map(s => s.day)
    );
    const daysCount = validDays.size;
    const hasFailedViva = studentSubs.some(s => s.failedViva);
    const hasUnresolvedFlag = studentSubs.some(s => s.vivaRequired || s.status === 'flagged');

    const autoEligible = daysCount === 9 && !hasFailedViva && !hasUnresolvedFlag;
    const isOverridden = manualOverrides[studentKey] !== undefined;
    const isEligible = isOverridden ? manualOverrides[studentKey] : autoEligible;

    return {
      isEligible,
      autoEligible,
      isOverridden,
      overrideValue: manualOverrides[studentKey],
      daysCount,
      hasFailedViva,
      hasUnresolvedFlag,
      submissionsCount: studentSubs.length
    };
  };

  // Next Certificate ID generator (TNV-CS-2026-0001 format)
  const getNextCertificateId = () => {
    let maxNum = 0;
    certificates.forEach(c => {
      if (c.certificateId && c.certificateId.startsWith('TNV-CS-2026-')) {
        const numPart = parseInt(c.certificateId.replace('TNV-CS-2026-', ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });
    const nextNum = maxNum + 1;
    return `TNV-CS-2026-${String(nextNum).padStart(4, '0')}`;
  };

  // Issue or fetch Certificate for student
  const issueCertificate = (student) => {
    const existing = certificates.find(c => c.userId === student.uid || c.prn === student.prn);
    if (existing) return existing;

    const certId = getNextCertificateId();
    const newCert = {
      certificateId: certId,
      userId: student.uid,
      studentName: student.name,
      prn: student.prn,
      email: student.email || `${student.prn.toLowerCase()}@svit.ac.in`,
      track: student.track || 'Web',
      startDate: "1st October 2026",
      endDate: "9th October 2026",
      issuedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      pdfUrl: null,
      status: 'pending', // 'pending' | 'sent' | 'failed'
      errorReason: null,
      sentAt: null
    };

    const nextCerts = [...certificates, newCert];
    saveCertificates(nextCerts);
    return newCert;
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
        startDate: "1st October 2026",
        endDate: "9th October 2026",
        issuedDate: "10th October 2026",
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

  // Admin emails list (default admin emails)
  const ADMIN_EMAILS = [
    "admin@svit.ac.in",
    "faculty@svit.ac.in",
    "technova.admin@svit.ac.in",
    "mentor@svit.ac.in"
  ];

  const isAdmin = Boolean(user && (user.role === 'admin' || ADMIN_EMAILS.includes(user.email?.toLowerCase())));

  // Login as Admin with blank initial state submitted by faculty
  const loginAsAdmin = ({ name, email, department, rollNo }) => {
    const adminUser = {
      uid: `svit-admin-${Date.now()}`,
      name: name?.trim() || "SVIT Faculty Administrator",
      email: email?.trim().toLowerCase() || "faculty@svit.ac.in",
      prn: rollNo?.trim() || "SVIT-FACULTY",
      year: "Faculty / Mentor",
      branch: department?.trim() || "Technical Skill Development Hub",
      track: "All Tracks",
      role: "admin",
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'Admin')}`
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
  const submitTaskSolution = ({ day, githubRepo, solutionNote, demoLink, tabSwitches = 0 }) => {
    if (!user) return { success: false, message: "Please sign in first." };
    if (user.role === 'admin' || isAdmin) {
      return { success: false, message: "Administrators cannot submit sprint tasks. Only registered students can submit." };
    }

    // Strict AI prohibition validation
    const aiCheck = detectAiGeneratedContent(solutionNote);
    if (aiCheck.isAiSuspected) {
      return {
        success: false,
        message: `${aiCheck.reason} Technova Code Sprint strictly prohibits the use of AI modules for code and explanation generation.`
      };
    }

    // Tab-switch integrity verification
    if (tabSwitches >= 1) {
      return {
        success: false,
        message: "Submission blocked: Window blur or tab-switch event detected during session. External tab navigation is prohibited during task solution."
      };
    }

    const activeDay = day;
    const isCatchup = activeDay < getCurrentSprintDay(); // Catch-up if submitted for a past day
    const assignedVariant = getTaskVariant(user.uid, day);

    // Commit pattern detection (simulate commit analysis or allow student)
    const commitCount = Math.floor(Math.random() * 4) + 2; // 2-5 commits typical
    const bigCommitNearDeadline = Math.random() < 0.15; // occasional flag for demo

    // Calculate score
    const points = calculateSubmissionPoints({
      day,
      isCatchup,
      submittedAt: new Date(),
      failedViva: false
    });

    // Check if previous submission exists for this day
    const existingIndex = submissions.findIndex(s => s.userId === user.uid && s.day === day);

    const newSubData = {
      id: existingIndex >= 0 ? submissions[existingIndex].id : `sub-${user.uid}-day-${day}`,
      userId: user.uid,
      studentName: user.name,
      prn: user.prn,
      day,
      track: user.track || 'Web',
      variant: assignedVariant,
      githubRepo: githubRepo.trim(),
      solutionNote: solutionNote.trim(),
      demoLink: demoLink ? demoLink.trim() : '',
      tabSwitches,
      commitCount,
      firstCommitTime: "11:20",
      lastCommitTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      bigCommitNearDeadline,
      submittedAt: new Date().toISOString(),
      points,
      isCatchup,
      status: "approved",
      vivaRequired: false,
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
    return { success: true, points, message: "Task submitted successfully!" };
  };

  // Admin Actions
  const toggleVivaStatus = (submissionId, vivaRequired) => {
    const updated = submissions.map(s => {
      if (s.id === submissionId) {
        return { ...s, vivaRequired, status: vivaRequired ? 'under_review' : s.status };
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
          failedViva,
          vivaNotes: notes || (passed ? "Viva verified successfully." : "Failed viva explanation. Points revoked."),
          points: failedViva ? 0 : s.points,
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
          status: "flagged",
          vivaNotes: customReason || "Flagged by admin for investigation."
        };
      }
      return s;
    });
    saveSubmissions(updated);
  };

  // Current Sprint Day helper: Can simulate or defaults to Day 2
  const [currentDay, setCurrentDay] = useState(() => {
    return parseInt(localStorage.getItem('technova_sprint_day') || "2", 10);
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
      loginAsAdmin,
      switchRole,
      tasks,
      updateTasks,
      submissions,
      saveSubmissions,
      currentDay,
      setSprintDay,
      getCurrentSprintDay,
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
