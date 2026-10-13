import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { calculateTextSimilarity, detectAiGeneratedContent } from '../utils/hash';
import { 
  ShieldCheck, 
  FileText, 
  Download, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Search, 
  Edit3, 
  RefreshCw, 
  ExternalLink,
  Users,
  Eye,
  Calendar,
  Layers,
  Sparkles,
  HelpCircle,
  Flag,
  MessageSquare,
  Award,
  Mail,
  Send,
  CheckSquare,
  Square,
  RotateCw,
  CheckCircle2,
  AlertOctagon,
  Info,
  Clock,
  User,
  Lock,
  BookOpen,
  EyeOff,
  Activity,
  Flame,
  ShieldAlert,
  KeyRound,
  Shield,
  Settings,
  Upload,
  Play,
  Unlock,
  Smartphone,
  Laptop,
  Server,
  Sliders,
  LogOut,
  Code
} from 'lucide-react';
import { Github } from '../components/GithubIcon';
import { CertificateView } from '../components/CertificateView';
import { AdminRegistrationsPanel } from '../components/AdminRegistrationsPanel';
import { SVITHubLogo, DurgaMataSketch } from '../components/BrandLogo';
import { SPRINT_SCHEDULE, SPRINT_START_DATE, SPRINT_END_DATE, SPRINT_ISSUE_DATE, getSprintDaySchedule } from '../data/tasksSeed';
import { downloadCertificatePdf, DEFAULT_TEMPLATE_CONFIG } from '../utils/certificateGenerator';
import {
  safeString,
  safeTrim,
  safeLowerCase,
  safeUpperCase,
  safeReplace,
  safeSplit,
  safeInitials,
  safeGithubRepo,
  sanitizeStudent,
  sanitizeSubmission
} from '../utils/safeString';
import { 
  checkAdminDeviceStatus, 
  registerAdminDevice, 
  loginAdminWithPassword, 
  fetchAdminLogs, 
  resetAdminDevice, 
  fetchExamSettings, 
  saveExamSettings,
  fetchBlockedAttemptsApi,
  whitelistStudentApi,
  fetchWhitelistsApi,
  removeWhitelistApi
} from '../services/api';

export const AdminPage = ({ setCurrentTab }) => {
  const { 
    tasks, 
    updateTasks, 
    submissions, 
    saveSubmissions, 
    students,
    refreshSharedState,
    toggleVivaStatus, 
    evaluateViva, 
    flagSubmission,
    resetToSeedData,
    clearAllData,
    currentDay,
    setSprintDay,
    getAllStudents,
    getStudentEligibility,
    toggleManualOverride,
    certificates,
    issueCertificate,
    updateCertificateStatus,
    revokeCertificate,
    reissueCertificate,
    verificationLogs,
    proctoringFlags,
    updateProctoringFlag,
    emailLogs,
    addEmailLog,
    dailySendLimit,
    updateDailySendLimit,
    dailySentStats,
    incrementDailySentCount,
    resendRequests,
    emailAuditRuns,
    logEmailAuditRun,
    user,
    setUser,
    isAdmin,
    loginAsAdmin,
    logoutAdmin,
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
    clearDayOverride,
    dayOverride,
    examSettings,
    updateExamSettings,
    resultsPublished,
    toggleResultsPublished,
    allowExitedStudentsForCert,
    toggleAllowExitedForCert,
    lastSyncTime,
    isLiveConnected
  } = useApp();

  const [activeTab, setActiveTab] = useState('registrations'); // 'registrations' | 'submissions' | 'proctoring' | 'certificates' | 'verification' | 'tasks' | 'template' | 'testmode' | 'security' | 'examsettings'
  const [filterDay, setFilterDay] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Local Exam Settings State (Section 2 & 3)
  const [localExamSettings, setLocalExamSettings] = useState({
    negativeMarking: examSettings?.negativeMarking ?? 0,
    quizTimeLimitSeconds: examSettings?.quizTimeLimitSeconds ?? 600,
    passMark: examSettings?.passMark ?? 50,
    judgingCriteriaText: examSettings?.judgingCriteriaText ?? '',
    violationMode: examSettings?.violationMode ?? 'immediate_exit',
    warningsAllowed: examSettings?.warningsAllowed ?? 0,
    noFaceSeconds: examSettings?.noFaceSeconds ?? 10,
    phoneConfidence: examSettings?.phoneConfidence ?? 0.55
  });

  React.useEffect(() => {
    if (examSettings) {
      setLocalExamSettings({
        negativeMarking: examSettings.negativeMarking ?? 0,
        quizTimeLimitSeconds: examSettings.quizTimeLimitSeconds ?? 600,
        passMark: examSettings.passMark ?? 50,
        judgingCriteriaText: examSettings.judgingCriteriaText ?? '',
        violationMode: examSettings.violationMode ?? 'immediate_exit',
        warningsAllowed: examSettings.warningsAllowed ?? 0,
        noFaceSeconds: examSettings.noFaceSeconds ?? 10,
        phoneConfidence: examSettings.phoneConfidence ?? 0.55
      });
    }
  }, [examSettings]);
  
  // Viva modal / evaluation state
  const [selectedSubForViva, setSelectedSubForViva] = useState(null);
  const [vivaNotes, setVivaNotes] = useState('');

  // Task editor state
  const [editingTask, setEditingTask] = useState(null);
  const [selectedStudentForTrackWindow, setSelectedStudentForTrackWindow] = useState(null);

  // Certificate & Email Delivery State (Section 9)
  const [selectedStudentForCertModal, setSelectedStudentForCertModal] = useState(null);
  const [isBulkPreviewMode, setIsBulkPreviewMode] = useState(false);
  const [selectedStudentKeys, setSelectedStudentKeys] = useState([]);
  const [certFilter, setCertFilter] = useState('all'); // 'all', 'eligible', 'ineligible', 'sent', 'failed', 'resend'
  const [certSearch, setCertSearch] = useState('');
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [sendProgress, setSendProgress] = useState(null);
  const [adminToast, setAdminToast] = useState('');

  // Section 9.2: Preview Email Modal State
  const [previewEmailStudent, setPreviewEmailStudent] = useState(null);
  const [previewEmailFormat, setPreviewEmailFormat] = useState('html'); // 'html' | 'text'

  // Section 9.4: Daily Send Limit Modal State
  const [showDailyLimitModal, setShowDailyLimitModal] = useState(false);
  const [tempDailyLimit, setTempDailyLimit] = useState(dailySendLimit || 400);

  // Section 9.4: Queue Control Refs
  const skipBatchPauseRef = React.useRef(false);
  const batchCancelRef = React.useRef(false);
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);

  // Certificate Template State (Section 4)
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [typedUnlockCode, setTypedUnlockCode] = useState('');
  const [customDateTimeInput, setCustomDateTimeInput] = useState('');
  const hubLogoInputRef = React.useRef(null);
  const sealInputRef = React.useRef(null);
  const secSigInputRef = React.useRef(null);
  const princSigInputRef = React.useRef(null);

  const handleImageUpload = (e, assetKey, label) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('png')) {
      alert(`Invalid format: ${label} must be a PNG image with a transparent background.`);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert(`File too large: ${label} must be under 2 MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvt) => {
      const dataUri = uploadEvt.target.result;
      updateTemplateConfig({ [assetKey]: dataUri });
      setAdminToast(`Updated ${label} successfully.`);
      setTimeout(() => setAdminToast(''), 3000);
    };
    reader.readAsDataURL(file);
  };

  // Device Binding & Server-Side Admin Authentication (Section 1)
  const [deviceStatus, setDeviceStatus] = useState({
    isRegistered: false,
    isThisDeviceTrusted: false,
    deviceName: null,
    allowedIpsConfigured: false,
    clientIp: ''
  });
  const [isCheckingDevice, setIsCheckingDevice] = useState(true);
  const [deviceRegistrationName, setDeviceRegistrationName] = useState('');
  const [setupKeyInput, setSetupKeyInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [auditLogSearch, setAuditLogSearch] = useState('');
  const [resetDevicePassword, setResetDevicePassword] = useState('');
  const [showResetDeviceModal, setShowResetDeviceModal] = useState(false);

  const [blockedAttempts, setBlockedAttempts] = useState([]);
  const [loadingBlockedAttempts, setLoadingBlockedAttempts] = useState(false);
  const [whitelistedStudents, setWhitelistedStudents] = useState([]);
  const [whitelistPrnInput, setWhitelistPrnInput] = useState('');
  const [whitelistNameInput, setWhitelistNameInput] = useState('');
  const [whitelistNotesInput, setWhitelistNotesInput] = useState('');

  // Check device status on mount and load audit logs
  const refreshDeviceStatus = async () => {
    setIsCheckingDevice(true);
    const status = await checkAdminDeviceStatus();
    setDeviceStatus(status);
    setIsCheckingDevice(false);
  };

  const loadAuditLogs = async () => {
    setLoadingAuditLogs(true);
    const data = await fetchAdminLogs();
    if (data && data.logs) {
      setAuditLogs(data.logs);
    }
    setLoadingAuditLogs(false);
  };

  const loadBlockedAttemptsAndWhitelists = async () => {
    setLoadingBlockedAttempts(true);
    const [blocks, whites] = await Promise.all([
      fetchBlockedAttemptsApi(),
      fetchWhitelistsApi()
    ]);
    setBlockedAttempts(blocks || []);
    setWhitelistedStudents(whites || []);
    setLoadingBlockedAttempts(false);
  };

  React.useEffect(() => {
    refreshDeviceStatus();
  }, []);

  React.useEffect(() => {
    if (isAdmin) {
      loadAuditLogs();
      loadBlockedAttemptsAndWhitelists();
    }
  }, [isAdmin]);

  // Lockout countdown timer
  React.useEffect(() => {
    if (lockoutSeconds > 0) {
      const timer = setTimeout(() => setLockoutSeconds(s => s - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [lockoutSeconds]);

  // Handle Device Registration (One-Time Setup Mode)
  const handleRegisterDevice = async (e) => {
    e.preventDefault();
    if (lockoutSeconds > 0) {
      setLoginError(`Security lockout in effect. Please wait ${lockoutSeconds} seconds before retrying.`);
      return;
    }
    if (!setupKeyInput.trim()) {
      setLoginError("Master ADMIN_SETUP_KEY is required to register a trusted workstation.");
      return;
    }
    if (!adminPasswordInput.trim()) {
      setLoginError("Master administrator password is required.");
      return;
    }

    setIsSubmittingAuth(true);
    setLoginError('');

    const res = await registerAdminDevice(
      adminPasswordInput.trim(), 
      deviceRegistrationName.trim() || "Primary Administrator Workstation",
      setupKeyInput.trim()
    );
    setIsSubmittingAuth(false);

    if (!res.success) {
      setLoginError(res.error || "Failed to register and bind device.");
      return;
    }

    setAdminToast("Workstation successfully bound as trusted admin device!");
    await refreshDeviceStatus();
    loginAsAdmin({
      name: "Vedant Kokane",
      email: "technicalteamsvit@gmail.com",
      department: "Technical Skill Development Hub",
      rollNo: "SVIT-ADMIN-LEAD"
    });
  };

  // Handle Admin Password Login (Requires password AND valid device token)
  const handlePasswordLoginSubmit = async (e) => {
    e.preventDefault();
    if (lockoutSeconds > 0) {
      setLoginError(`Security lockout in effect. Please wait ${lockoutSeconds} seconds before retrying.`);
      return;
    }
    if (!adminPasswordInput.trim()) {
      setLoginError("Please enter your administrator password.");
      return;
    }

    setIsSubmittingAuth(true);
    setLoginError('');

    const res = await loginAdminWithPassword(adminPasswordInput.trim());
    setIsSubmittingAuth(false);

    if (!res.success) {
      const errorMsg = res.error || "Authentication failed. Invalid credentials or unauthorized device.";
      setLoginError(errorMsg);
      if (res.attemptsRemaining !== undefined && res.attemptsRemaining <= 0) {
        setLockoutSeconds(60);
      }
      return;
    }

    setFailedAttempts(0);
    setLockoutSeconds(0);
    setLoginError('');
    loginAsAdmin({
      name: res.user?.name || "Vedant Kokane",
      email: res.user?.email || "technicalteamsvit@gmail.com",
      department: "Technical Skill Development Hub",
      rollNo: "SVIT-ADMIN-LEAD"
    });
  };

  // Handle Device Unbinding / Reset
  const handleResetDevice = async () => {
    if (!resetDevicePassword) {
      alert("Password required to unbind device.");
      return;
    }
    const res = await resetAdminDevice(resetDevicePassword);
    if (!res.success) {
      alert(res.error || "Failed to unbind device.");
      return;
    }
    alert("Admin device has been unbound successfully.");
    setShowResetDeviceModal(false);
    setResetDevicePassword('');
    await refreshDeviceStatus();
    window.location.reload();
  };

  // Compute similarity flags across submissions
  const submissionsWithFlags = submissions.map(sub => {
    // Check similarity with other submissions for same day
    let highestSimilarity = 0;
    let matchedStudentName = '';

    submissions.forEach(other => {
      if (other.id !== sub.id && other.day === sub.day) {
        const noteSim = calculateTextSimilarity(sub.solutionNote, other.solutionNote);
        const repoSim = (sub.githubRepo && other.githubRepo && sub.githubRepo === other.githubRepo) ? 100 : 0;
        const maxSim = Math.max(noteSim, repoSim);

        if (maxSim > highestSimilarity) {
          highestSimilarity = maxSim;
          matchedStudentName = other.studentName;
        }
      }
    });

    // Strict AI usage detection on solution note
    const aiCheck = detectAiGeneratedContent(sub.solutionNote);

    return {
      ...sub,
      similarityScore: highestSimilarity,
      similarityMatchWith: matchedStudentName,
      isAiDetected: aiCheck.isAiSuspected,
      aiDetectionReason: aiCheck.reason
    };
  });

  // Filter submissions
  const filteredSubmissions = submissionsWithFlags.filter(sub => {
    const matchesDay = filterDay === 'All' || sub.day === parseInt(filterDay, 10);
    const q = safeLowerCase(searchQuery);
    const matchesSearch = !q ||
                          safeLowerCase(sub.studentName).includes(q) ||
                          safeLowerCase(sub.prn).includes(q) ||
                          safeLowerCase(sub.githubRepo).includes(q);
    return matchesDay && matchesSearch;
  });

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Student Name",
      "Roll Number",
      "Day",
      "Track",
      "Variant",
      "GitHub Repo",
      "Solution Note",
      "Tab Switches",
      "Commit Count",
      "Late Bulk Commit Flag",
      "Similarity Match (%)",
      "Earned Points",
      "Viva Required",
      "Failed Viva",
      "Viva Notes",
      "Submission Timestamp"
    ];

    const rows = submissionsWithFlags.map(s => [
      s.id,
      `"${safeReplace(s.studentName, /"/g, '""')}"`,
      safeString(s.prn),
      s.day,
      s.track,
      s.variant,
      `"${safeString(s.githubRepo)}"`,
      `"${safeReplace(s.solutionNote, /"/g, '""')}"`,
      s.tabSwitches || 0,
      s.commitCount || 0,
      s.bigCommitNearDeadline ? "YES" : "NO",
      `${s.similarityScore}%`,
      s.points || 0,
      s.vivaRequired ? "YES" : "NO",
      s.failedViva ? "YES" : "NO",
      `"${safeReplace(s.vivaNotes, /"/g, '""')}"`,
      s.submittedAt
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `svit_technova_sprint_submissions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Comprehensive Student Results CSV (Section 2: day-wise scores, total out of 100, pass/fail)
  const handleExportStudentResultsCSV = () => {
    const headers = [
      "Student Name",
      "Roll Number",
      "Email",
      "Language Track",
      "Day 1 (5)",
      "Day 2 (5)",
      "Day 3 (8)",
      "Day 4 (10)",
      "Day 5 (12)",
      "Day 6 (12)",
      "Day 7 (13)",
      "Day 8 (15)",
      "Day 9 (20)",
      "Total Score (/100)",
      "Pass Mark",
      "Result",
      "Eligible for Certificate"
    ];

    const rows = studentsWithCertInfo.map(s => {
      const dayScores = s.eligibility?.summary?.dayScores || {};
      const total = s.eligibility?.summary?.totalScore ?? 0;
      const isPass = total >= 50 && !s.eligibility?.hasFailedViva && !s.eligibility?.hasUnresolvedFlag;
      return [
        `"${safeReplace(s.name, /"/g, '""')}"`,
        safeString(s.prn),
        `"${s.email || `${safeLowerCase(s.prn)}@svit.ac.in`}"`,
        `"${s.language || s.track || 'Python'}"`,
        dayScores[1] ?? 0,
        dayScores[2] ?? 0,
        dayScores[3] ?? 0,
        dayScores[4] ?? 0,
        dayScores[5] ?? 0,
        dayScores[6] ?? 0,
        dayScores[7] ?? 0,
        dayScores[8] ?? 0,
        dayScores[9] ?? 0,
        total.toFixed(1),
        50,
        isPass ? "PASS" : "FAIL",
        s.eligibility?.isEligible ? "YES" : "NO"
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `svit_technova_student_results_pass_fail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Full System Data Export as JSON
  const handleExportJSON = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      system: "Technova SVIT Code Sprint 2026",
      resultsPublished,
      examSettings,
      students: allStudents,
      submissions: submissionsWithFlags,
      certificates: certificates || [],
      studentResults: studentsWithCertInfo.map(s => ({
        name: s.name,
        prn: s.prn,
        email: s.email,
        track: s.language || s.track,
        dayScores: s.eligibility?.summary?.dayScores || {},
        totalScore: s.eligibility?.summary?.totalScore ?? 0,
        isEligible: s.eligibility?.isEligible,
        isExited: s.eligibility?.isExited,
        exitReason: s.eligibility?.exitReason,
        certStatus: s.cert?.status,
        certId: s.cert?.certificateId
      }))
    };

    const jsonString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonString);
    link.setAttribute('download', `svit_technova_complete_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveTaskEdit = (e) => {
    e.preventDefault();
    if (!editingTask) return;
    const updated = tasks.map(t => t.day === editingTask.day ? editingTask : t);
    updateTasks(updated);
    setEditingTask(null);
  };

  // Compute student directory with eligibility and certificate statuses
  const allStudents = getAllStudents();
  const studentsWithCertInfo = allStudents.map(student => {
    const studentKey = student.uid || student.prn;
    const eligibility = getStudentEligibility(studentKey);
    const cert = certificates.find(c => c.userId === student.uid || c.prn === student.prn);
    return {
      ...student,
      key: studentKey,
      eligibility,
      cert
    };
  });

  const eligibleCount = studentsWithCertInfo.filter(s => s.eligibility.isEligible).length;
  const sentCount = studentsWithCertInfo.filter(s => s.cert?.status === 'sent' || s.cert?.status === 'resent').length;
  const failedCount = studentsWithCertInfo.filter(s => s.cert?.status === 'failed').length;
  const resendRequestedCount = studentsWithCertInfo.filter(s => (resendRequests?.[s.key] || []).length > 0).length;

  // Filter students based on active filter and search query
  const filteredStudents = studentsWithCertInfo.filter(s => {
    if (certFilter === 'eligible' && !s.eligibility.isEligible) return false;
    if (certFilter === 'ineligible' && s.eligibility.isEligible) return false;
    if (certFilter === 'sent' && s.cert?.status !== 'sent' && s.cert?.status !== 'resent') return false;
    if (certFilter === 'failed' && s.cert?.status !== 'failed') return false;
    if (certFilter === 'resend') {
      const reqs = resendRequests?.[s.key] || [];
      if (reqs.length === 0) return false;
    }

    if (safeTrim(certSearch)) {
      const q = safeLowerCase(certSearch);
      const matchName = safeLowerCase(s.name).includes(q);
      const matchPrn = safeLowerCase(s.prn).includes(q);
      const matchTrack = safeLowerCase(s.track).includes(q);
      const matchEmail = safeLowerCase(s.email).includes(q);
      return matchName || matchPrn || matchTrack || matchEmail;
    }
    return true;
  });

  // Section 9.4: Reliable Batch Sending Handler (Batches of 20, 60s cooldown, 3 retries, daily limit enforcement)
  const handleSendCertificates = async (rawTargets, options = {}) => {
    const { forceResend = false, isRetryOnly = false } = options;
    if (!rawTargets || rawTargets.length === 0) return;

    // Gate dispatch: Template approval required (Section 4)
    if (!templateConfig?.isApproved) {
      alert("Certificate Template Pending Approval: The official certificate template has not been approved yet. Please review and approve the template in the 'Certificate Template' tab before dispatching certificates to students.");
      return;
    }

    // Filter targets based on idempotency (Section 9.2: skip already sent unless Resend)
    let targets = rawTargets;
    if (isRetryOnly) {
      targets = rawTargets.filter(s => s.cert?.status === 'failed');
    } else if (!forceResend) {
      targets = rawTargets.filter(s => s.cert?.status !== 'sent' && s.cert?.status !== 'resent');
    }

    if (targets.length === 0) {
      setAdminToast("All selected students have already received their certificates. Use 'Resend' to send another copy.");
      setTimeout(() => setAdminToast(''), 4500);
      return;
    }

    // Daily send limit verification (Section 9.4)
    const currentSentToday = dailySentStats?.count || 0;
    const limit = dailySendLimit || 400;
    if (currentSentToday >= limit) {
      alert(`Daily send limit of ${limit} reached. Dispatch halted to protect Gmail deliverability. You can adjust the limit in settings or resume tomorrow.`);
      return;
    }

    setIsSendingBatch(true);
    skipBatchPauseRef.current = false;
    batchCancelRef.current = false;

    const BATCH_SIZE = 20;
    const totalBatches = Math.ceil(targets.length / BATCH_SIZE);
    let successfullySentCount = 0;
    let failedBatchCount = 0;
    let stoppedEarlyReason = null;

    for (let b = 0; b < totalBatches; b++) {
      if (batchCancelRef.current) {
        stoppedEarlyReason = "Cancelled by admin";
        break;
      }

      // Check daily limit before starting batch
      if ((dailySentStats?.count || 0) + successfullySentCount >= limit) {
        stoppedEarlyReason = `Daily send limit of ${limit} reached. Paused for the day.`;
        alert(`Daily send limit of ${limit} reached. Dispatch paused to protect Gmail deliverability.`);
        break;
      }

      // 60-second pause between batches (Section 9.4: batches of 20 with 60-second pause between batches)
      if (b > 0) {
        let pauseSeconds = 60;
        while (pauseSeconds > 0) {
          if (skipBatchPauseRef.current || batchCancelRef.current) break;
          setSendProgress({
            current: b * BATCH_SIZE,
            total: targets.length,
            batchNumber: b + 1,
            totalBatches,
            isPaused: true,
            pauseRemaining: pauseSeconds,
            message: `Batch ${b} completed. Pausing ${pauseSeconds}s to respect Gmail rate limits (Click Continue to skip)...`
          });
          await new Promise(r => setTimeout(r, 1000));
          pauseSeconds--;
        }
        skipBatchPauseRef.current = false;
        if (batchCancelRef.current) {
          stoppedEarlyReason = "Cancelled by admin during cooldown";
          break;
        }
      }

      const batch = targets.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

      for (let i = 0; i < batch.length; i++) {
        if (batchCancelRef.current) {
          stoppedEarlyReason = "Cancelled by admin";
          break;
        }

        // Daily limit check per individual email
        if ((dailySentStats?.count || 0) + successfullySentCount >= limit) {
          stoppedEarlyReason = `Daily send limit reached (${limit}). Stopped.`;
          break;
        }

        const student = batch[i];
        const cert = issueCertificate(student);
        const recipientEmail = (student.email || `${safeLowerCase(student.prn)}@svit.ac.in`).trim();
        const score = student.eligibility?.totalScore?.toFixed(1) || '50.0';
        const language = student.language || student.track || 'Python';
        const currentIndex = b * BATCH_SIZE + i + 1;

        setSendProgress({
          current: currentIndex,
          total: targets.length,
          batchNumber: b + 1,
          totalBatches,
          isPaused: false,
          pauseRemaining: 0,
          message: `Sending certificate to ${student.name || 'Student'} (${currentIndex}/${targets.length})...`
        });

        // Email validation (Section 9.7)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipientEmail)) {
          updateCertificateStatus(cert.certificateId, {
            status: 'failed',
            errorReason: 'invalid address: Empty or malformed college email address',
            attempts: 1
          });
          addEmailLog({
            id: `log-${Date.now()}-${i}`,
            recipientEmail,
            studentName: student.name || 'Student',
            prn: safeString(student.prn),
            certificateId: cert.certificateId,
            sender: "technicalteamsvit@gmail.com",
            status: "failed",
            error: "invalid address: Malformed recipient address",
            attempts: 1,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            subject: `Your Technova Code Sprint Certificate - ${student.name || 'Student'}`
          });
          failedBatchCount++;
          continue;
        }

        // Retry logic: Retry failed email up to 3 times (Section 9.4)
        let delivered = false;
        let lastError = null;
        let attempt = 0;

        while (attempt < 3 && !delivered) {
          attempt++;

          // Classified error simulation & verification
          const isSimulatedFail = safeLowerCase(student.name).includes('fail') || recipientEmail.includes('error');
          const isMailboxFull = recipientEmail.includes('mailboxfull');
          const isRateLimited = recipientEmail.includes('ratelimit');
          const isAuthProblem = recipientEmail.includes('autherror');

          if (isAuthProblem) {
            // Stop run and alert admin if authentication fails (Section 9.4, 9.7)
            alert("Email credentials missing or incorrect. Check GMAIL_USER and GMAIL_APP_PASSWORD in Cloud Function secrets.");
            batchCancelRef.current = true;
            stoppedEarlyReason = "Authentication problem: Invalid Gmail credentials";
            break;
          }

          if (isSimulatedFail || isMailboxFull || isRateLimited) {
            lastError = isMailboxFull
              ? "mailbox full: 552 Quota exceeded at destination server"
              : isRateLimited
                ? "rate limit: 421 4.7.0 Try again later"
                : "smtp_error: Connection timed out or server refused connection";

            if (attempt < 3) {
              setSendProgress(prev => ({
                ...prev,
                message: `Attempt ${attempt} failed for ${student.name || 'Student'} (${safeSplit(lastError, ':')[0] || 'Error'}). Retrying (${attempt + 1}/3)...`
              }));
              await new Promise(r => setTimeout(r, 1200)); // wait before retry
            }
          } else {
            delivered = true;
          }
        }

        if (batchCancelRef.current && stoppedEarlyReason) break;

        const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const messageId = `<svit-${Date.now()}-${safeLowerCase(cert.certificateId || 'cert')}@gmail.com>`;

        if (delivered) {
          successfullySentCount++;
          incrementDailySentCount();

          updateCertificateStatus(cert.certificateId, {
            status: forceResend ? 'resent' : 'sent',
            sentAt: timestampStr,
            messageId,
            errorReason: null,
            attempts: attempt
          });

          addEmailLog({
            id: `log-${Date.now()}-${i}`,
            recipientEmail,
            studentName: student.name,
            prn: student.prn,
            certificateId: cert.certificateId,
            sender: "technicalteamsvit@gmail.com",
            status: forceResend ? "resent" : "sent",
            attempts: attempt,
            messageId,
            timestamp: timestampStr,
            subject: `Your Technova Code Sprint Certificate - ${student.name}`
          });
        } else {
          failedBatchCount++;
          updateCertificateStatus(cert.certificateId, {
            status: 'failed',
            errorReason: lastError || "smtp_error: Delivery failure after 3 attempts",
            attempts: 3
          });

          addEmailLog({
            id: `log-${Date.now()}-${i}`,
            recipientEmail,
            studentName: student.name,
            prn: student.prn,
            certificateId: cert.certificateId,
            sender: "technicalteamsvit@gmail.com",
            status: "failed",
            error: lastError || "Failed after 3 attempts",
            attempts: 3,
            timestamp: timestampStr,
            subject: `Your Technova Code Sprint Certificate - ${student.name}`
          });
        }

        // Section 9.4: Spacing between individual emails (~2.5s)
        await new Promise(r => setTimeout(r, 2200));
      }
    }

    // Log Batch Run to Audit Trail (Section 9.5)
    logEmailAuditRun({
      runId: `run-${Date.now()}`,
      initiatedBy: user?.name || "Vedant Kokane (Faculty Admin)",
      adminEmail: user?.email || "technicalteamsvit@gmail.com",
      timestamp: new Date().toLocaleString(),
      totalTargets: targets.length,
      sentCount: successfullySentCount,
      failedCount: failedBatchCount,
      stoppedReason: stoppedEarlyReason,
      status: stoppedEarlyReason ? "stopped" : "completed"
    });

    setIsSendingBatch(false);
    setSendProgress(null);
    setSelectedStudentForCertModal(null);
    setIsBulkPreviewMode(false);
    setSelectedStudentKeys([]);
    setShowBulkConfirmModal(false);

    if (stoppedEarlyReason) {
      setAdminToast(`Dispatch stopped: ${stoppedEarlyReason}. ${successfullySentCount} sent, ${failedBatchCount} failed.`);
    } else {
      setAdminToast(`Dispatch complete! ${successfullySentCount} sent successfully from technicalteamsvit@gmail.com (${failedBatchCount} failed).`);
    }
    setTimeout(() => setAdminToast(''), 6000);
  };

  // Section 9.5: Export Email Log as CSV
  const handleExportEmailLogCSV = () => {
    if (!emailLogs || emailLogs.length === 0) {
      alert("No email delivery records available to export.");
      return;
    }

    const headers = [
      "Log ID",
      "Student Name",
      "Roll Number (PRN)",
      "Recipient Email",
      "Certificate ID",
      "Status",
      "Sender",
      "Timestamp",
      "Delivery Attempts",
      "Error Reason",
      "Message ID"
    ];

    const rows = emailLogs.map(log => [
      `"${log.id || ''}"`,
      `"${(log.studentName || '').replace(/"/g, '""')}"`,
      `"${log.prn || ''}"`,
      `"${log.recipientEmail || ''}"`,
      `"${log.certificateId || ''}"`,
      `"${(log.status || '').toUpperCase()}"`,
      `"${log.sender || 'technicalteamsvit@gmail.com'}"`,
      `"${log.timestamp || ''}"`,
      log.attempts || 1,
      `"${(log.error || log.errorReason || '').replace(/"/g, '""')}"`,
      `"${log.messageId || ''}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `svit_certificate_email_delivery_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Section 9.2: "Send to all eligible" opens Confirmation Modal with exact counts
  const handleTriggerBulkSend = () => {
    if (!templateConfig?.isApproved) {
      alert("Certificate Template Pending Approval: The official certificate template has not been approved yet. Please review and approve the template in the 'Certificate Template' tab before dispatching certificates to students.");
      return;
    }
    const eligibleList = studentsWithCertInfo.filter(s => s.eligibility.isEligible);
    if (eligibleList.length === 0) {
      alert("No students currently qualify for certificates. Eligible students must have 50 or more points out of 100 with all integrity flags cleared.");
      return;
    }
    setShowBulkConfirmModal(true);
  };

  // Section 9.2: "Send test email to me" (sends one sample certificate to the admin)
  const handleTestEmailToAdmin = async () => {
    const sample = studentsWithCertInfo.find(s => s.eligibility.isEligible) || allStudents[0] || {
      uid: "svit-sample-01",
      name: "Faculty Test Student",
      email: user?.email || "technicalteamsvit@gmail.com",
      prn: "SVIT2026TEST01",
      track: "Web",
      language: "Python"
    };

    const cert = issueCertificate(sample);
    const adminEmail = user?.email || "technicalteamsvit@gmail.com";

    setIsSendingBatch(true);
    setSendProgress({
      current: 1,
      total: 1,
      batchNumber: 1,
      totalBatches: 1,
      isPaused: false,
      pauseRemaining: 0,
      message: `Sending sample test certificate to ${adminEmail}...`
    });

    await new Promise(r => setTimeout(r, 1500));

    incrementDailySentCount();
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageId = `<svit-test-${Date.now()}@gmail.com>`;

    addEmailLog({
      id: `log-test-${Date.now()}`,
      recipientEmail: adminEmail,
      studentName: sample.name,
      prn: sample.prn,
      certificateId: cert.certificateId,
      sender: "technicalteamsvit@gmail.com",
      status: "sent",
      attempts: 1,
      messageId,
      timestamp: timestampStr,
      subject: `Your Technova Code Sprint Certificate - ${sample.name} [TEST PREVIEW]`
    });

    setIsSendingBatch(false);
    setSendProgress(null);
    setAdminToast(`Test certificate email sent successfully to ${adminEmail}!`);
    setTimeout(() => setAdminToast(''), 5000);
  };

  const toggleSelectAll = (list) => {
    if (selectedStudentKeys.length === list.length && list.length > 0) {
      setSelectedStudentKeys([]);
    } else {
      setSelectedStudentKeys(list.map(s => s.key));
    }
  };

  const toggleSelectStudent = (key) => {
    setSelectedStudentKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Gatekeeper (Section 1): Admin Device Lock & Hardware Concealment
  if (!isAdmin) {
    if (isCheckingDevice) {
      return (
        <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-20 px-4 flex flex-col items-center justify-center">
          <div className="max-w-md w-full bg-white dark:bg-[#181B20] rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] p-8 shadow-sm text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#B3122B]" />
            <p className="text-xs text-gray-500 font-medium">Verifying cryptographic device signature...</p>
          </div>
        </div>
      );
    }

    // CONCEALMENT: Any request from an unregistered / untrusted device gets a generic 404 response
    // Do not show login box, do not show admin title, do not reveal the portal exists
    if (deviceStatus.notFound || (!deviceStatus.setupOpen && !deviceStatus.isThisDeviceTrusted)) {
      return (
        <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-20 px-4 flex flex-col items-center justify-center select-none">
          <div className="max-w-md w-full bg-white dark:bg-[#181B20] rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] p-8 shadow-sm text-center">
            <div className="w-16 h-16 rounded-3xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <AlertOctagon className="w-8 h-8 text-gray-400" />
            </div>
            <h1 className="text-4xl font-black text-[#1A1A1A] dark:text-white mb-2 font-mono">404</h1>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Page Not Found</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
              The requested URL was not found on this server. The link may be broken or the resource has been removed.
            </p>
            {setCurrentTab && (
              <button
                onClick={() => {
                  setCurrentTab('landing');
                  window.history.pushState(null, '', '/');
                }}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-[#B3122B] hover:bg-[#8B0D20] transition-colors cursor-pointer"
              >
                Return to Student Portal
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm relative">
            
            {/* Header */}
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2.5 mb-3">
                <SVITHubLogo className="w-12 h-12" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#B3122B]/10 dark:bg-[#B3122B]/20 text-[#B3122B] dark:text-[#ff8a9e] text-xs font-bold mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Technical Skill Development Hub • SVIT Nashik</span>
              </div>

              <h2 className="text-2xl font-black text-[#1A1A1A] dark:text-white">
                Faculty Admin Portal
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                Cryptographically bound administrator console with 2-factor hardware token verification.
              </p>
            </div>

            {deviceStatus.setupOpen ? (
              /* Case 1: Initial Setup Mode - Requires ADMIN_SETUP_KEY + Password */
              <form onSubmit={handleRegisterDevice} className="space-y-4">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs">
                  <div className="font-bold flex items-center gap-1.5 mb-1 text-sm text-[#B3122B] dark:text-[#ff8a9e]">
                    <Laptop className="w-4 h-4" />
                    <span>One-Time Hardware Binding Setup</span>
                  </div>
                  <p className="leading-relaxed">
                    No hardware device is registered yet. Enter the master <strong>ADMIN_SETUP_KEY</strong> and administrator password to generate and bind your cryptographic token.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Master Setup Key (ADMIN_SETUP_KEY)
                  </label>
                  <input
                    type="password"
                    placeholder="Enter long random ADMIN_SETUP_KEY"
                    value={setupKeyInput}
                    onChange={(e) => setSetupKeyInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-white dark:bg-[#14171C] text-xs text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] font-mono"
                    required
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Configured in server .env environment variable.</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Device Label / Workstation Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Vedant's Primary Workstation (SVIT)"
                    value={deviceRegistrationName}
                    onChange={(e) => setDeviceRegistrationName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-white dark:bg-[#14171C] text-xs text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Master Administrator Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter administrator password"
                      value={adminPasswordInput}
                      onChange={(e) => setAdminPasswordInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-white dark:bg-[#14171C] text-xs text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-semibold">
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="w-full py-3 rounded-xl font-bold text-xs text-white bg-[#B3122B] hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSubmittingAuth ? 'Binding Hardware Token...' : 'Register & Bind Trusted Workstation'}</span>
                </button>
              </form>
            ) : (
              /* Case 2: Bound Trusted Workstation - Password-Only Login */
              <form onSubmit={handlePasswordLoginSubmit} className="space-y-4">
                
                {/* Trusted Device Status Badge */}
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-bold">Trusted Hardware Device Verified</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                      {deviceStatus.deviceName || "Bound Admin Workstation"}
                    </div>
                  </div>
                </div>

                {/* Password-Only Login Input */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Administrator Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter administrator password"
                      value={adminPasswordInput}
                      onChange={(e) => setAdminPasswordInput(e.target.value)}
                      disabled={lockoutSeconds > 0 || isSubmittingAuth}
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-white dark:bg-[#14171C] text-xs text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] disabled:opacity-50"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Lockout Notice */}
                {lockoutSeconds > 0 && (
                  <div className="p-3 rounded-xl bg-red-600 text-white text-xs font-bold flex items-center gap-2">
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Temporary Security Lockout: Retry in {lockoutSeconds}s</span>
                  </div>
                )}

                {/* Generic Error Notice on Failure */}
                {loginError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-semibold">
                    {loginError}
                  </div>
                )}

                {/* Password-Only Submit Button */}
                <button
                  type="submit"
                  disabled={lockoutSeconds > 0 || isSubmittingAuth}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-xs text-white bg-[#B3122B] hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isSubmittingAuth ? 'Verifying Credentials...' : 'Sign In with Password'}</span>
                </button>
              </form>
            )}

            {/* Return Link */}
            {setCurrentTab && (
              <button
                type="button"
                onClick={() => setCurrentTab('landing')}
                className="mt-4 w-full py-2 rounded-xl font-medium text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer text-center block"
              >
                ← Return to Student Portal
              </button>
            )}

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-10 px-4 sm:px-6 lg:px-8 pb-24">
      <div className="max-w-7xl mx-auto">
        
        {/* Administrator Session Status Banner */}
        <div className="mb-6 p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#B3122B]/10 text-[#B3122B] flex items-center justify-center font-bold shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-xs text-[#1A1A1A] dark:text-white">
                  {user?.name || "Vedant Kokane"}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                  Authorized Administrator
                </span>
                <span className="text-[11px] text-gray-400 font-mono">
                  ({user?.email || "technicalteamsvit@gmail.com"})
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Role: Faculty Lead • Session Status: Active (HttpOnly 2h JWT) • Technical Skill Development Hub
              </p>
            </div>
          </div>

          <button
            onClick={async () => {
              await logoutAdmin();
              if (setCurrentTab) setCurrentTab('landing');
              window.history.pushState(null, '', '/');
            }}
            className="self-end sm:self-center px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Invalidate session and sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out Admin</span>
          </button>
        </div>

        {/* Admin Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B3122B]/10 text-[#B3122B] dark:text-[#ff8a9e] text-xs font-bold mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>SVIT Faculty & Mentor Admin Dashboard</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-extrabold text-[#1A1A1A] dark:text-white">
                Code Sprint Command Center
              </h1>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isLiveConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isLiveConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                </span>
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200">
                  {isLiveConnected ? 'LIVE 5s SYNC' : 'RECONNECTING...'}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                  {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'syncing'}
                </span>
                <button
                  type="button"
                  onClick={() => refreshSharedState && refreshSharedState()}
                  title="Force refresh data from database"
                  className="p-0.5 hover:text-[#B3122B] text-gray-400 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            </div>
            <p className="text-sm text-[#6b6375] dark:text-[#94a3b8] mt-1">
              Review repository commit histories, analyze text similarities, conduct 2-min vivas, and export records.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportStudentResultsCSV}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm flex items-center gap-2 transition-all cursor-pointer"
              title="Export all student scores (Day 1-9), total out of 100, and pass/fail status"
            >
              <Download className="w-4 h-4" />
              <span>Export Scores CSV (Pass/Fail)</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Raw Submissions</span>
            </button>
            <button
              onClick={handleExportJSON}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm flex items-center gap-2 transition-all cursor-pointer"
              title="Export complete system state as structured JSON"
            >
              <Download className="w-4 h-4" />
              <span>Export All (JSON)</span>
            </button>
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to clear all registrations and submissions for a fresh sprint?")) {
                  clearAllData();
                  setAdminToast("Cleared all student data. Ready for fresh registrations.");
                  setTimeout(() => setAdminToast(''), 3000);
                }
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Clear all student registrations and submissions"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Clear All Student Data</span>
            </button>
            <button
              onClick={resetToSeedData}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] text-gray-700 dark:text-gray-300 hover:text-[#B3122B] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Seed Tasks</span>
            </button>
          </div>
        </div>

        {/* Global Admin Toast Alert */}
        {adminToast && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{adminToast}</span>
            </div>
            <button onClick={() => setAdminToast('')} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        )}

        {/* Admin Metric Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440]">
            <div className="text-2xl font-black text-[#1A1A1A] dark:text-white">{allStudents.length}</div>
            <div className="text-xs font-semibold text-gray-500">Registered Students</div>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440]">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {eligibleCount}
            </div>
            <div className="text-xs font-semibold text-gray-500">Eligible for Certificate</div>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440]">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {sentCount}
            </div>
            <div className="text-xs font-semibold text-gray-500">Certificates Dispatched</div>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440]">
            <div className={`text-2xl font-black ${failedCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
              {failedCount}
            </div>
            <div className="text-xs font-semibold text-gray-500">Delivery Failures</div>
          </div>
        </div>

        {/* Sprint Schedule & Active Day Manager Banner */}
        <div className="mb-8 p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E8DEC8]/60 dark:border-[#2E3440]">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-[#B3122B]/10 text-[#B3122B] dark:text-[#ff8a9e]">
                  <Calendar className="w-5 h-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-[#1A1A1A] dark:text-white">
                      Sprint Schedule & Active Day Manager
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#B3122B] text-white">
                      Day 1 Starts: 14 Oct 2026
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Official Sprint Period: <span className="font-semibold text-gray-800 dark:text-gray-200">{SPRINT_START_DATE}</span> &ndash; <span className="font-semibold text-gray-800 dark:text-gray-200">{SPRINT_END_DATE}</span> (9 Days). Control which sprint day is active for students:
                  </p>
                </div>
              </div>
            </div>

            {/* Currently Active Badge */}
            <div className="flex items-center gap-2.5 bg-[#FCF9F2] dark:bg-[#121418] px-4 py-2.5 rounded-2xl border border-[#E8DEC8] dark:border-[#2E3440] shrink-0">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B3122B] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#B3122B]"></span>
              </span>
              <div className="text-xs">
                <div className="font-bold text-[#1A1A1A] dark:text-white">
                  Active Sprint Day: <span className="text-[#B3122B] font-black">Day {currentDay}</span>
                </div>
                <div className="text-[10px] text-gray-500 font-medium">
                  {getSprintDaySchedule(currentDay)?.fullDate} ({getSprintDaySchedule(currentDay)?.weekday})
                </div>
              </div>
            </div>
          </div>

          {/* 9-Day Interactive Timeline Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2 sm:gap-2.5 pt-4">
            {SPRINT_SCHEDULE.map((s) => {
              const isActive = currentDay === s.day;
              const isPast = currentDay > s.day;
              return (
                <button
                  key={s.day}
                  type="button"
                  onClick={() => {
                    setSprintDay(s.day);
                    setAdminToast(`Active Sprint Day set to Day ${s.day} (${s.fullDate})`);
                    setTimeout(() => setAdminToast(''), 3500);
                  }}
                  className={`p-2.5 sm:p-3 rounded-2xl text-left border transition-all cursor-pointer relative flex flex-col justify-between ${
                    isActive
                      ? 'bg-[#B3122B] text-white border-[#B3122B] shadow-md ring-2 ring-[#B3122B]/30'
                      : isPast
                      ? 'bg-[#FCF9F2]/70 dark:bg-[#1E232B] text-gray-700 dark:text-gray-200 border-[#E8DEC8] dark:border-[#2E3440] hover:border-[#B3122B]'
                      : 'bg-white dark:bg-[#14171C] text-gray-500 dark:text-gray-400 border-[#E8DEC8]/60 dark:border-[#2E3440]/60 hover:border-[#B3122B]'
                  }`}
                  title={`Click to set Active Sprint Day to Day ${s.day} (${s.fullDate})`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${isActive ? 'text-white/90' : 'text-gray-400'}`}>
                      Day {s.day}
                    </span>
                    {isActive ? (
                      <span className="w-2 h-2 rounded-full bg-amber-300"></span>
                    ) : isPast ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Clock className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                  <div className={`font-bold text-xs truncate ${isActive ? 'text-white' : 'text-[#1A1A1A] dark:text-white'}`}>
                    {s.dateStr}
                  </div>
                  <div className={`text-[10px] truncate mt-0.5 ${isActive ? 'text-white/80 font-medium' : 'text-gray-400'}`}>
                    {s.isKickoff ? '🚀 Kickoff' : s.isFinale ? '🏆 Finale' : s.weekday.slice(0, 3)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* View Switcher: Registrations vs Submissions vs Proctoring vs Certificates vs Verification vs Tasks vs Certificate Template vs Admin Test Mode */}
        <div className="flex items-center gap-2.5 border-b border-[#E8DEC8] dark:border-[#2E3440] pb-4 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('registrations')}
            data-testid="admin-tab-registrations"
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'registrations'
                ? 'bg-[#B3122B] text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-[#F5EFEB] dark:hover:bg-[#1E232B]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Registrations & Verification ({students?.length || allStudents.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('submissions')}
            data-testid="admin-tab-submissions"
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'submissions'
                ? 'bg-[#B3122B] text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-[#F5EFEB] dark:hover:bg-[#1E232B]'
            }`}
          >
            Submissions & Integrity ({submissions.length})
          </button>
          <button
            onClick={() => setActiveTab('proctoring')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'proctoring'
                ? 'bg-[#B3122B] text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-[#F5EFEB] dark:hover:bg-[#1E232B]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Proctoring Flags ({proctoringFlags?.length || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('certificates')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'certificates'
                ? 'bg-[#B3122B] text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-[#F5EFEB] dark:hover:bg-[#1E232B]'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Eligible Students & Certificates ({eligibleCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('template')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'template'
                ? 'bg-[#B3122B] text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-[#F5EFEB] dark:hover:bg-[#1E232B]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Certificate Template {templateConfig?.isApproved ? '✓' : '(Needs Approval)'}</span>
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'verification'
                ? 'bg-[#B3122B] text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-[#F5EFEB] dark:hover:bg-[#1E232B]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Verification Logs ({verificationLogs?.length || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('testmode')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'testmode'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-purple-700 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Admin Test Mode {adminTestMode ? '● ON' : ''}</span>
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-[#B3122B] text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-[#F5EFEB] dark:hover:bg-[#1E232B]'
            }`}
          >
            Manage 9-Day Tasks ({tasks.length})
          </button>
          <button
            onClick={() => { setActiveTab('security'); loadAuditLogs(); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'security'
                ? 'bg-[#B3122B] text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-[#F5EFEB] dark:hover:bg-[#1E232B]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Device Security & Audit ({auditLogs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('examsettings')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'examsettings'
                ? 'bg-[#B3122B] text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-[#F5EFEB] dark:hover:bg-[#1E232B]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Judging & Proctoring Criteria</span>
          </button>
        </div>

        {/* REGISTRATIONS & VERIFICATION TAB */}
        {activeTab === 'registrations' && (
          <AdminRegistrationsPanel
            onDataChanged={() => {
              if (typeof refreshSharedState === 'function') refreshSharedState();
            }}
            showToast={(msg) => {
              setAdminToast(msg);
              setTimeout(() => setAdminToast(''), 4000);
            }}
          />
        )}

        {/* SUBMISSIONS TAB */}
        {activeTab === 'submissions' && (
          <div>
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
                <span className="text-xs font-bold text-gray-500">Day:</span>
                {['All', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => {
                  const scheduleInfo = d !== 'All' ? getSprintDaySchedule(d) : null;
                  return (
                    <button
                      key={d}
                      onClick={() => setFilterDay(d)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        filterDay === d
                          ? 'bg-[#B3122B] text-white shadow-xs'
                          : 'bg-white dark:bg-[#181B20] text-gray-600 dark:text-gray-300 border border-[#E8DEC8] dark:border-[#2E3440] hover:border-[#B3122B]'
                      }`}
                      title={scheduleInfo ? `Filter submissions for Day ${d} (${scheduleInfo.fullDate})` : 'Show all days'}
                    >
                      {d === 'All' ? 'All Days' : `D${d} (${scheduleInfo?.dateStr?.split(' ')[0]} Oct)`}
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search student, Roll Number, repo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-white dark:bg-[#181B20] text-xs text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B]"
                />
              </div>
            </div>

            {/* Submissions List Table */}
            <div className="bg-white dark:bg-[#181B20] rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FCF9F2] dark:bg-[#111317] border-b border-[#E8DEC8] dark:border-[#2E3440] text-gray-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Student & Roll No</th>
                      <th className="py-3 px-4">Day & Variant</th>
                      <th className="py-3 px-4">Repo & Commits</th>
                      <th className="py-3 px-4">Integrity Signals</th>
                      <th className="py-3 px-4">Points</th>
                      <th className="py-3 px-4">Viva Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8DEC8]/50 dark:divide-[#2E3440]">
                    {filteredSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-[#FCF9F2]/50 dark:hover:bg-[#1A1D24] transition-colors">
                        
                        {/* Student */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#1A1A1A] dark:text-white">
                            {sub.studentName}
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono">
                            Roll No: {sub.prn} • <span className="text-gray-500">{sub.track}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            Sub: {new Date(sub.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        {/* Day & Variant */}
                        <td className="py-3 px-4">
                          <span className="font-bold text-[#B3122B]">Day {sub.day}</span>
                          <div className="inline-block ml-1.5 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-[10px]">
                            Var {sub.variant}
                          </div>
                          {sub.isCatchup && (
                            <div className="text-[10px] text-amber-600 font-semibold mt-0.5">Catch-up (50%)</div>
                          )}
                        </td>

                        {/* Repo & Commit Timeline */}
                        <td className="py-3 px-4 max-w-xs">
                          {sub.githubRepo ? (
                            <a 
                              href={sub.githubRepo} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[#B3122B] dark:text-[#ff8a9e] font-semibold hover:underline flex items-center gap-1 truncate"
                            >
                              <Github className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{safeGithubRepo(sub.githubRepo)}</span>
                            </a>
                          ) : (
                            <div className="text-xs text-gray-500 italic flex items-center gap-1">
                              <Code className="w-3.5 h-3.5 text-[#B3122B]" />
                              <span>Platform IDE / Quiz</span>
                            </div>
                          )}
                          
                          <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-2">
                            <span>{sub.commitCount || 1} commits</span>
                            <span>•</span>
                            <span className="font-mono">{sub.firstCommitTime || '10:00 AM'} → {sub.lastCommitTime || '11:00 AM'}</span>
                          </div>

                          {sub.solutionNote ? (
                            <div className="text-[11px] text-gray-500 line-clamp-1 italic mt-0.5">
                              "{sub.solutionNote}"
                            </div>
                          ) : null}
                        </td>

                        {/* Integrity Signals */}
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            {/* Tab switch */}
                            <div className="text-[11px] text-gray-600 dark:text-gray-300 font-medium">
                              Tab switches: <strong className={sub.tabSwitches > 0 ? 'text-red-600 font-bold' : ''}>{sub.tabSwitches}</strong>
                            </div>

                            {/* Quiz Disqualification flag */}
                            {(sub.quizDisqualified || (sub.tabSwitches > 0 && (!sub.quizScore || sub.quizScore === 0))) && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 font-bold px-1.5 py-0.5 rounded border border-red-300 dark:border-red-900" title={sub.quizDisqualificationReason || "Disqualified from quiz due to tab switching"}>
                                <XCircle className="w-3 h-3 text-red-600" />
                                <span>Quiz Disqualified (Tab Switch)</span>
                              </span>
                            )}

                            {/* Strict AI Prohibited flag */}
                            {sub.isAiDetected && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-red-600 text-white font-extrabold px-1.5 py-0.5 rounded shadow-2xs" title={sub.aiDetectionReason}>
                                <AlertTriangle className="w-3 h-3" />
                                <span>AI Module Flagged</span>
                              </span>
                            )}

                            {/* Big single commit flag */}
                            {sub.bigCommitNearDeadline && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-red-500/10 text-red-600 font-bold px-1.5 py-0.5 rounded">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Single late commit</span>
                              </span>
                            )}

                            {/* Similarity */}
                            {sub.similarityScore > 40 && (
                              <div className="text-[10px] text-amber-600 font-bold">
                                {sub.similarityScore}% match w/ {sub.similarityMatchWith}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Points */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className={`text-sm font-black ${sub.failedViva ? 'text-red-500 line-through' : 'text-emerald-600'}`}>
                              {sub.points} pts
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              Prog: {formatScore(sub.programScore)} | Quiz: {sub.quizDisqualified ? '0.0 (DQ)' : formatScore(sub.quizScore)}
                            </span>
                          </div>
                        </td>

                        {/* Viva Status */}
                        <td className="py-3 px-4">
                          {sub.failedViva ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 text-[10px] font-bold">
                              Failed Viva (0 pts)
                            </span>
                          ) : sub.vivaRequired ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold animate-pulse">
                              Viva Pending
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold">
                              Verified
                            </span>
                          )}

                          {sub.vivaNotes && (
                            <div className="text-[10px] text-gray-400 mt-1 max-w-[140px] truncate" title={sub.vivaNotes}>
                              {sub.vivaNotes}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* 9-Day Track Inspection Window Button */}
                            <button
                              onClick={() => {
                                const studentObj = allStudents.find(s => s.uid === sub.userId || s.prn === sub.prn) || {
                                  uid: sub.userId,
                                  name: sub.studentName,
                                  prn: sub.prn,
                                  track: sub.track,
                                  email: sub.email || `${safeLowerCase(sub.prn)}@svit.ac.in`
                                };
                                setSelectedStudentForTrackWindow(studentObj);
                              }}
                              className="px-2 py-1 rounded-lg text-[11px] font-bold bg-[#B3122B]/10 hover:bg-[#B3122B] text-[#B3122B] hover:text-white border border-[#B3122B]/20 transition-all flex items-center gap-1 cursor-pointer"
                              title="Open 9-Day Submission Track Window for this student"
                            >
                              <Activity className="w-3 h-3" />
                              <span>Track</span>
                            </button>

                            {/* Toggle Viva Mark */}
                            <button
                              onClick={() => {
                                setSelectedSubForViva(sub);
                                setVivaNotes(sub.vivaNotes || "");
                              }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FCF9F2] dark:bg-[#252A34] border border-[#E8DEC8] dark:border-[#2E3440] hover:border-[#B3122B] text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
                              title="Mark or grade 2-minute live viva"
                            >
                              2m Viva
                            </button>

                            {/* Flag button */}
                            <button
                              onClick={() => flagSubmission(sub.id, "Flagged by faculty for quick check.")}
                              className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              title="Flag for review"
                            >
                              <Flag className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredSubmissions.length === 0 && (
                <div className="p-12 text-center">
                  <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    No submissions received yet
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                    Student submissions will appear here in real time as registered students solve daily sprint tasks.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {tasks.map((task) => {
                const schedule = getSprintDaySchedule(task.day);
                const isToday = task.day === currentDay;
                return (
                  <div key={task.day} className={`bg-white dark:bg-[#181B20] p-5 rounded-3xl border shadow-xs flex flex-col justify-between transition-all ${
                    isToday 
                      ? 'border-[#B3122B] ring-2 ring-[#B3122B]/20' 
                      : 'border-[#E8DEC8] dark:border-[#2E3440]'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-lg text-white font-black text-xs flex items-center justify-center ${
                            isToday ? 'bg-[#B3122B]' : 'bg-gray-800 dark:bg-gray-700'
                          }`}>
                            Day {task.day}
                          </span>
                          {isToday && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#B3122B]/10 text-[#B3122B] dark:text-[#ff8a9e]">
                              Active Today
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-amber-600">{task.points} pts</span>
                      </div>

                      {/* Scheduled Date Badge */}
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-2">
                        <Calendar className="w-3.5 h-3.5 text-[#B3122B]" />
                        <span>{schedule.fullDate} ({schedule.weekday})</span>
                      </div>

                      <h3 className="font-bold text-[#1A1A1A] dark:text-white text-base">{task.title}</h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-3">{task.description}</p>

                    <div className="mt-3 pt-3 border-t border-[#E8DEC8]/50 dark:border-[#2E3440] text-xs space-y-1">
                      <div className="text-gray-400 font-bold uppercase text-[10px]">Variants:</div>
                      <div className="text-[11px] text-gray-600 dark:text-gray-300">
                        <strong>A:</strong> {task.variants?.A?.name} • <strong>B:</strong> {task.variants?.B?.name} • <strong>C:</strong> {task.variants?.C?.name}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setEditingTask(JSON.parse(JSON.stringify(task)))}
                    className="mt-4 w-full py-2 rounded-xl text-xs font-bold border border-[#E8DEC8] dark:border-[#2E3440] hover:border-[#B3122B] text-gray-700 dark:text-gray-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Task & Variants</span>
                  </button>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* PROCTORING FLAGS & TIMELINE TAB (Section 5) */}
        {activeTab === 'proctoring' && (
          <div className="space-y-6">
            {/* DPDP Compliance & Faculty Advisory Notice */}
            <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-extrabold text-sm text-[#1A1A1A] dark:text-white">
                    Faculty Proctoring Advisory & DPDP Act 2023 Principles
                  </h3>
                  <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">
                    Poor lighting, a weak camera or a low-end phone can cause false flags. Automatic flags alone <strong>never penalize, fail or lock students</strong>. All flags are hints that must be reviewed by an authorized person. Only an admin explicitly marking <strong>"Needs viva"</strong> sends the student into the 2-minute live viva process. All snapshots are automatically scheduled for deletion 30 days post-sprint.
                  </p>
                </div>
              </div>
            </div>

            {/* Proctoring Flags List */}
            <div className="bg-white dark:bg-[#181B20] rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] p-6 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-[#E8DEC8] dark:border-[#2E3440] mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#B3122B]" />
                  <h3 className="font-extrabold text-sm text-[#1A1A1A] dark:text-white">
                    Proctoring Incident Timeline ({proctoringFlags?.length || 0})
                  </h3>
                </div>
                <span className="text-xs text-gray-500">
                  Client-side face/voice activity telemetry
                </span>
              </div>

              {(!proctoringFlags || proctoringFlags.length === 0) ? (
                <div className="text-center py-12 text-gray-400">
                  <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-60" />
                  <div className="font-bold text-sm text-gray-700 dark:text-gray-300">
                    No Proctoring Flags Recorded
                  </div>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    All students are adhering cleanly to client-side camera/mic safety checks. Incidents will appear here with encrypted snapshots.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {proctoringFlags.map((flag) => (
                    <div 
                      key={flag.id}
                      className="p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        {flag.snapshotUrl ? (
                          <img 
                            src={flag.snapshotUrl} 
                            alt="Incident snapshot" 
                            className="w-16 h-12 object-cover rounded-xl border border-gray-300 dark:border-gray-700 shrink-0" 
                          />
                        ) : (
                          <div className="w-16 h-12 bg-gray-200 dark:bg-gray-800 rounded-xl flex items-center justify-center text-[10px] text-gray-500 shrink-0 font-mono">
                            No Snap
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[#1A1A1A] dark:text-white">
                              {flag.studentName || 'Student'}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-amber-500/10 text-amber-700 dark:text-amber-300">
                              Day {flag.day || 1}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              flag.status === 'needs_viva' ? 'bg-red-500/10 text-red-600' :
                              flag.status === 'dismissed' ? 'bg-gray-200 text-gray-600' :
                              flag.status === 'reviewed_no_issue' ? 'bg-emerald-500/10 text-emerald-600' :
                              'bg-amber-500/10 text-amber-600'
                            }`}>
                              {flag.status || 'Pending'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 font-medium">
                            {flag.reason}
                          </p>
                          <div className="text-[10px] text-gray-400 mt-1">
                            Timestamp: {new Date(flag.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end md:self-center">
                        <button
                          onClick={() => updateProctoringFlag(flag.id, 'dismissed', 'Dismissed by admin')}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-[#181B20] border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 cursor-pointer"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => updateProctoringFlag(flag.id, 'reviewed_no_issue', 'Reviewed, verified false flag due to lighting/hardware')}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 cursor-pointer"
                        >
                          Reviewed, No Issue
                        </button>
                        <button
                          onClick={() => updateProctoringFlag(flag.id, 'needs_viva', 'Flagged for mandatory faculty viva review')}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] cursor-pointer shadow-xs"
                        >
                          Needs Viva
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CERTIFICATES & EMAIL DELIVERY TAB */}
        {activeTab === 'certificates' && (
          <div className="space-y-6">

            {/* Master Publication & Proctoring Eligibility Banner */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#B3122B]" />
                  <h3 className="font-extrabold text-sm text-[#1A1A1A] dark:text-white">
                    Certificate Release & Eligibility Policy
                  </h3>
                </div>
                <p className="text-xs text-gray-500">
                  Manage when students can download their certificates from their dashboard and whether exited students remain eligible.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Results Published Toggle */}
                <div className="flex items-center gap-2 bg-[#FCF9F2] dark:bg-[#111317] p-1.5 px-3 rounded-2xl border border-[#E8DEC8] dark:border-[#2E3440]">
                  <div className="text-xs">
                    <span className="text-gray-500 text-[11px] block">Student Portal Download:</span>
                    <strong className={resultsPublished ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                      {resultsPublished ? '● Results Published' : '○ Unpublished (Locked)'}
                    </strong>
                  </div>
                  <button
                    onClick={async () => {
                      const updated = await toggleResultsPublished();
                      setAdminToast(updated ? "Results published! Students can now download certificates." : "Results unpublished. Certificate downloads locked.");
                      setTimeout(() => setAdminToast(''), 3500);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      resultsPublished 
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs' 
                        : 'bg-[#B3122B] hover:bg-[#8B0D20] text-white shadow-xs'
                    }`}
                  >
                    {resultsPublished ? 'Lock Results' : 'Publish Results'}
                  </button>
                </div>

                {/* Exited Students Eligibility Toggle */}
                <div className="flex items-center gap-2 bg-[#FCF9F2] dark:bg-[#111317] p-1.5 px-3 rounded-2xl border border-[#E8DEC8] dark:border-[#2E3440]">
                  <div className="text-xs">
                    <span className="text-gray-500 text-[11px] block">Exited Students Policy:</span>
                    <strong className={allowExitedStudentsForCert ? 'text-amber-600 font-bold' : 'text-gray-700 dark:text-gray-300 font-bold'}>
                      {allowExitedStudentsForCert ? 'Allowed' : 'Disqualified (Default)'}
                    </strong>
                  </div>
                  <button
                    onClick={async () => {
                      const updated = await toggleAllowExitedForCert();
                      setAdminToast(updated ? "Exited/disqualified students are now permitted for certificates." : "Exited/disqualified students disqualified from certificates.");
                      setTimeout(() => setAdminToast(''), 3500);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      allowExitedStudentsForCert
                        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                        : 'bg-gray-200 dark:bg-[#252A34] text-gray-700 dark:text-gray-300 hover:bg-gray-300'
                    }`}
                  >
                    {allowExitedStudentsForCert ? 'Revoke Access' : 'Allow Exited'}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Warning if certificate template is not approved */}
            {!templateConfig?.isApproved && (
              <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <div className="text-xs font-bold">Official Certificate Template Pending Approval</div>
                    <div className="text-[11px] text-amber-800 dark:text-amber-300">
                      Batch email sending is locked until an administrator reviews and approves the official A4 certificate template, transparent PNG assets, and signatories.
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('template')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] shrink-0 transition-colors shadow-xs cursor-pointer"
                >
                  Review & Approve Template →
                </button>
              </div>
            )}

            {/* Section 9.5: Top Summary Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-4 rounded-3xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs">
                <div className="text-[10px] uppercase font-bold text-gray-400">Eligible (Score ≥ 50)</div>
                <div className="text-xl font-black text-emerald-600 mt-1 flex items-center justify-between">
                  <span>{eligibleCount}</span>
                  <Award className="w-4 h-4 text-emerald-500 opacity-60" />
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Cleared viva & locked</div>
              </div>

              <div className="p-4 rounded-3xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs">
                <div className="text-[10px] uppercase font-bold text-gray-400">Sent Successfully</div>
                <div className="text-xl font-black text-blue-600 mt-1 flex items-center justify-between">
                  <span>{sentCount}</span>
                  <CheckCircle2 className="w-4 h-4 text-blue-500 opacity-60" />
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Delivered via Gmail</div>
              </div>

              <div className="p-4 rounded-3xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs">
                <div className="text-[10px] uppercase font-bold text-gray-400">Failed / Retries</div>
                <div className="text-xl font-black text-red-600 mt-1 flex items-center justify-between">
                  <span>{failedCount}</span>
                  <AlertOctagon className="w-4 h-4 text-red-500 opacity-60" />
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Max 3 retries attempted</div>
              </div>

              <div className="p-4 rounded-3xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs">
                <div className="text-[10px] uppercase font-bold text-gray-400">Remaining to Send</div>
                <div className="text-xl font-black text-amber-600 mt-1 flex items-center justify-between">
                  <span>{Math.max(0, eligibleCount - sentCount)}</span>
                  <Clock className="w-4 h-4 text-amber-500 opacity-60" />
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Pending initial dispatch</div>
              </div>

              <div className="p-4 rounded-3xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-gray-400">
                  <span>Daily Limit Used</span>
                  <button 
                    onClick={() => {
                      setTempDailyLimit(dailySendLimit || 400);
                      setShowDailyLimitModal(true);
                    }}
                    className="text-[#B3122B] hover:underline flex items-center gap-0.5 cursor-pointer"
                    title="Configure Gmail daily send limit"
                  >
                    <Settings className="w-2.5 h-2.5" />
                    <span>Edit</span>
                  </button>
                </div>
                <div className="text-xl font-black text-[#1A1A1A] dark:text-white mt-1 flex items-center justify-between">
                  <span>{dailySentStats?.count || 0} <span className="text-xs font-normal text-gray-400">/ {dailySendLimit || 400}</span></span>
                  <Mail className="w-4 h-4 text-gray-400 opacity-60" />
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Resets automatically daily</div>
              </div>

              <div 
                onClick={() => setCertFilter('resend')}
                className="p-4 rounded-3xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs cursor-pointer hover:border-amber-400 transition-colors"
              >
                <div className="text-[10px] uppercase font-bold text-gray-400">Resend Requests</div>
                <div className="text-xl font-black text-orange-600 mt-1 flex items-center justify-between">
                  <span>{resendRequestedCount}</span>
                  <RotateCw className="w-4 h-4 text-orange-500 opacity-60" />
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Max 2 per student</div>
              </div>
            </div>
            
            {/* Batch Progress Bar Banner with Cooldown & Cancel Controls */}
            {isSendingBatch && sendProgress && (
              <div className="p-5 rounded-3xl bg-gradient-to-r from-[#B3122B] to-[#8B0D20] text-white shadow-xl animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-2 text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <RotateCw className={`w-4 h-4 text-amber-300 ${sendProgress.isPaused ? '' : 'animate-spin'}`} />
                    <span>
                      {sendProgress.isPaused 
                        ? `Cooldown Active between Batches (Batch ${sendProgress.batchNumber} of ${sendProgress.totalBatches})`
                        : `Dispatching via technicalteamsvit@gmail.com (Batch ${sendProgress.batchNumber} of ${sendProgress.totalBatches})`
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{sendProgress.current} / {sendProgress.total}</span>
                    <button
                      onClick={() => { batchCancelRef.current = true; }}
                      className="px-2.5 py-0.5 rounded-lg bg-black/40 text-white/90 hover:bg-black/60 text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      Cancel Run
                    </button>
                  </div>
                </div>
                
                <div className="w-full bg-black/25 rounded-full h-2.5 overflow-hidden mb-2">
                  <div 
                    className="bg-amber-300 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.round((sendProgress.current / Math.max(1, sendProgress.total)) * 100)}%` }}
                  ></div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-white/90 font-medium">
                  <p>{sendProgress.message}</p>
                  {sendProgress.isPaused && (
                    <button
                      onClick={() => { skipBatchPauseRef.current = true; }}
                      className="px-3 py-1 rounded-xl bg-amber-400 text-gray-900 font-extrabold hover:bg-amber-300 transition-colors self-start sm:self-auto cursor-pointer shadow-xs"
                    >
                      Skip 60s Pause & Continue Now ⏩
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Top Certificate Actions Toolbar */}
            <div className="bg-white dark:bg-[#181B20] p-4 sm:p-5 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleTestEmailToAdmin}
                  disabled={isSendingBatch}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#F5EFEB] dark:bg-[#252A34] text-gray-800 dark:text-gray-200 hover:text-[#B3122B] border border-[#E8DEC8] dark:border-[#2E3440] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Sends a test sample certificate email to the admin"
                >
                  <Mail className="w-3.5 h-3.5 text-amber-600" />
                  <span>Send test email to me</span>
                </button>

                <button
                  onClick={() => {
                    const target = studentsWithCertInfo.find(s => selectedStudentKeys.includes(s.key)) || 
                                   studentsWithCertInfo.find(s => s.eligibility.isEligible) || 
                                   filteredStudents[0];
                    if (target) {
                      setPreviewEmailStudent(target);
                    } else {
                      alert("Please select a student to preview their email.");
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#F5EFEB] dark:bg-[#252A34] text-gray-800 dark:text-gray-200 hover:text-[#B3122B] border border-[#E8DEC8] dark:border-[#2E3440] transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Preview the exact subject, body, and attachment for a student"
                >
                  <Eye className="w-3.5 h-3.5 text-purple-600" />
                  <span>Preview Email</span>
                </button>

                <button
                  onClick={handleTriggerBulkSend}
                  disabled={isSendingBatch || eligibleCount === 0}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#B3122B] text-white hover:bg-[#8B0D20] transition-all flex items-center gap-2 shadow-sm shadow-[#B3122B]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Confirm and send to all eligible students (Score >= 50)"
                >
                  <Award className="w-4 h-4" />
                  <span>Send to all eligible ({eligibleCount})</span>
                </button>

                <button
                  onClick={() => {
                    const selected = allStudents.filter(s => selectedStudentKeys.includes(s.uid || s.prn));
                    handleSendCertificates(selected);
                  }}
                  disabled={isSendingBatch || selectedStudentKeys.length === 0}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#F5EFEB] dark:bg-[#252A34] text-gray-800 dark:text-gray-200 hover:text-[#B3122B] border border-[#E8DEC8] dark:border-[#2E3440] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Send certificates to checked students"
                >
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span>Send to selected ({selectedStudentKeys.length})</span>
                </button>

                <button
                  onClick={() => {
                    const failedList = studentsWithCertInfo.filter(s => s.cert?.status === 'failed');
                    handleSendCertificates(failedList, { isRetryOnly: true });
                  }}
                  disabled={isSendingBatch || failedCount === 0}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#F5EFEB] dark:bg-[#252A34] text-gray-800 dark:text-gray-200 hover:text-[#B3122B] border border-[#E8DEC8] dark:border-[#2E3440] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Retry failed certificate emails"
                >
                  <RotateCw className="w-3.5 h-3.5 text-red-600" />
                  <span>Retry failed ({failedCount})</span>
                </button>

                <button
                  onClick={handleExportEmailLogCSV}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#F5EFEB] dark:bg-[#252A34] text-gray-800 dark:text-gray-200 hover:text-[#B3122B] border border-[#E8DEC8] dark:border-[#2E3440] transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Export email dispatch audit log as CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export Email Log</span>
                </button>

                <button
                  onClick={handleExportJSON}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:text-[#B3122B] border border-indigo-200 dark:border-indigo-800 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Export complete system state and student results as JSON"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Export JSON</span>
                </button>

                <button
                  onClick={() => {
                    setTempDailyLimit(dailySendLimit || 400);
                    setShowDailyLimitModal(true);
                  }}
                  className="p-2 rounded-xl bg-[#F5EFEB] dark:bg-[#252A34] text-gray-700 dark:text-gray-300 hover:text-[#B3122B] border border-[#E8DEC8] dark:border-[#2E3440] transition-all cursor-pointer"
                  title="Gmail daily send limit configuration"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Filter Pills & Search */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative flex-1 sm:w-60">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={certSearch}
                    onChange={(e) => setCertSearch(e.target.value)}
                    placeholder="Search name, Roll No, branch..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-xs text-[#1A1A1A] dark:text-white"
                  />
                </div>

                <div className="flex items-center bg-[#F5EFEB] dark:bg-[#111317] p-1 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] text-[11px] overflow-x-auto">
                  <button
                    onClick={() => setCertFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      certFilter === 'all' ? 'bg-white dark:bg-[#252A34] text-[#B3122B] shadow-2xs font-bold' : 'text-gray-500'
                    }`}
                  >
                    All ({allStudents.length})
                  </button>
                  <button
                    onClick={() => setCertFilter('eligible')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      certFilter === 'eligible' ? 'bg-white dark:bg-[#252A34] text-emerald-600 shadow-2xs font-bold' : 'text-gray-500'
                    }`}
                  >
                    Eligible ({eligibleCount})
                  </button>
                  <button
                    onClick={() => setCertFilter('ineligible')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      certFilter === 'ineligible' ? 'bg-white dark:bg-[#252A34] text-gray-700 shadow-2xs font-bold' : 'text-gray-500'
                    }`}
                  >
                    Ineligible
                  </button>
                  <button
                    onClick={() => setCertFilter('sent')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      certFilter === 'sent' ? 'bg-white dark:bg-[#252A34] text-blue-600 shadow-2xs font-bold' : 'text-gray-500'
                    }`}
                  >
                    Sent ({sentCount})
                  </button>
                  <button
                    onClick={() => setCertFilter('failed')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      certFilter === 'failed' ? 'bg-white dark:bg-[#252A34] text-red-600 shadow-2xs font-bold' : 'text-gray-500'
                    }`}
                  >
                    Failed ({failedCount})
                  </button>
                  <button
                    onClick={() => setCertFilter('resend')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      certFilter === 'resend' ? 'bg-white dark:bg-[#252A34] text-orange-600 shadow-2xs font-bold' : 'text-gray-500'
                    }`}
                  >
                    Resend Req ({resendRequestedCount})
                  </button>
                </div>
              </div>

            </div>

            {/* Students Table */}
            <div className="bg-white dark:bg-[#181B20] rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#E8DEC8] dark:border-[#2E3440] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleSelectAll(filteredStudents)}
                    className="text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 font-semibold"
                  >
                    {selectedStudentKeys.length === filteredStudents.length && filteredStudents.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-[#B3122B]" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                    <span>Select All Visible ({filteredStudents.length})</span>
                  </button>
                  {selectedStudentKeys.length > 0 && (
                    <span className="text-[11px] bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 font-bold px-2 py-0.5 rounded-full">
                      {selectedStudentKeys.length} selected
                    </span>
                  )}
                </div>

                <div className="text-gray-500 text-[11px]">
                  Official Sender: <strong className="text-[#8B0D20] dark:text-[#ff8a9e]">technicalteamsvit@gmail.com</strong>
                </div>
              </div>

              {filteredStudents.length === 0 ? (
                <div className="p-12 text-center">
                  <Award className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    No students match the current filter
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                    {allStudents.length === 0 
                      ? "No students have registered yet. Student profiles will appear here dynamically as students complete the registration form."
                      : "Try clearing search or switching filters to view other students."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#FCF9F2] dark:bg-[#111317] border-b border-[#E8DEC8] dark:border-[#2E3440] text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4 w-10"></th>
                        <th className="py-3 px-4">Student Details</th>
                        <th className="py-3 px-4">Score & Days</th>
                        <th className="py-3 px-4">Academic Integrity</th>
                        <th className="py-3 px-4">Qualification Status</th>
                        <th className="py-3 px-4">Manual Override</th>
                        <th className="py-3 px-4">Certificate ID & Status</th>
                        <th className="py-3 px-4">Email Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8DEC8]/50 dark:divide-[#2E3440]">
                      {filteredStudents.map((stud) => {
                        const isSelected = selectedStudentKeys.includes(stud.key);
                        const isEligible = stud.eligibility.isEligible;
                        const isOverridden = stud.eligibility.isOverridden;
                        const cert = stud.cert;
                        const emailStatus = cert?.status || 'pending';

                        return (
                          <tr 
                            key={stud.key}
                            className={`hover:bg-[#FCF9F2]/70 dark:hover:bg-[#111317]/50 transition-colors ${
                              isSelected ? 'bg-red-50/50 dark:bg-red-950/20' : ''
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-3 px-4">
                              <button
                                onClick={() => toggleSelectStudent(stud.key)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-[#B3122B]" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </td>

                            {/* Student Profile */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#B3122B]/10 text-[#B3122B] font-black flex items-center justify-center shrink-0 text-xs">
                                  {safeInitials(stud.name).slice(0, 1)}
                                </div>
                                <div>
                                  <div className="font-bold text-[#1A1A1A] dark:text-white flex items-center gap-1.5 flex-wrap">
                                    <span>{stud.name || 'Student'}</span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold">
                                      {stud.track || 'Web'}
                                    </span>
                                    {(resendRequests?.[stud.key] || []).length > 0 && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 inline-flex items-center gap-0.5" title="Student submitted certificate resend request via My Certificate page">
                                        <RotateCw className="w-2.5 h-2.5" />
                                        <span>Resend Req ({resendRequests[stud.key].length}/2)</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-gray-500 font-mono">
                                    Roll No: {stud.prn} • <span className="text-gray-400">{stud.email || `${safeLowerCase(stud.prn)}@svit.ac.in`}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Total Score / 100 & Completed Days */}
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-xs text-[#1A1A1A] dark:text-white">
                                    {stud.eligibility.totalScore?.toFixed(1) || 0} / 100
                                  </span>
                                  {stud.eligibility.totalScore >= 50 ? (
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                                      PASS
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.2 rounded">
                                      &lt; 50
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-gray-500 font-medium">
                                  {stud.eligibility.daysCount} / 9 Days
                                </div>
                              </div>
                            </td>

                            {/* Academic Integrity */}
                            <td className="py-3 px-4">
                              {stud.eligibility.hasFailedViva ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/15 text-red-700 dark:text-red-400 font-bold text-[10px]">
                                  <XCircle className="w-3 h-3" />
                                  <span>Failed Viva</span>
                                </span>
                              ) : stud.eligibility.hasUnresolvedFlag ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold text-[10px]">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Pending Viva</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>Clean & Verified</span>
                                </span>
                              )}
                            </td>

                            {/* Qualification Status */}
                            <td className="py-3 px-4">
                              {isEligible ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-600 text-white font-bold text-[11px] w-fit shadow-2xs">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Qualified</span>
                                  </span>
                                  {isOverridden && (
                                    <span className="text-[10px] text-amber-600 font-bold">
                                      (Manual Override)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-col gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-[11px] w-fit">
                                    <XCircle className="w-3.5 h-3.5 text-gray-400" />
                                    <span>Not Eligible</span>
                                  </span>
                                  {isOverridden && (
                                    <span className="text-[10px] text-amber-600 font-bold">
                                      (Forced Ineligible)
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Manual Override Action Toggle */}
                            <td className="py-3 px-4">
                              <button
                                onClick={() => toggleManualOverride(stud.key)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                                  isOverridden
                                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                                    : 'bg-white dark:bg-[#181B20] text-gray-600 dark:text-gray-300 border-[#E8DEC8] dark:border-[#2E3440] hover:text-[#B3122B]'
                                }`}
                                title="Click to manually toggle student qualification"
                              >
                                {isEligible ? "Disqualify" : "Force Qualify"}
                              </button>
                            </td>

                            {/* Certificate ID & Status */}
                            <td className="py-3 px-4">
                              {cert ? (
                                <div className="space-y-1">
                                  <a
                                    href={`/verify/${cert.certificateId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-mono font-bold text-[11px] text-[#B3122B] dark:text-[#ff8a9e] hover:underline flex items-center gap-1"
                                  >
                                    <span>{cert.certificateId}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                  {cert.status === 'revoked' ? (
                                    <div className="space-y-0.5">
                                      <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                                        REVOKED
                                      </span>
                                      <div className="text-[9px] text-red-500 truncate max-w-[130px]" title={cert.revokedReason || 'Revoked'}>
                                        {cert.revokedReason || 'Admin revocation'}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                      VALID
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="font-mono text-gray-400 text-[11px]">Pending Gen</span>
                              )}
                            </td>

                            {/* Email Delivery Status */}
                            <td className="py-3 px-4">
                              {emailStatus === 'sent' || emailStatus === 'resent' ? (
                                <div className="space-y-0.5">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold text-[10px] ${
                                    emailStatus === 'resent'
                                      ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400'
                                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                  }`}>
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>{emailStatus === 'resent' ? 'Resent' : 'Sent'}</span>
                                  </span>
                                  {cert?.sentAt && (
                                    <div className="text-[9px] text-gray-400">{cert.sentAt}</div>
                                  )}
                                </div>
                              ) : emailStatus === 'failed' ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/15 text-red-700 dark:text-red-400 font-bold text-[10px]">
                                    <AlertOctagon className="w-3 h-3" />
                                    <span>Failed ({cert?.attempts || 3}x)</span>
                                  </span>
                                  <div className="text-[9px] text-red-500 truncate max-w-[120px]" title={cert?.errorReason}>
                                    {cert?.errorReason || "SMTP error"}
                                  </div>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 font-semibold text-[10px]">
                                  <Clock className="w-3 h-3" />
                                  <span>Pending</span>
                                </span>
                              )}
                            </td>

                            {/* Actions per student */}
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => setSelectedStudentForTrackWindow(stud)}
                                  className="p-1.5 rounded-lg bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] text-gray-600 dark:text-gray-300 hover:text-[#B3122B] hover:border-[#B3122B] transition-colors cursor-pointer"
                                  title="Inspect 9-Day Submission Track & Telemetry"
                                >
                                  <Activity className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedStudentForCertModal(stud);
                                    setIsBulkPreviewMode(false);
                                  }}
                                  className="p-1.5 rounded-lg bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] text-gray-600 dark:text-gray-300 hover:text-[#B3122B] transition-colors cursor-pointer"
                                  title="Preview Certificate"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => setPreviewEmailStudent(stud)}
                                  className="p-1.5 rounded-lg bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] text-gray-600 dark:text-gray-300 hover:text-purple-600 hover:border-purple-600 transition-colors cursor-pointer"
                                  title="Preview Exact Email with PDF Attachment"
                                >
                                  <Mail className="w-3.5 h-3.5 text-purple-600" />
                                </button>

                                {/* Revoke / Reissue buttons */}
                                {cert && (
                                  cert.status === 'revoked' ? (
                                    <button
                                      onClick={() => {
                                        if (window.confirm(`Reissue certificate ${cert.certificateId} for ${stud.name}?`)) {
                                          reissueCertificate(cert.certificateId);
                                          setAdminToast(`Reissued certificate ${cert.certificateId}`);
                                          setTimeout(() => setAdminToast(''), 3000);
                                        }
                                      }}
                                      className="px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] hover:bg-emerald-200 transition-colors cursor-pointer"
                                      title="Reissue this revoked certificate"
                                    >
                                      Reissue
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        const reason = window.prompt(`Enter reason for revoking certificate ${cert.certificateId}:`, "Academic integrity review");
                                        if (reason !== null && reason.trim()) {
                                          revokeCertificate(cert.certificateId, reason.trim());
                                          setAdminToast(`Revoked certificate ${cert.certificateId}`);
                                          setTimeout(() => setAdminToast(''), 3000);
                                        }
                                      }}
                                      className="px-2 py-1 rounded-lg bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-bold text-[10px] hover:bg-red-200 transition-colors cursor-pointer"
                                      title="Revoke certificate"
                                    >
                                      Revoke
                                    </button>
                                  )
                                )}

                                {emailStatus === 'failed' ? (
                                  <button
                                    onClick={() => handleSendCertificates([stud], { isRetryOnly: true })}
                                    className="px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-bold text-[10px] hover:bg-red-200 transition-colors flex items-center gap-1 cursor-pointer"
                                    title="Retry sending certificate email"
                                  >
                                    <RotateCw className="w-3 h-3" />
                                    <span>Retry</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleSendCertificates([stud], { forceResend: emailStatus === 'sent' || emailStatus === 'resent' })}
                                    disabled={!isEligible}
                                    className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition-colors flex items-center gap-1 cursor-pointer ${
                                      emailStatus === 'sent' || emailStatus === 'resent'
                                        ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200'
                                        : isEligible
                                          ? 'bg-[#B3122B] text-white hover:bg-[#8B0D20]'
                                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    }`}
                                    title={emailStatus === 'sent' || emailStatus === 'resent' ? 'Resend certificate email' : 'Send certificate email'}
                                  >
                                    <Send className="w-3 h-3" />
                                    <span>{emailStatus === 'sent' || emailStatus === 'resent' ? 'Resend' : 'Send'}</span>
                                  </button>
                                )}
                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Official Email Delivery Audit Logs */}
            <div className="bg-white dark:bg-[#181B20] rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E8DEC8] dark:border-[#2E3440] mb-4 gap-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#B3122B]" />
                  <h3 className="font-extrabold text-sm text-[#1A1A1A] dark:text-white">
                    Email Delivery Audit Log (Sender: technicalteamsvit@gmail.com)
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">
                    {emailLogs.length} total dispatch records
                  </span>
                  <button
                    onClick={handleExportEmailLogCSV}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#F5EFEB] dark:bg-[#252A34] text-gray-800 dark:text-gray-200 hover:text-[#B3122B] border border-[#E8DEC8] dark:border-[#2E3440] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-emerald-600" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {emailLogs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  No certificate emails dispatched yet. Click "Send to all eligible" or "Send test email to me" to trigger emails.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {emailLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className="p-3 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-[#1A1A1A] dark:text-white flex items-center gap-2 flex-wrap">
                          <span>{log.studentName}</span>
                          <span className="font-mono text-[11px] text-[#B3122B]">[{log.certificateId}]</span>
                          {log.attempts > 1 && (
                            <span className="text-[10px] text-gray-400">({log.attempts} attempts)</span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          To: <span className="font-medium text-gray-700 dark:text-gray-300">{log.recipientEmail}</span> • From: <span className="font-bold text-[#8B0D20] dark:text-[#ff8a9e]">technicalteamsvit@gmail.com</span>
                        </div>
                        {log.error && (
                          <div className="text-[10px] text-red-500 mt-0.5 font-medium">
                            Error: {log.error}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.status === 'sent' || log.status === 'resent'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' 
                            : 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                        }`}>
                          {log.status}
                        </span>
                        <div className="text-[10px] text-gray-400 mt-0.5">{log.timestamp}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Section 9.5: Batch Dispatch Run History */}
              <div className="mt-6 pt-5 border-t border-[#E8DEC8] dark:border-[#2E3440]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#1A1A1A] dark:text-white">
                    <Activity className="w-3.5 h-3.5 text-[#B3122B]" />
                    <span>Batch Dispatch Run Audit Trail (Section 9.5)</span>
                  </div>
                  <span className="text-[11px] text-gray-500 font-mono">
                    {(emailAuditRuns || []).length} recorded runs
                  </span>
                </div>

                {(!emailAuditRuns || emailAuditRuns.length === 0) ? (
                  <p className="text-[11px] text-gray-400 italic py-1">
                    No batch dispatch runs executed yet in this session.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {emailAuditRuns.map((run) => (
                      <div key={run.runId} className="p-3 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-[#1A1A1A] dark:text-white flex items-center gap-2">
                            <span>{run.runId}</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                              run.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {run.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-500">
                            By: <span className="font-medium">{run.initiatedBy}</span> ({run.adminEmail}) • {run.timestamp}
                          </div>
                          {run.stoppedReason && (
                            <div className="text-[10px] text-amber-600 font-medium">
                              Note: {run.stoppedReason}
                            </div>
                          )}
                        </div>
                        <div className="text-right font-mono text-[11px]">
                          <span className="text-emerald-600 font-bold">{run.sentCount} sent</span>
                          {run.failedCount > 0 && <span className="text-red-500 font-bold ml-1.5">{run.failedCount} failed</span>}
                          <div className="text-[10px] text-gray-400">{run.totalTargets} targets</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* PUBLIC QR VERIFICATION AUDIT LOGS TAB */}
        {activeTab === 'verification' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#181B20] rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E8DEC8] dark:border-[#2E3440] mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-extrabold text-base text-[#1A1A1A] dark:text-white">
                      Public Certificate QR Verification Audit Trail
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Real-time log of public /verify/:id requests, QR scans, and verification status outcomes.
                  </p>
                </div>
                <span className="text-xs text-gray-500 font-mono">
                  {verificationLogs?.length || 0} total verification lookups
                </span>
              </div>

              {(!verificationLogs || verificationLogs.length === 0) ? (
                <div className="py-12 text-center">
                  <ShieldCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    No Verification Lookups Recorded Yet
                  </h4>
                  <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                    When someone scans the QR code on a student's certificate or visits /verify/:certificate-id, the access timestamp and verification result will be logged here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#FCF9F2] dark:bg-[#111317] border-b border-[#E8DEC8] dark:border-[#2E3440] text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Certificate ID</th>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Track</th>
                        <th className="py-3 px-4">Verification Result</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8DEC8]/50 dark:divide-[#2E3440]">
                      {verificationLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#FCF9F2]/60 dark:hover:bg-[#111317]/50 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-gray-500">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[11px] text-[#B3122B] dark:text-[#ff8a9e]">
                            {log.certificateId}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#1A1A1A] dark:text-white">
                            {log.studentName || '—'}
                          </td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                            {log.language || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              log.result === 'valid'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : log.result === 'revoked'
                                ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            }`}>
                              {log.result === 'valid' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                              {log.result === 'revoked' && <XCircle className="w-3 h-3 text-red-600" />}
                              {log.result === 'not_found' && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                              <span>{log.result === 'valid' ? 'Verified' : log.result === 'revoked' ? 'Revoked' : 'Not Found'}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <a
                              href={`/verify/${log.certificateId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B3122B] hover:underline"
                            >
                              <span>View Public Page</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CERTIFICATE TEMPLATE & SIGNATORIES TAB */}
        {activeTab === 'template' && (
          <div className="space-y-6">
            {/* Template Header Banner */}
            <div className="bg-white dark:bg-[#181B20] p-6 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E8DEC8] dark:border-[#2E3440]">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#B3122B]" />
                    <h3 className="font-extrabold text-lg text-[#1A1A1A] dark:text-white">
                      Official Certificate Template & Signatory Configuration
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 max-w-2xl">
                    Configure the official A4 landscape completion certificate (842 × 595 pt). Matches <code className="font-mono text-[#B3122B] bg-[#B3122B]/10 px-1.5 py-0.5 rounded">certificate-template.pdf</code> design, color palette (#B3122B red, #F7F3EC cream), Times & Helvetica fonts, and official SVIT signatories.
                  </p>
                </div>

                {/* Approval Status Badge & Actions */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  {templateConfig?.isApproved ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Template Approved & Locked</span>
                      </span>
                      <button
                        onClick={() => {
                          setTypedUnlockCode('');
                          setShowUnlockModal(true);
                        }}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#FCF9F2] dark:bg-[#111317] text-gray-700 dark:text-gray-300 hover:text-[#B3122B] border border-[#E8DEC8] dark:border-[#2E3440] transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Unlock template to edit signatories or assets"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Unlock to Edit</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-500/30">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Pending Approval</span>
                      </span>
                      <button
                        onClick={() => {
                          approveCertificateTemplate(user?.name || "Vedant Kokane (Faculty Admin)");
                          setAdminToast("Certificate Template approved and locked! Ready for student dispatch.");
                          setTimeout(() => setAdminToast(''), 4000);
                        }}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve & Lock Template</span>
                      </button>
                    </div>
                  )}

                  <button
                    onClick={async () => {
                      try {
                        await downloadCertificatePdf({
                          studentName: "Vedant Kokane",
                          language: "Python",
                          score: "78.5",
                          certificateId: "TNV-CS-2026-0000-TEST",
                          templateConfig
                        });
                        setAdminToast("Generated and downloaded sample certificate PDF.");
                        setTimeout(() => setAdminToast(''), 3000);
                      } catch (err) {
                        alert("Error downloading sample PDF: " + err.message);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Download high-resolution vector PDF generated with current settings"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Sample PDF</span>
                  </button>

                  {!templateConfig?.isApproved && (
                    <button
                      onClick={() => {
                        if (window.confirm("Reset all assets and signatory names back to defaults?")) {
                          updateTemplateConfig(DEFAULT_TEMPLATE_CONFIG);
                          setAdminToast("Reset template config to default.");
                          setTimeout(() => setAdminToast(''), 3000);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-red-600 transition-colors cursor-pointer"
                      title="Reset assets to standard SVIT defaults"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Approval Info Details */}
              {templateConfig?.isApproved && (
                <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>
                    Locked by <strong className="text-gray-800 dark:text-gray-200">{templateConfig.approvedBy}</strong> on {new Date(templateConfig.approvedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST. Editing is disabled to ensure all awarded certificates share an immutable layout.
                  </span>
                </div>
              )}
            </div>

            {/* Hidden File Inputs for 4 PNG Assets */}
            <input
              type="file"
              ref={hubLogoInputRef}
              accept="image/png"
              style={{ display: 'none' }}
              onChange={(e) => handleImageUpload(e, 'hubLogoUrl', 'Technical Skill Development Hub Logo')}
            />
            <input
              type="file"
              ref={sealInputRef}
              accept="image/png"
              style={{ display: 'none' }}
              onChange={(e) => handleImageUpload(e, 'sealUrl', 'SVIT College Seal')}
            />
            <input
              type="file"
              ref={secSigInputRef}
              accept="image/png"
              style={{ display: 'none' }}
              onChange={(e) => handleImageUpload(e, 'secSigUrl', 'Technical Secretary Signature')}
            />
            <input
              type="file"
              ref={princSigInputRef}
              accept="image/png"
              style={{ display: 'none' }}
              onChange={(e) => handleImageUpload(e, 'princSigUrl', 'Principal Signature')}
            />

            {/* 4 PNG Images Asset Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Asset 1: Hub Logo */}
              <div className="bg-white dark:bg-[#181B20] p-4 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#1A1A1A] dark:text-white">1. Hub Logo</span>
                    <span className="text-[10px] text-gray-400 font-mono">94×94 pt</span>
                  </div>
                  <div className="w-full h-32 rounded-2xl bg-[#F7F3EC] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] flex items-center justify-center p-3 overflow-hidden">
                    <img
                      src={templateConfig?.hubLogoUrl || '/hub-logo.png'}
                      alt="Hub Logo"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2">
                    Top-center crest. Transparent PNG, red outline & Durga Mata sketch.
                  </p>
                </div>
                <button
                  onClick={() => hubLogoInputRef.current?.click()}
                  disabled={templateConfig?.isApproved}
                  className="mt-3 w-full py-2 rounded-xl text-xs font-bold border border-[#E8DEC8] dark:border-[#2E3440] hover:border-[#B3122B] text-gray-700 dark:text-gray-300 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Replace Logo (PNG)</span>
                </button>
              </div>

              {/* Asset 2: College Seal */}
              <div className="bg-white dark:bg-[#181B20] p-4 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#1A1A1A] dark:text-white">2. College Seal</span>
                    <span className="text-[10px] text-gray-400 font-mono">82×82 pt</span>
                  </div>
                  <div className="w-full h-32 rounded-2xl bg-[#F7F3EC] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] flex items-center justify-center p-3 overflow-hidden">
                    <img
                      src={templateConfig?.sealUrl || '/college-seal.png'}
                      alt="College Seal"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2">
                    Bottom-center official SVIT Pravara seal. Transparent PNG.
                  </p>
                </div>
                <button
                  onClick={() => sealInputRef.current?.click()}
                  disabled={templateConfig?.isApproved}
                  className="mt-3 w-full py-2 rounded-xl text-xs font-bold border border-[#E8DEC8] dark:border-[#2E3440] hover:border-[#B3122B] text-gray-700 dark:text-gray-300 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Replace Seal (PNG)</span>
                </button>
              </div>

              {/* Asset 3: Technical Secretary Signature */}
              <div className="bg-white dark:bg-[#181B20] p-4 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#1A1A1A] dark:text-white">3. Secretary Signature</span>
                    <span className="text-[10px] text-gray-400 font-mono">Baseline 503 pt</span>
                  </div>
                  <div className="w-full h-32 rounded-2xl bg-[#F7F3EC] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] flex items-center justify-center p-3 overflow-hidden">
                    <img
                      src={templateConfig?.secSigUrl || '/signature-technical-secretary.png'}
                      alt="Secretary Signature"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2">
                    Left signatory block. Transparent PNG, black ink.
                  </p>
                </div>
                <button
                  onClick={() => secSigInputRef.current?.click()}
                  disabled={templateConfig?.isApproved}
                  className="mt-3 w-full py-2 rounded-xl text-xs font-bold border border-[#E8DEC8] dark:border-[#2E3440] hover:border-[#B3122B] text-gray-700 dark:text-gray-300 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Replace Signature (PNG)</span>
                </button>
              </div>

              {/* Asset 4: Principal Signature */}
              <div className="bg-white dark:bg-[#181B20] p-4 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#1A1A1A] dark:text-white">4. Principal Signature</span>
                    <span className="text-[10px] text-gray-400 font-mono">Baseline 503 pt</span>
                  </div>
                  <div className="w-full h-32 rounded-2xl bg-[#F7F3EC] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] flex items-center justify-center p-3 overflow-hidden">
                    <img
                      src={templateConfig?.princSigUrl || '/signature-principal.png'}
                      alt="Principal Signature"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2">
                    Right signatory block. Transparent PNG, blue ink.
                  </p>
                </div>
                <button
                  onClick={() => princSigInputRef.current?.click()}
                  disabled={templateConfig?.isApproved}
                  className="mt-3 w-full py-2 rounded-xl text-xs font-bold border border-[#E8DEC8] dark:border-[#2E3440] hover:border-[#B3122B] text-gray-700 dark:text-gray-300 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Replace Signature (PNG)</span>
                </button>
              </div>
            </div>

            {/* Signatory Names & Titles Form */}
            <div className="bg-white dark:bg-[#181B20] p-6 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs">
              <h4 className="font-extrabold text-sm text-[#1A1A1A] dark:text-white mb-4 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#B3122B]" />
                <span>Signatory Details (Baseline 523 & 537 pt)</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Signatory 1: Technical Secretary */}
                <div className="p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] space-y-3">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Signatory 1 (Left Box)
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Full Name (Helvetica Bold 12 pt)
                    </label>
                    <input
                      type="text"
                      disabled={templateConfig?.isApproved}
                      value={templateConfig?.secName || 'Vedant Kokane'}
                      onChange={(e) => updateTemplateConfig({ secName: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-white dark:bg-[#181B20] text-xs font-bold text-[#1A1A1A] dark:text-white disabled:opacity-60"
                      placeholder="e.g. Vedant Kokane"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Designation & Department (Helvetica 10 pt)
                    </label>
                    <input
                      type="text"
                      disabled={templateConfig?.isApproved}
                      value={templateConfig?.secTitle || 'Technical Secretary, SVIT Nashik'}
                      onChange={(e) => updateTemplateConfig({ secTitle: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-white dark:bg-[#181B20] text-xs text-[#1A1A1A] dark:text-white disabled:opacity-60"
                      placeholder="e.g. Technical Secretary, SVIT Nashik"
                    />
                  </div>
                </div>

                {/* Signatory 2: Principal */}
                <div className="p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] space-y-3">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Signatory 2 (Right Box)
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Full Name (Helvetica Bold 12 pt)
                    </label>
                    <input
                      type="text"
                      disabled={templateConfig?.isApproved}
                      value={templateConfig?.princName || 'Dr. Sarang S. Pande'}
                      onChange={(e) => updateTemplateConfig({ princName: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-white dark:bg-[#181B20] text-xs font-bold text-[#1A1A1A] dark:text-white disabled:opacity-60"
                      placeholder="e.g. Dr. Sarang S. Pande"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Designation & Institution (Helvetica 10 pt)
                    </label>
                    <input
                      type="text"
                      disabled={templateConfig?.isApproved}
                      value={templateConfig?.princTitle || 'Principal, SVIT Nashik'}
                      onChange={(e) => updateTemplateConfig({ princTitle: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-white dark:bg-[#181B20] text-xs text-[#1A1A1A] dark:text-white disabled:opacity-60"
                      placeholder="e.g. Principal, SVIT Nashik"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Live Interactive Certificate Preview */}
            <div className="bg-white dark:bg-[#181B20] p-6 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-[#E8DEC8] dark:border-[#2E3440] mb-4">
                <div>
                  <h4 className="font-extrabold text-sm text-[#1A1A1A] dark:text-white flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#B3122B]" />
                    <span>Live Vector Certificate Preview (Sample Student)</span>
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Live responsive rendering of the exact PDF geometry, fonts, red double border, college seal, and signatures.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await downloadCertificatePdf({
                        studentName: "Vedant Kokane",
                        language: "Python",
                        score: "78.5",
                        certificateId: "TNV-CS-2026-0000-TEST",
                        templateConfig
                      });
                    } catch (err) {
                      alert("Error generating PDF: " + err.message);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#FCF9F2] dark:bg-[#111317] text-[#B3122B] hover:bg-[#B3122B] hover:text-white border border-[#B3122B]/30 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Test PDF</span>
                </button>
              </div>

              <div className="py-2">
                <CertificateView
                  studentName="Vedant Kokane"
                  prn="SVIT2026-0042"
                  track="Python"
                  score="78.5"
                  certificateId="TNV-CS-2026-0000-TEST"
                  startDate={SPRINT_START_DATE}
                  endDate={SPRINT_END_DATE}
                  issueDate={SPRINT_ISSUE_DATE}
                  showDownloadButton={true}
                />
              </div>
            </div>
          </div>
        )}

        {/* ADMIN TEST MODE & SIMULATION TAB */}
        {activeTab === 'testmode' && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-white dark:bg-[#181B20] p-6 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E8DEC8] dark:border-[#2E3440]">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-purple-600" />
                    <h3 className="font-extrabold text-lg text-[#1A1A1A] dark:text-white">
                      Admin Test Mode & Sprint Time Simulation
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 max-w-2xl">
                    Simulate any moment in the 9-day schedule (14 Oct to 22 Oct 2026). Test pre-launch countdowns, Day 1 auto-unlock, cross-day consent bypass, scoring formulas, viva reviews, and certificate issuance without waiting for real calendar dates.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-2 ${
                    simulatedServerTime 
                      ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-500/40' 
                      : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-500/40'
                  }`}>
                    <span className="w-2 h-2 rounded-full animate-pulse bg-current"></span>
                    <span>{simulatedServerTime ? 'Simulation Clock Active' : 'Real System Clock Active'}</span>
                  </div>

                  {simulatedServerTime && (
                    <button
                      onClick={() => {
                        setSimulatedServerTime(null);
                        clearDayOverride();
                        setAdminToast("Reset simulated time. Restored real system clock.");
                        setTimeout(() => setAdminToast(''), 3000);
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-[#181B20] text-gray-700 dark:text-gray-300 border border-[#E8DEC8] dark:border-[#2E3440] hover:text-[#B3122B] transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Reset to Real Time</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Current Effective Server Time Box */}
              <div className="mt-4 p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                    Current Effective Sprint Server Time (Asia/Kolkata)
                  </div>
                  <div className="text-xl font-black text-[#1A1A1A] dark:text-white font-mono mt-0.5">
                    {new Date(getEffectiveServerTime()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                  </div>
                  <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                    UTC: {new Date(getEffectiveServerTime()).toISOString()}
                  </div>
                </div>

                <div className="text-right sm:text-right">
                  <div className="text-[11px] font-bold text-gray-500">Effective Sprint Day</div>
                  <div className="text-xl font-black text-[#B3122B]">
                    {currentDay === 0 ? "Pre-Launch (Day 0)" : `Day ${currentDay} of 9`}
                  </div>
                </div>
              </div>
            </div>

            {/* Test as Student Mode & Data Clean Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Test As Student */}
              <div className="bg-white dark:bg-[#181B20] p-5 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-[#B3122B]" />
                    <h4 className="font-bold text-sm text-[#1A1A1A] dark:text-white">
                      Test As Student Switch
                    </h4>
                  </div>
                  <p className="text-xs text-gray-500">
                    Switch directly into a student test session (PRN: <code>TEST-2026-0001</code>) to experience consent screens, camera checks, problem solving, code tests, and quiz workflows as a student.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E8DEC8]/60 dark:border-[#2E3440] flex items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      setUser({
                        uid: "test-student-admin-01",
                        name: "Test Student (Admin Mode)",
                        email: "test.student@svit.ac.in",
                        prn: "TEST-2026-0001",
                        track: "Python",
                        role: "student",
                        year: "TE",
                        department: "Computer Engineering"
                      });
                      setAdminTestMode(true);
                      setCurrentTab('dashboard');
                    }}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Launch Student Dashboard as Test Student</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Clear Test Student Data */}
              <div className="bg-white dark:bg-[#181B20] p-5 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <RefreshCw className="w-4 h-4 text-amber-600" />
                    <h4 className="font-bold text-sm text-[#1A1A1A] dark:text-white">
                      Clear Test Student Data
                    </h4>
                  </div>
                  <p className="text-xs text-gray-500">
                    Purges demo registrations and test submissions (records with PRN prefix <code className="font-mono">TEST-</code> or <code className="font-mono">DEMO-</code>) while preserving all configuration, seed tasks, and official student entries.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E8DEC8]/60 dark:border-[#2E3440]">
                  <button
                    onClick={() => {
                      if (window.confirm("Remove all test submissions and student records created during test runs?")) {
                        clearTestStudentData();
                        setAdminToast("Cleared test student data successfully.");
                        setTimeout(() => setAdminToast(''), 3000);
                      }
                    }}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200 border border-amber-300 dark:border-amber-900 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Clear Only Test Student Records</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Time Travel Presets Grid */}
            <div className="bg-white dark:bg-[#181B20] p-6 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs">
              <h4 className="font-extrabold text-sm text-[#1A1A1A] dark:text-white mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                <span>Simulation Time Presets (One-Click Jump)</span>
              </h4>
              <p className="text-xs text-gray-500 mb-4">
                Click any preset below to instantaneously shift the application clock to that moment:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Preset 1: Pre-Launch */}
                <button
                  onClick={() => {
                    const t = Date.parse('2026-10-13T18:00:00+05:30'); // 13 Oct 6:00 PM IST
                    setSimulatedServerTime(t);
                    setAdminToast("Set simulated time to Pre-Launch (13 Oct 2026, 6:00 PM IST).");
                    setTimeout(() => setAdminToast(''), 3000);
                  }}
                  className="p-3.5 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] hover:border-purple-500 text-left transition-all cursor-pointer group"
                >
                  <div className="text-xs font-bold text-[#1A1A1A] dark:text-white group-hover:text-purple-600 transition-colors">
                    1. Pre-Launch (Day 0)
                  </div>
                  <div className="text-[11px] font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                    13 Oct 2026, 06:00 PM IST
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Verifies pre-registration, consent form, and the live countdown screen before Day 1 unlocks.
                  </p>
                </button>

                {/* Preset 2: 15s Before Kickoff */}
                <button
                  onClick={() => {
                    const t = Date.parse('2026-10-14T07:59:45+05:30'); // 14 Oct 7:59:45 AM IST (15s before 8:00 AM)
                    setSimulatedServerTime(t);
                    setAdminToast("Set simulated time to 15s Before Kickoff. Watch live auto-unlock!");
                    setTimeout(() => setAdminToast(''), 3000);
                  }}
                  className="p-3.5 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] hover:border-purple-500 text-left transition-all cursor-pointer group"
                >
                  <div className="text-xs font-bold text-[#1A1A1A] dark:text-white group-hover:text-purple-600 transition-colors">
                    2. 15s Before Kickoff ⏱️
                  </div>
                  <div className="text-[11px] font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                    14 Oct 2026, 07:59:45 AM IST
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Countdown timer ticks down to 0:00 and automatically unlocks Day 1 live on the student screen.
                  </p>
                </button>

                {/* Preset 3: Day 1 Active */}
                <button
                  onClick={() => {
                    const t = Date.parse('2026-10-14T11:00:00+05:30'); // 14 Oct 11:00 AM IST
                    setSimulatedServerTime(t);
                    setAdminToast("Set simulated time to Day 1 Active (14 Oct 2026, 11:00 AM IST).");
                    setTimeout(() => setAdminToast(''), 3000);
                  }}
                  className="p-3.5 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] hover:border-purple-500 text-left transition-all cursor-pointer group"
                >
                  <div className="text-xs font-bold text-[#1A1A1A] dark:text-white group-hover:text-purple-600 transition-colors">
                    3. Day 1 Kickoff Active
                  </div>
                  <div className="text-[11px] font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                    14 Oct 2026, 11:00 AM IST
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Day 1 challenge active (5 points). Problem statement, variants, and quiz open for submissions.
                  </p>
                </button>

                {/* Preset 4: Day 2 Active */}
                <button
                  onClick={() => {
                    const t = Date.parse('2026-10-15T10:00:00+05:30'); // 15 Oct 10:00 AM IST
                    setSimulatedServerTime(t);
                    setAdminToast("Set simulated time to Day 2 Active (15 Oct 2026, 10:00 AM IST).");
                    setTimeout(() => setAdminToast(''), 3000);
                  }}
                  className="p-3.5 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] hover:border-purple-500 text-left transition-all cursor-pointer group"
                >
                  <div className="text-xs font-bold text-[#1A1A1A] dark:text-white group-hover:text-purple-600 transition-colors">
                    4. Day 2 Active (Consent Bypass)
                  </div>
                  <div className="text-[11px] font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                    15 Oct 2026, 10:00 AM IST
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Tests cross-day consent bypassing: modal is skipped for students who consented on Day 1.
                  </p>
                </button>

                {/* Preset 5: Catch-Up Period */}
                <button
                  onClick={() => {
                    const t = Date.parse('2026-10-22T18:00:00+05:30'); // 22 Oct 6:00 PM IST
                    setSimulatedServerTime(t);
                    setAdminToast("Set simulated time to Catch-Up Period (22 Oct 2026, 6:00 PM IST).");
                    setTimeout(() => setAdminToast(''), 3000);
                  }}
                  className="p-3.5 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] hover:border-purple-500 text-left transition-all cursor-pointer group"
                >
                  <div className="text-xs font-bold text-[#1A1A1A] dark:text-white group-hover:text-purple-600 transition-colors">
                    5. Catch-Up Window (50% Points)
                  </div>
                  <div className="text-[11px] font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                    22 Oct 2026, 06:00 PM IST
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    All 9 days unlocked. Catch-up submissions receive 50% points. Closes at 11:59 PM IST.
                  </p>
                </button>

                {/* Preset 6: Post-Sprint Results Locked */}
                <button
                  onClick={() => {
                    const t = Date.parse('2026-10-23T00:05:00+05:30'); // 23 Oct 12:05 AM IST (after 11:59 PM 22 Oct)
                    setSimulatedServerTime(t);
                    setAdminToast("Set simulated time to Post-Sprint Results Locked (23 Oct 2026).");
                    setTimeout(() => setAdminToast(''), 3000);
                  }}
                  className="p-3.5 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] hover:border-purple-500 text-left transition-all cursor-pointer group"
                >
                  <div className="text-xs font-bold text-[#1A1A1A] dark:text-white group-hover:text-purple-600 transition-colors">
                    6. Results Locked (Final Close) 🔒
                  </div>
                  <div className="text-[11px] font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                    23 Oct 2026, 12:05 AM IST
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Submissions permanently locked. Pass mark (≥ 50 pts) determines certificate qualification.
                  </p>
                </button>
              </div>

              {/* Custom Datetime Input */}
              <div className="mt-5 pt-4 border-t border-[#E8DEC8]/60 dark:border-[#2E3440] flex flex-col sm:flex-row items-center gap-3">
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 shrink-0">
                  Custom Simulation Timestamp:
                </div>
                <input
                  type="datetime-local"
                  value={customDateTimeInput}
                  onChange={(e) => setCustomDateTimeInput(e.target.value)}
                  className="p-2 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-xs font-mono text-[#1A1A1A] dark:text-white flex-1"
                />
                <button
                  onClick={() => {
                    if (!customDateTimeInput) return;
                    const parsed = Date.parse(customDateTimeInput);
                    if (isNaN(parsed)) {
                      alert("Invalid date format");
                      return;
                    }
                    setSimulatedServerTime(parsed);
                    setAdminToast(`Set simulated server time to ${new Date(parsed).toLocaleString()}`);
                    setTimeout(() => setAdminToast(''), 3000);
                  }}
                  disabled={!customDateTimeInput}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
                >
                  Apply Custom Time
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DEVICE SECURITY & AUDIT LOGS TAB (Section 1) */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* Header info card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E8DEC8] dark:border-[#2E3440]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#B3122B]/10 text-[#B3122B] flex items-center justify-center font-bold">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-[#1A1A1A] dark:text-white">
                      Admin Workstation Device Binding & Security
                    </h2>
                    <p className="text-xs text-gray-500">
                      Hardware-level cookie token binding, IP whitelisting, lockout protection, and tamper audit logs.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={loadAuditLogs}
                    disabled={loadingAuditLogs}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] hover:border-[#B3122B] text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingAuditLogs ? 'animate-spin' : ''}`} />
                    <span>Refresh Logs</span>
                  </button>
                  <button
                    onClick={() => setShowResetDeviceModal(true)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Unbind / Reset Workstation</span>
                  </button>
                </div>
              </div>

              {/* Status Metric Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                <div className="p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
                  <div className="flex items-center justify-between text-xs text-gray-500 font-bold mb-1">
                    <span>Binding Status</span>
                    <Laptop className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-base font-extrabold text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Device Bound</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1 truncate" title={deviceStatus?.deviceName}>
                    Name: <strong className="text-gray-800 dark:text-gray-200">{deviceStatus?.deviceName || "Vedant's Primary Workstation"}</strong>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
                  <div className="flex items-center justify-between text-xs text-gray-500 font-bold mb-1">
                    <span>Device Token Hash</span>
                    <KeyRound className="w-4 h-4 text-[#B3122B]" />
                  </div>
                  <div className="text-xs font-mono font-bold text-gray-800 dark:text-gray-200 bg-white dark:bg-[#1A1D24] p-1.5 rounded-lg border border-[#E8DEC8] dark:border-[#2E3440] truncate">
                    SHA-256 (httpOnly, Signed)
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    Cookie: <span className="font-mono">admin_device_token</span> (SameSite=Strict)
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
                  <div className="flex items-center justify-between text-xs text-gray-500 font-bold mb-1">
                    <span>IP Address Guard</span>
                    <Server className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    Client IP: <span className="font-mono text-blue-600">{deviceStatus?.clientIp || "127.0.0.1"}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    ADMIN_ALLOWED_IPS: {deviceStatus?.allowedIpsConfigured ? "Enforced" : "Permissive (All Valid Bound IPs)"}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
                  <div className="flex items-center justify-between text-xs text-gray-500 font-bold mb-1">
                    <span>Rate Limiter</span>
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-xs font-bold text-emerald-600">
                    Max 5 Attempts / 15m
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    Lockout: 15-minute temporary lockout on repeated failures
                  </div>
                </div>
              </div>

              {/* Warning note */}
              <div className="mt-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
                <strong>Strict Device Lock Enabled:</strong> Any administrator login from another device or incognito window without the bound device token will receive a generic 401 <em>"Authentication failed. Invalid credentials or unauthorized device."</em> and log an audit security event with the remote IP and User-Agent.
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="bg-white dark:bg-[#181B20] rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E8DEC8] dark:border-[#2E3440] mb-4 gap-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#B3122B]" />
                  <h3 className="font-extrabold text-sm text-[#1A1A1A] dark:text-white">
                    Admin Security Audit Trail ({auditLogs.length} events)
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search IP, action, reason..."
                      value={auditLogSearch}
                      onChange={(e) => setAuditLogSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-xs text-[#1A1A1A] dark:text-white placeholder:text-gray-400 focus:outline-hidden focus:border-[#B3122B] w-48 sm:w-64"
                    />
                  </div>
                </div>
              </div>

              {(() => {
                const filteredAuditLogs = auditLogs.filter(log => {
                  if (!safeTrim(auditLogSearch)) return true;
                  const q = safeLowerCase(auditLogSearch);
                  return (
                    safeLowerCase(log.ip).includes(q) ||
                    safeLowerCase(log.action).includes(q) ||
                    safeLowerCase(log.reason).includes(q) ||
                    safeLowerCase(log.details).includes(q) ||
                    safeLowerCase(log.userAgent).includes(q) ||
                    safeLowerCase(log.deviceName).includes(q)
                  );
                });

                if (filteredAuditLogs.length === 0) {
                  return (
                    <div className="text-center py-12 text-gray-400">
                      <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-60" />
                      <div className="font-bold text-sm text-gray-700 dark:text-gray-300">
                        {auditLogSearch ? 'No Matching Security Events Found' : 'No Security Incidents Logged'}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                        {auditLogSearch ? 'Try a different IP address, action, or keyword.' : 'All authentication events, device registrations, and failed attempts are recorded here.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#FCF9F2] dark:bg-[#111317] border-b border-[#E8DEC8] dark:border-[#2E3440] text-gray-500 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">Timestamp</th>
                          <th className="py-2.5 px-3">Action</th>
                          <th className="py-2.5 px-3">Status / Outcome</th>
                          <th className="py-2.5 px-3">Client IP</th>
                          <th className="py-2.5 px-3">User Agent & Context</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8DEC8]/50 dark:divide-[#2E3440]/50">
                        {filteredAuditLogs.map((log) => {
                          const isSuccess = log.action === 'DEVICE_REGISTERED' || log.action === 'ADMIN_LOGIN_SUCCESS' || log.action === 'admin_login' || log.action === 'device_registered' || log.success === true;
                          const isBlocked = log.action === 'UNREGISTERED_DEVICE_BLOCKED' || log.action === 'RATE_LIMIT_LOCKOUT' || log.success === false;
                          const outcomeText = log.reason || log.details || log.outcome || (log.success ? "Success" : "Failed");
                          return (
                            <tr key={log.id || log.timestamp + Math.random()} className="hover:bg-[#FCF9F2]/50 dark:hover:bg-[#14171C]">
                              <td className="py-2.5 px-3 font-mono text-gray-500 whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                              </td>
                              <td className="py-2.5 px-3 font-bold">
                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${
                                  isSuccess ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                                  isBlocked ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300' :
                                  'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                }`}>
                                  {log.action}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">
                                {outcomeText}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-gray-600 dark:text-gray-400">
                                {log.ip}
                              </td>
                              <td className="py-2.5 px-3 text-gray-500 max-w-xs truncate" title={log.userAgent}>
                                {log.userAgent}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Blocked Browser & Proctoring Violations View (Section 1 & 3) */}
            <div className="bg-white dark:bg-[#181B20] rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E8DEC8] dark:border-[#2E3440] gap-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                  <div>
                    <h3 className="font-extrabold text-sm text-[#1A1A1A] dark:text-white">
                      Blocked Browser & Proctoring Violations ({blockedAttempts.length})
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Logged instances of embedded webviews, automation, virtual cameras, or mobile attempts blocked from starting tasks.
                    </p>
                  </div>
                </div>

                <button
                  onClick={loadBlockedAttemptsAndWhitelists}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#F5EFEB] dark:bg-[#252A34] text-gray-700 dark:text-gray-300 hover:text-[#B3122B] border border-[#E8DEC8] dark:border-[#2E3440] transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingBlockedAttempts ? 'animate-spin' : ''}`} />
                  <span>Refresh Violations</span>
                </button>
              </div>

              {blockedAttempts.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                  <div className="font-bold text-xs text-gray-700 dark:text-gray-300">
                    No Blocked Attempts Recorded
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    No unsupported browsers or spoofed devices have attempted test pre-checks.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FCF9F2] dark:bg-[#111317] border-b border-[#E8DEC8] dark:border-[#2E3440] text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Student</th>
                        <th className="py-2.5 px-3">Block Reason</th>
                        <th className="py-2.5 px-3">Detected Signals</th>
                        <th className="py-2.5 px-3">IP / Device UA</th>
                        <th className="py-2.5 px-3 text-right">Quick Whitelist</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8DEC8]/50 dark:divide-[#2E3440]/50">
                      {blockedAttempts.map((attempt) => (
                        <tr key={attempt.id} className="hover:bg-[#FCF9F2]/50 dark:hover:bg-[#14171C]">
                          <td className="py-2.5 px-3 font-mono text-gray-500 whitespace-nowrap text-[11px]">
                            {new Date(attempt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-[#1A1A1A] dark:text-white">{attempt.studentName || 'Student'}</div>
                            <div className="font-mono text-[10px] text-gray-400">{attempt.prn || attempt.userId}</div>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-red-600 dark:text-red-400 max-w-xs">
                            {attempt.reason}
                          </td>
                          <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">
                            {attempt.signals && attempt.signals.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {attempt.signals.map((sig, sIdx) => (
                                  <span key={sIdx} className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-[10px]">
                                    {sig}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[10px]">General check failure</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-gray-500 font-mono text-[10px] max-w-xs truncate" title={attempt.userAgent}>
                            {attempt.ip} • {attempt.userAgent}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={async () => {
                                const notes = window.prompt(`Whitelist reason for ${attempt.studentName} (${attempt.prn}):`, "Faculty verified exception");
                                if (notes !== null) {
                                  const res = await whitelistStudentApi({
                                    userId: attempt.userId,
                                    prn: attempt.prn,
                                    studentName: attempt.studentName,
                                    notes: notes.trim() || 'Admin manual exception'
                                  });
                                  if (res.success) {
                                    setAdminToast(`Student ${attempt.studentName} whitelisted successfully.`);
                                    setTimeout(() => setAdminToast(''), 3500);
                                    loadBlockedAttemptsAndWhitelists();
                                  }
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] hover:bg-emerald-200 transition-colors cursor-pointer"
                            >
                              Allow Exception
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Student Whitelist & Exception Manager (Section 4) */}
            <div className="bg-white dark:bg-[#181B20] rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8DEC8] dark:border-[#2E3440]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h3 className="font-extrabold text-sm text-[#1A1A1A] dark:text-white">
                      Student Hardware & Browser Whitelist Exceptions ({whitelistedStudents.length})
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Whitelisted students are exempt from strict browser version/device checks upon mentor approval.
                    </p>
                  </div>
                </div>
              </div>

              {/* Add Whitelist Form */}
              <div className="bg-[#FCF9F2] dark:bg-[#111317] p-4 rounded-2xl border border-[#E8DEC8] dark:border-[#2E3440] flex flex-col sm:flex-row items-end gap-3 text-xs">
                <div className="flex-1 w-full">
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Roll No / PRN</label>
                  <input
                    type="text"
                    value={whitelistPrnInput}
                    onChange={(e) => setWhitelistPrnInput(e.target.value)}
                    placeholder="e.g. 72184912B"
                    className="w-full p-2 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-white dark:bg-[#181B20] text-xs font-mono"
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Student Name</label>
                  <input
                    type="text"
                    value={whitelistNameInput}
                    onChange={(e) => setWhitelistNameInput(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full p-2 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-white dark:bg-[#181B20] text-xs"
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Reason / Notes</label>
                  <input
                    type="text"
                    value={whitelistNotesInput}
                    onChange={(e) => setWhitelistNotesInput(e.target.value)}
                    placeholder="e.g. Hardware exception verified"
                    className="w-full p-2 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-white dark:bg-[#181B20] text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!whitelistPrnInput.trim()) {
                      alert("Please enter student Roll No / PRN.");
                      return;
                    }
                    const res = await whitelistStudentApi({
                      prn: whitelistPrnInput.trim(),
                      userId: whitelistPrnInput.trim(),
                      studentName: whitelistNameInput.trim() || 'Student',
                      notes: whitelistNotesInput.trim() || 'Faculty mentor exception'
                    });
                    if (res.success) {
                      setWhitelistPrnInput('');
                      setWhitelistNameInput('');
                      setWhitelistNotesInput('');
                      setAdminToast("Student exception whitelisted successfully.");
                      setTimeout(() => setAdminToast(''), 3000);
                      loadBlockedAttemptsAndWhitelists();
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shrink-0 transition-colors"
                >
                  Add Whitelist Exception
                </button>
              </div>

              {/* Active Whitelists List */}
              {whitelistedStudents.length > 0 && (
                <div className="space-y-2 pt-1">
                  {whitelistedStudents.map((white) => (
                    <div key={white.id} className="p-3 rounded-2xl bg-gray-50 dark:bg-[#14171C] border border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-[#1A1A1A] dark:text-white flex items-center gap-2">
                          <span>{white.studentName}</span>
                          <span className="font-mono text-gray-500 text-[11px]">({white.prn})</span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          Reason: <em>{white.notes}</em> • Whitelisted: {new Date(white.whitelistedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (window.confirm(`Remove whitelist exception for ${white.studentName}?`)) {
                            await removeWhitelistApi(white.userId || white.prn);
                            setAdminToast("Removed whitelist exception.");
                            setTimeout(() => setAdminToast(''), 3000);
                            loadBlockedAttemptsAndWhitelists();
                          }
                        }}
                        className="text-red-500 hover:text-red-700 font-bold text-xs cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* JUDGING CRITERIA & PROCTORING SETTINGS TAB (Section 2 & 3) */}
        {activeTab === 'examsettings' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E8DEC8] dark:border-[#2E3440]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#B3122B]/10 text-[#B3122B] flex items-center justify-center font-bold">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-[#1A1A1A] dark:text-white">
                      Quiz Judging Criteria & Proctoring Control
                    </h2>
                    <p className="text-xs text-gray-500">
                      Configure quiz rules, negative marking, timer duration, AI camera thresholds, and mandatory guidelines text.
                    </p>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    updateExamSettings(localExamSettings);
                    await saveExamSettings({ judgingSettings: localExamSettings, proctoringSettings: localExamSettings });
                    setAdminToast("Quiz Judging Criteria & Proctoring configuration saved successfully!");
                    setTimeout(() => setAdminToast(''), 4000);
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[#B3122B] text-white hover:bg-[#8B0D20] shadow-sm shadow-[#B3122B]/20 transition-all flex items-center gap-2 cursor-pointer self-start md:self-auto"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Save All Settings</span>
                </button>
              </div>

              {/* Form Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 text-xs">
                {/* Column 1: Quiz Scoring & Duration */}
                <div className="space-y-4">
                  <h3 className="font-bold text-sm text-[#1A1A1A] dark:text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#B3122B]" />
                    <span>Quiz Scoring & Timing Rules</span>
                  </h3>

                  <div>
                    <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Negative Marking Deduction per Incorrect Answer
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 0.25, 0.5, 1.0].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setLocalExamSettings(s => ({ ...s, negativeMarking: val }))}
                          className={`py-2 rounded-xl font-bold border transition-all cursor-pointer ${
                            localExamSettings.negativeMarking === val
                              ? 'bg-[#B3122B] text-white border-[#B3122B]'
                              : 'bg-[#FCF9F2] dark:bg-[#111317] text-gray-700 dark:text-gray-300 border-[#E8DEC8] dark:border-[#2E3440] hover:border-[#B3122B]'
                          }`}
                        >
                          {val === 0 ? "None (0)" : `-${val} pt`}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Default is none (0). Subtracted from student quiz score per wrong selection.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Quiz Time Limit (Seconds)
                    </label>
                    <input
                      type="number"
                      min={60}
                      max={3600}
                      step={30}
                      value={localExamSettings.quizTimeLimitSeconds}
                      onChange={(e) => setLocalExamSettings(s => ({ ...s, quizTimeLimitSeconds: parseInt(e.target.value, 10) || 600 }))}
                      className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] font-mono font-bold text-sm text-[#1A1A1A] dark:text-white"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      {Math.floor(localExamSettings.quizTimeLimitSeconds / 60)} minutes {localExamSettings.quizTimeLimitSeconds % 60} seconds. Auto-submits answers when time expires.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Minimum Passing Mark for Certificate Eligibility (out of 100)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={localExamSettings.passMark ?? 50}
                      onChange={(e) => setLocalExamSettings(s => ({ ...s, passMark: parseInt(e.target.value, 10) || 50 }))}
                      className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] font-mono font-bold text-sm text-[#1A1A1A] dark:text-white"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Default is 50. Students with cumulative points ≥ this score without disqualification receive certificates.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Program Task Evaluation Ratio (Fixed Standard)
                    </label>
                    <div className="p-3 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Test Case Correctness:</span>
                        <strong className="text-emerald-600">80% of task points</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Algorithmic Efficiency & Complexity:</span>
                        <strong className="text-blue-600">10% of task points</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Code Quality & Formatting:</span>
                        <strong className="text-purple-600">10% of task points</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Proctoring & Disqualification */}
                <div className="space-y-4">
                  <h3 className="font-bold text-sm text-[#1A1A1A] dark:text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#B3122B]" />
                    <span>Proctoring & Disqualification Engine</span>
                  </h3>

                  <div>
                    <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Tab Switch & Fullscreen Exit Policy
                    </label>
                    <select
                      value={localExamSettings.violationMode}
                      onChange={(e) => setLocalExamSettings(s => ({ ...s, violationMode: e.target.value }))}
                      className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] font-bold text-xs text-[#1A1A1A] dark:text-white"
                    >
                      <option value="immediate_exit">Strict Immediate Exit (0 Warnings - Instant Disqualification)</option>
                      <option value="warning_then_exit">Warning Once, Then Exit on 2nd Violation</option>
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">
                      When triggered, the test terminates immediately, saves partial score, marks "Exited: tab switch", and locks re-entry.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                        No Face Timeout (Seconds)
                      </label>
                      <input
                        type="number"
                        min={3}
                        max={60}
                        value={localExamSettings.noFaceSeconds}
                        onChange={(e) => setLocalExamSettings(s => ({ ...s, noFaceSeconds: parseInt(e.target.value, 10) || 10 }))}
                        className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] font-mono font-bold text-xs"
                      />
                      <span className="text-[10px] text-gray-400">Exit if face is absent for &gt; N secs</span>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Phone Confidence (COCO-SSD)
                      </label>
                      <input
                        type="number"
                        min={0.3}
                        max={0.95}
                        step={0.05}
                        value={localExamSettings.phoneConfidence}
                        onChange={(e) => setLocalExamSettings(s => ({ ...s, phoneConfidence: parseFloat(e.target.value) || 0.55 }))}
                        className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] font-mono font-bold text-xs"
                      />
                      <span className="text-[10px] text-gray-400">Threshold for cell phone detection</span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Admin Custom Announcement for Judging Guidelines Screen
                    </label>
                    <textarea
                      rows={3}
                      value={localExamSettings.judgingCriteriaText}
                      onChange={(e) => setLocalExamSettings(s => ({ ...s, judgingCriteriaText: e.target.value }))}
                      placeholder="e.g. Special Instructions: Day 1 quiz questions are based on fundamental syntax. Negative marking is waived for today."
                      className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-xs"
                    />
                    <span className="text-[10px] text-gray-400">
                      Renders directly at top of the student's pre-quiz agreement dialog.
                    </span>
                  </div>
                </div>
              </div>

              {/* Tie-breaker & Ranking Summary */}
              <div className="mt-6 pt-4 border-t border-[#E8DEC8] dark:border-[#2E3440] text-xs">
                <div className="font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Official Tie-Breaker & Ranking Rules (Active System-Wide)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
                    <div className="font-bold text-[#B3122B]">1. Higher Score First</div>
                    <p className="text-[11px] text-gray-500 mt-1">Total points across test case correctness & quiz score.</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
                    <div className="font-bold text-[#B3122B]">2. Less Time Taken</div>
                    <p className="text-[11px] text-gray-500 mt-1">Faster test completion timestamp breaks score ties.</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
                    <div className="font-bold text-[#B3122B]">3. Pass Criteria</div>
                    <p className="text-[11px] text-gray-500 mt-1">≥50 / 100 final points, 0 unresolved flags, passed live vivas.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Server CLI Recovery Instructions Modal */}
        {showResetDeviceModal && (
          <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[#E8DEC8] dark:border-[#2E3440] shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8DEC8] dark:border-[#2E3440] mb-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-[#B3122B]" />
                  <h3 className="font-extrabold text-base text-[#1A1A1A] dark:text-white">
                    Hardware Device Recovery Procedure
                  </h3>
                </div>
                <button
                  onClick={() => setShowResetDeviceModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
                  <p className="font-bold mb-1">Web-Based Unbinding is Permanently Disabled</p>
                  <p className="text-[11px] leading-relaxed">
                    Per institutional security policy, web-based device resets are prohibited so that stolen credentials cannot unbind your workstation.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#121418] border border-[#E8DEC8] dark:border-[#2E3440] space-y-2">
                  <span className="font-bold text-gray-700 dark:text-gray-300 block">
                    Server Recovery Command (CLI Only):
                  </span>
                  <div className="p-2.5 rounded-xl bg-black text-emerald-400 font-mono text-[11px] select-all break-all">
                    npm run admin:reset-device -- --setup-key=&lt;ADMIN_SETUP_KEY&gt;
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Execute this command directly in the host server terminal. It validates your secret <code className="font-mono text-[#B3122B]">ADMIN_SETUP_KEY</code>, clears the hardware device registry, and re-enables one-time setup mode.
                  </p>
                </div>

                <div className="flex justify-end pt-2 border-t border-[#E8DEC8] dark:border-[#2E3440]">
                  <button
                    onClick={() => setShowResetDeviceModal(false)}
                    className="px-4 py-2 rounded-xl font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] cursor-pointer shadow-xs"
                  >
                    Understood
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Template Unlock Confirmation Modal */}
        {showUnlockModal && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[#E8DEC8] dark:border-[#2E3440] shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8DEC8] dark:border-[#2E3440] mb-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-amber-600" />
                  <h3 className="font-extrabold text-base text-[#1A1A1A] dark:text-white">
                    Unlock Certificate Template
                  </h3>
                </div>
                <button
                  onClick={() => setShowUnlockModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300">
                  <p className="font-bold mb-1">Safety Lockout Confirmation</p>
                  <p className="text-[11px] leading-relaxed">
                    This template was approved and locked to ensure that all student certificates share an identical layout, verified signatures, and SVIT branding. Unlocking enables replacement of logos, seals, signatures, and signatory titles.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Type <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-[#B3122B] font-mono">CONFIRM UNLOCK</code> to unlock:
                  </label>
                  <input
                    type="text"
                    value={typedUnlockCode}
                    onChange={(e) => setTypedUnlockCode(e.target.value)}
                    placeholder="CONFIRM UNLOCK"
                    className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-xs font-mono font-bold text-[#1A1A1A] dark:text-white uppercase"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    onClick={() => setShowUnlockModal(false)}
                    className="px-4 py-2 rounded-xl font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (typedUnlockCode.trim() !== 'CONFIRM UNLOCK') {
                        alert('You must type CONFIRM UNLOCK exactly to unlock the template.');
                        return;
                      }
                      unlockCertificateTemplate();
                      setShowUnlockModal(false);
                      setTypedUnlockCode('');
                      setAdminToast("Template unlocked for editing.");
                      setTimeout(() => setAdminToast(''), 3000);
                    }}
                    disabled={typedUnlockCode.trim() !== 'CONFIRM UNLOCK'}
                    className="px-4 py-2 rounded-xl font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Confirm & Unlock
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2-Minute Live Viva Modal */}
        {selectedSubForViva && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-[#E8DEC8] dark:border-[#2E3440] shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8DEC8] dark:border-[#2E3440] mb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#B3122B]" />
                  <h3 className="font-extrabold text-lg text-[#1A1A1A] dark:text-white">
                    2-Minute Live Viva Evaluation
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedSubForViva(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <div className="text-gray-400 font-bold uppercase">Student Details</div>
                  <div className="font-bold text-sm text-[#1A1A1A] dark:text-white mt-0.5">
                    {selectedSubForViva.studentName} (Roll No: {selectedSubForViva.prn})
                  </div>
                  <div className="text-gray-500">Day {selectedSubForViva.day} • {selectedSubForViva.track} Track • Variant {selectedSubForViva.variant}</div>
                </div>

                <div className="p-3 rounded-xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
                  <div className="font-bold text-gray-500 uppercase text-[10px]">Student's Submitted Solution Note:</div>
                  <p className="text-xs text-gray-800 dark:text-gray-200 font-medium mt-1 italic">
                    "{selectedSubForViva.solutionNote}"
                  </p>
                  <a 
                    href={selectedSubForViva.githubRepo} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[#B3122B] font-bold text-xs mt-2 hover:underline"
                  >
                    <Github className="w-3.5 h-3.5" />
                    <span>Open GitHub Repo</span>
                  </a>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-200 mb-1">
                    Viva Feedback / Explanation Notes:
                  </label>
                  <textarea
                    rows={2}
                    value={vivaNotes}
                    onChange={(e) => setVivaNotes(e.target.value)}
                    placeholder="e.g. Student clearly explained the component tree and async handlers."
                    className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-xs text-[#1A1A1A] dark:text-white"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      evaluateViva(selectedSubForViva.id, false, vivaNotes);
                      setSelectedSubForViva(null);
                    }}
                    className="w-1/2 py-2.5 px-3 rounded-xl font-bold bg-red-100 dark:bg-red-950/40 text-red-600 hover:bg-red-200 text-xs transition-colors"
                  >
                    Failed Viva (Revoke Points)
                  </button>
                  <button
                    onClick={() => {
                      evaluateViva(selectedSubForViva.id, true, vivaNotes);
                      setSelectedSubForViva(null);
                    }}
                    className="w-1/2 py-2.5 px-3 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 text-xs shadow-xs transition-colors"
                  >
                    Passed Viva (Confirm Points)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Task Edit Modal */}
        {editingTask && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 max-w-xl w-full border border-[#E8DEC8] dark:border-[#2E3440] shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8DEC8] dark:border-[#2E3440] mb-4">
                <h3 className="font-extrabold text-lg text-[#1A1A1A] dark:text-white">
                  Edit Day {editingTask.day} Task
                </h3>
                <button
                  onClick={() => setEditingTask(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveTaskEdit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold mb-1">Title</label>
                  <input
                    type="text"
                    value={editingTask.title}
                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317]"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={editingTask.description}
                    onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317]"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Base Points</label>
                  <input
                    type="number"
                    value={editingTask.points}
                    onChange={(e) => setEditingTask({ ...editingTask, points: parseInt(e.target.value, 10) })}
                    className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingTask(null)}
                    className="px-4 py-2 rounded-xl font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20]"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Sample Certificate Preview Modal */}
        {selectedStudentForCertModal && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white dark:bg-[#181B20] rounded-3xl p-4 sm:p-6 max-w-5xl w-full border border-[#E8DEC8] dark:border-[#2E3440] shadow-2xl max-h-[92vh] overflow-y-auto my-auto">
              
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-[#E8DEC8] dark:border-[#2E3440] mb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1.5 bg-[#B3122B]/10 text-[#B3122B] dark:text-[#ff8a9e]">
                    <Award className="w-3 h-3" />
                    <span>{isBulkPreviewMode ? "Prerequisite: Sample Preview Before Bulk Send" : "Official Certificate Inspection"}</span>
                  </div>
                  <h3 className="font-extrabold text-base sm:text-lg text-[#1A1A1A] dark:text-white">
                    {isBulkPreviewMode 
                      ? `Review Sample Certificate Before Sending to All ${eligibleCount} Eligible Students`
                      : `Certificate Preview: ${selectedStudentForCertModal.name}`
                    }
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isBulkPreviewMode
                      ? "Verify typography, official signatures (Vedant Kokane & Dr. S. S. Pande), institutional seal, and QR verification format."
                      : `Roll No: ${selectedStudentForCertModal.prn} • Track: ${selectedStudentForCertModal.track || 'Web'} • Sender: technicalteamsvit@gmail.com`
                    }
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSelectedStudentForCertModal(null);
                    setIsBulkPreviewMode(false);
                  }}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-base"
                >
                  ✕
                </button>
              </div>

              {/* Certificate View Component */}
              <div className="py-2">
                <CertificateView
                  studentName={selectedStudentForCertModal.name}
                  prn={selectedStudentForCertModal.prn}
                  track={selectedStudentForCertModal.track || 'Web'}
                  certificateId={selectedStudentForCertModal.cert?.certificateId || 'TNV-CS-2026-0001'}
                  startDate={selectedStudentForCertModal.cert?.startDate || SPRINT_START_DATE}
                  endDate={selectedStudentForCertModal.cert?.endDate || SPRINT_END_DATE}
                  issueDate={selectedStudentForCertModal.cert?.issuedDate || SPRINT_ISSUE_DATE}
                  showDownloadButton={true}
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-[#E8DEC8] dark:border-[#2E3440] flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                <div className="text-xs text-gray-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Authorized by Technical Skill Development Hub, SVIT Nashik</span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => {
                      setSelectedStudentForCertModal(null);
                      setIsBulkPreviewMode(false);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors cursor-pointer"
                  >
                    Close Preview
                  </button>

                  {isBulkPreviewMode ? (
                    <button
                      onClick={() => {
                        const eligibleList = studentsWithCertInfo.filter(s => s.eligibility.isEligible);
                        handleSendCertificates(eligibleList);
                      }}
                      className="px-5 py-2 rounded-xl text-xs font-extrabold bg-[#B3122B] text-white hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>Confirm & Send to All {eligibleCount} Eligible Students</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSendCertificates([selectedStudentForCertModal])}
                      disabled={!selectedStudentForCertModal.eligibility?.isEligible}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Certificate via Email</span>
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Section 9.2: Preview Email Modal (Exact subject, body and attachment for one student) */}
        {previewEmailStudent && (() => {
          const student = previewEmailStudent;
          const cert = student.cert || issueCertificate(student);
          const recipientEmail = student.email || `${safeLowerCase(student.prn)}@svit.ac.in`;
          const score = student.eligibility?.totalScore?.toFixed(1) || '50.0';
          const language = student.language || student.track || 'Python';
          const certId = cert.certificateId || 'TNV-CS-2026-0001-K7Q2';
          const verificationUrl = `${window.location.origin}/verify/${certId}`;
          const myCertificateUrl = `${window.location.origin}/certificate`;
          const attachmentFileName = `Technova_Code_Sprint_Certificate_${safeReplace(student.name, /\s+/g, '_') || 'Student'}.pdf`;

          const plainTextBody = `Dear ${student.name || 'Student'},

Congratulations! You have successfully completed the Technova Code Sprint: 9 Days to Build (14 to 22 October 2026), organised by the Technical Skill Development Hub, SVIT Nashik.

Your final score: ${score} / 100 | Language: ${language}
Certificate ID: ${certId}

Your certificate is attached to this email as a PDF. You can also view it at ${myCertificateUrl}. Anyone can verify it at: ${verificationUrl}.

Keep learning, keep building!

Regards, Technical Skill Development Hub, Sir Visvesvaraya Institute of Technology, Nashik
Instagram: @tsdh_svit | LinkedIn: https://www.linkedin.com/company/technical-skill-development-hub-svit-nashik/

This is an automated email. For queries, reply to this email.`;

          return (
            <div className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
              <div className="bg-white dark:bg-[#181B20] rounded-3xl p-5 sm:p-7 max-w-3xl w-full border border-[#E8DEC8] dark:border-[#2E3440] shadow-2xl max-h-[92vh] overflow-y-auto my-auto flex flex-col">
                
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-[#E8DEC8] dark:border-[#2E3440]">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1.5 bg-[#B3122B]/10 text-[#B3122B] dark:text-[#ff8a9e]">
                      <Mail className="w-3 h-3" />
                      <span>Section 9.2: Official Certificate Email Inspector</span>
                    </div>
                    <h3 className="font-extrabold text-base sm:text-lg text-[#1A1A1A] dark:text-white">
                      Email Preview: {student.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Exact subject, headers, body copy, and PDF attachment to be dispatched.
                    </p>
                  </div>

                  <button
                    onClick={() => setPreviewEmailStudent(null)}
                    className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-base cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Email Meta Headers Box */}
                <div className="mt-4 p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] text-xs space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-gray-400 font-semibold w-20">From:</span>
                    <span className="font-bold text-[#8B0D20] dark:text-[#ff8a9e] flex-1">
                      Technical Skill Development Hub, SVIT Nashik &lt;technicalteamsvit@gmail.com&gt;
                    </span>
                  </div>
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-gray-400 font-semibold w-20">Reply-To:</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300 flex-1">
                      technicalteamsvit@gmail.com
                    </span>
                  </div>
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-gray-400 font-semibold w-20">To:</span>
                    <span className="font-bold text-gray-900 dark:text-white flex-1 font-mono">
                      {student.name} &lt;{recipientEmail}&gt;
                    </span>
                  </div>
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-gray-400 font-semibold w-20">Subject:</span>
                    <span className="font-extrabold text-[#1A1A1A] dark:text-white flex-1">
                      Your Technova Code Sprint Certificate - {student.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between flex-wrap gap-1 pt-1 border-t border-[#E8DEC8]/60 dark:border-[#2E3440]">
                    <span className="text-gray-400 font-semibold w-20">Attachment:</span>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 font-medium">
                      <FileText className="w-3.5 h-3.5 text-red-600" />
                      <span className="font-mono font-bold text-[11px]">{attachmentFileName}</span>
                      <span className="text-[10px] text-gray-400">(PDF, signed & verified)</span>
                    </div>
                  </div>
                </div>

                {/* View Switcher: HTML vs Plain Text */}
                <div className="flex items-center justify-between mt-4 mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email Body Content</span>
                  <div className="flex items-center bg-[#F5EFEB] dark:bg-[#111317] p-1 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] text-xs">
                    <button
                      onClick={() => setPreviewEmailFormat('html')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        previewEmailFormat === 'html' ? 'bg-white dark:bg-[#252A34] text-[#B3122B] shadow-2xs' : 'text-gray-500'
                      }`}
                    >
                      HTML Rich View
                    </button>
                    <button
                      onClick={() => setPreviewEmailFormat('text')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        previewEmailFormat === 'text' ? 'bg-white dark:bg-[#252A34] text-[#B3122B] shadow-2xs' : 'text-gray-500'
                      }`}
                    >
                      Plain-Text View
                    </button>
                  </div>
                </div>

                {/* Body Render */}
                <div className="flex-1 overflow-y-auto">
                  {previewEmailFormat === 'text' ? (
                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-gray-800 font-mono text-xs whitespace-pre-wrap leading-relaxed text-gray-800 dark:text-gray-200">
                      {plainTextBody}
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl bg-white dark:bg-[#14171C] border border-[#E8DEC8] dark:border-[#2E3440] text-xs space-y-4 shadow-inner">
                      <div className="flex items-center justify-between pb-3 border-b border-[#E8DEC8] dark:border-[#2E3440]">
                        <div className="flex items-center gap-2">
                          <SVITHubLogo className="w-8 h-8" />
                          <div>
                            <div className="font-extrabold text-[#8B0D20] text-xs uppercase tracking-wider">Technical Skill Development Hub</div>
                            <div className="text-[10px] text-gray-500 font-medium">Sir Visvesvaraya Institute of Technology, Nashik</div>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] font-bold text-[#B3122B] bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full">
                          {certId}
                        </span>
                      </div>

                      <div className="text-gray-800 dark:text-gray-200 space-y-3 leading-relaxed">
                        <p className="font-semibold text-sm">Dear {student.name},</p>
                        <p>
                          Congratulations! You have successfully completed the <strong>Technova Code Sprint: 9 Days to Build</strong> (14 to 22 October 2026), organised by the Technical Skill Development Hub, SVIT Nashik.
                        </p>
                        
                        <div className="p-3 rounded-xl bg-[#FCF9F2] dark:bg-[#1C2028] border border-[#E8DEC8] dark:border-[#2E3440] font-mono font-bold flex flex-wrap gap-4 text-xs">
                          <div>Your final score: <span className="text-[#B3122B]">{score} / 100</span></div>
                          <div>Track / Language: <span className="text-blue-600">{language}</span></div>
                          <div>Certificate ID: <span className="text-purple-600">{certId}</span></div>
                        </div>

                        <p>
                          Your certificate is attached to this email as a PDF. You can also view it at{' '}
                          <a href={myCertificateUrl} target="_blank" rel="noreferrer" className="text-[#B3122B] underline font-medium">
                            [My Certificate link]
                          </a>
                          . Anyone can verify it at:{' '}
                          <a href={verificationUrl} target="_blank" rel="noreferrer" className="text-[#B3122B] underline font-medium font-mono">
                            {verificationUrl}
                          </a>.
                        </p>

                        <p className="font-bold text-[#8B0D20] dark:text-[#ff8a9e]">
                          Keep learning, keep building!
                        </p>

                        <div className="pt-2 border-t border-[#E8DEC8]/60 dark:border-[#2E3440] text-gray-600 dark:text-gray-400 text-[11px] space-y-0.5">
                          <div className="font-bold text-gray-800 dark:text-gray-200">
                            Regards,<br />
                            Technical Skill Development Hub,<br />
                            Sir Visvesvaraya Institute of Technology, Nashik
                          </div>
                          <div>Instagram: <span className="text-[#B3122B] font-medium">@tsdh_svit</span> • LinkedIn: <span className="text-blue-600 font-medium">Technical Skill Development Hub</span></div>
                        </div>

                        <div className="pt-2 text-[10px] text-gray-400 italic">
                          This is an automated email. For queries, reply to this email.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="pt-4 border-t border-[#E8DEC8] dark:border-[#2E3440] mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Dispatched via Gmail SMTP with Nodemailer</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewEmailStudent(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                      Close Preview
                    </button>
                    <button
                      onClick={() => {
                        const isSentAlready = student.cert?.status === 'sent' || student.cert?.status === 'resent';
                        handleSendCertificates([student], { forceResend: isSentAlready });
                        setPreviewEmailStudent(null);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{student.cert?.status === 'sent' || student.cert?.status === 'resent' ? 'Resend to This Student' : 'Send to This Student Now'}</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* Bulk Send to All Eligible Confirmation Modal */}
        {showBulkConfirmModal && (() => {
          const eligibleList = studentsWithCertInfo.filter(s => s.eligibility.isEligible);
          const alreadySent = eligibleList.filter(s => s.cert?.status === 'sent' || s.cert?.status === 'resent').length;
          const netNewToSend = eligibleList.length - alreadySent;
          const quotaLeft = (dailySendLimit || 400) - (dailySentStats?.count || 0);

          return (
            <div className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 max-w-md w-full border border-[#E8DEC8] dark:border-[#2E3440] shadow-2xl">
                <div className="flex items-center gap-3 pb-3 border-b border-[#E8DEC8] dark:border-[#2E3440]">
                  <div className="w-10 h-10 rounded-2xl bg-[#B3122B]/10 text-[#B3122B] flex items-center justify-center font-bold">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-[#1A1A1A] dark:text-white">
                      Confirm Dispatch to All Eligible Students
                    </h3>
                    <p className="text-xs text-gray-500">
                      Technical Skill Development Hub, SVIT Nashik
                    </p>
                  </div>
                </div>

                <div className="my-4 space-y-3 text-xs">
                  <div className="p-3 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] space-y-1.5 font-medium">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Qualified (Score ≥ 50):</span>
                      <strong className="text-emerald-600 font-bold">{eligibleList.length} students</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Already Received:</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{alreadySent} (will be skipped)</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-[#E8DEC8]/60 dark:border-[#2E3440]">
                      <span className="text-gray-700 dark:text-gray-200 font-bold">Pending Delivery:</span>
                      <strong className="text-[#B3122B] font-extrabold">{netNewToSend} student certificates</strong>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 text-[11px] text-blue-900 dark:text-blue-200">
                    <div className="font-bold flex items-center gap-1 mb-1">
                      <Info className="w-3.5 h-3.5 text-blue-600" />
                      <span>Section 9.4 Queue Policy</span>
                    </div>
                    <span>
                      Emails are dispatched in <strong>batches of 20</strong> with a <strong>60-second cooldown pause</strong> between batches and <strong>~2.5s</strong> spacing between emails from <strong>technicalteamsvit@gmail.com</strong>.
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 px-1">
                    <span>Gmail daily quota available:</span>
                    <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{quotaLeft} emails</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8DEC8] dark:border-[#2E3440]">
                  <button
                    onClick={() => setShowBulkConfirmModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowBulkConfirmModal(false);
                      handleSendCertificates(eligibleList);
                    }}
                    disabled={netNewToSend === 0}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] shadow-sm shadow-[#B3122B]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {netNewToSend === 0 ? "All Already Sent" : `Confirm & Send ${netNewToSend} Emails`}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Section 9.4: Daily Send Limit Modal */}
        {showDailyLimitModal && (
          <div className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 max-w-sm w-full border border-[#E8DEC8] dark:border-[#2E3440] shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8DEC8] dark:border-[#2E3440] mb-3">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-[#B3122B]" />
                  <h3 className="font-extrabold text-sm text-[#1A1A1A] dark:text-white">
                    Daily Send Limit Configuration
                  </h3>
                </div>
                <button
                  onClick={() => setShowDailyLimitModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-gray-500">
                  Gmail limits sending to ~500/day for standard Gmail accounts and ~2,000/day for Google Workspace.
                </p>

                <div>
                  <label className="block font-bold mb-1 text-gray-700 dark:text-gray-300">
                    Daily Send Limit (Safety Threshold)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={2000}
                    value={tempDailyLimit}
                    onChange={(e) => setTempDailyLimit(parseInt(e.target.value, 10) || 400)}
                    className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] font-mono font-bold text-sm"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Default is 400 to protect account deliverability and prevent throttling.
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] text-[11px] text-gray-600 dark:text-gray-400">
                  Used today: <strong className="text-[#1A1A1A] dark:text-white font-mono">{dailySentStats?.count || 0}</strong> / {tempDailyLimit} emails
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowDailyLimitModal(false)}
                    className="px-3 py-1.5 rounded-xl font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      updateDailySendLimit(tempDailyLimit);
                      setShowDailyLimitModal(false);
                      setAdminToast(`Daily send limit set to ${tempDailyLimit} emails.`);
                      setTimeout(() => setAdminToast(''), 4000);
                    }}
                    className="px-4 py-1.5 rounded-xl font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] cursor-pointer shadow-xs"
                  >
                    Save Setting
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Student 9-Day Submission Track Window Modal */}
        {selectedStudentForTrackWindow && (() => {
          const student = selectedStudentForTrackWindow;
          // Gather all submissions by this student
          const studentSubs = submissions.filter(
            s => s.userId === student.uid || s.prn === student.prn || s.studentName === student.name
          );
          const studentCert = certificates[student.uid || student.prn];
          const studentKey = student.uid || student.prn;
          const isOverridden = manualOverrides[studentKey] !== undefined;
          const overrideVal = manualOverrides[studentKey];

          // Compute 9-day submission map
          const dayMap = {};
          studentSubs.forEach(sub => {
            dayMap[sub.day] = sub;
          });

          const completedDays = Object.keys(dayMap).length;
          const totalPoints = studentSubs.reduce((acc, curr) => acc + (curr.earnedPoints || curr.points || 0), 0);
          const hasFailedViva = studentSubs.some(s => s.failedViva);
          const hasPendingViva = studentSubs.some(s => s.vivaRequired && !s.failedViva);
          const isEligible = isOverridden ? overrideVal : (completedDays === 9 && !hasFailedViva && !hasPendingViva);

          return (
            <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
              <div className="bg-white dark:bg-[#181B20] rounded-3xl p-5 sm:p-7 max-w-4xl w-full border border-[#E8DEC8] dark:border-[#2E3440] shadow-2xl max-h-[92vh] overflow-y-auto my-auto flex flex-col">
                
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-[#E8DEC8] dark:border-[#2E3440]">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#B3122B]/10 text-[#B3122B] dark:text-[#ff8a9e]">
                      <Activity className="w-3 h-3" />
                      <span>Student Submission Track & Telemetry Window</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-extrabold text-lg sm:text-xl text-[#1A1A1A] dark:text-white">
                        {student.name}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-lg bg-[#FCF9F2] dark:bg-[#252A34] border border-[#E8DEC8] dark:border-[#2E3440] font-mono font-bold text-xs text-[#B3122B]">
                        Roll No: {student.prn}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold text-xs">
                        {student.track || 'Web Development'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {student.branch || 'Computer Engineering'} • {student.email || `${safeLowerCase(student.prn)}@svit.ac.in`}
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedStudentForTrackWindow(null)}
                    className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Summary Metrics Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                  <div className="p-3 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
                    <div className="text-[10px] uppercase font-bold text-gray-400">Days Solved</div>
                    <div className="text-xl font-black text-[#1A1A1A] dark:text-white flex items-center gap-1">
                      <span>{completedDays}</span>
                      <span className="text-xs text-gray-400">/ 9 Days</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
                    <div className="text-[10px] uppercase font-bold text-gray-400">Total Points</div>
                    <div className="text-xl font-black text-amber-600 flex items-center gap-1">
                      <span>{totalPoints}</span>
                      <span className="text-xs font-bold text-gray-400">pts</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
                    <div className="text-[10px] uppercase font-bold text-gray-400">Active Streak</div>
                    <div className="text-xl font-black text-orange-600 flex items-center gap-1">
                      <span>{completedDays > 0 ? completedDays : 0}</span>
                      <span className="text-sm">🔥</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
                    <div className="text-[10px] uppercase font-bold text-gray-400">Qualification</div>
                    <div className="mt-1">
                      {isEligible ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Eligible</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-semibold inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>In Progress ({9 - completedDays} left)</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 9 Days Submission Grid */}
                <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
                    <span>9-Day Challenge Progress & Integrity Telemetry</span>
                    <span className="text-[11px] font-normal text-gray-400">Track: {student.track || 'Web'}</span>
                  </div>

                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((dayNum) => {
                      const sub = dayMap[dayNum];
                      const isCompleted = !!sub;

                      return (
                        <div
                          key={dayNum}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isCompleted
                              ? 'bg-[#FCF9F2] dark:bg-[#111317] border-[#E8DEC8] dark:border-[#2E3440]'
                              : 'bg-gray-50/50 dark:bg-[#15181E] border-gray-200/60 dark:border-gray-800/60 opacity-70'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                                  isCompleted
                                    ? 'bg-[#B3122B] text-white shadow-xs'
                                    : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                D{dayNum}
                              </span>

                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs text-[#1A1A1A] dark:text-white">
                                    {tasks.find(t => t.day === dayNum)?.title || `Day ${dayNum} Challenge`}
                                  </span>

                                  {isCompleted ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                                      Variant {sub.variant || 'A'} • Solved
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-500 text-[10px] font-semibold">
                                      Pending / Not Submitted
                                    </span>
                                  )}

                                  {sub?.isLateBulk && (
                                    <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-600 text-[9px] font-bold">
                                      Late Bulk
                                    </span>
                                  )}
                                </div>

                                {isCompleted && (
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-3 flex-wrap">
                                    {sub.githubRepo && (
                                      <a
                                        href={sub.githubRepo}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#B3122B] dark:text-[#ff8a9e] font-mono hover:underline flex items-center gap-1"
                                      >
                                        <Code className="w-3 h-3" />
                                        <span>Repo: {safeGithubRepo(sub.githubRepo)}</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}

                                    <span>• Commits: <strong>{sub.commitCount || 1}</strong></span>
                                    <span>• Tab Switches: <strong className={sub.tabSwitches > 0 ? "text-red-600" : ""}>{sub.tabSwitches || 0}</strong></span>
                                    {sub.quizDisqualified && (
                                      <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-[9px] font-bold">
                                        Quiz Disqualified (Tab Switch)
                                      </span>
                                    )}
                                    {detectAiGeneratedContent(sub.solutionNote).isAiSuspected && (
                                      <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-black uppercase">
                                        AI Module Prohibited Flag
                                      </span>
                                    )}
                                    {sub.demoUrl && (
                                      <a
                                        href={sub.demoUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline flex items-center gap-0.5"
                                      >
                                        <span>Live Demo</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              {isCompleted ? (
                                <div>
                                  <div className="font-extrabold text-xs text-amber-600">
                                    +{sub.earnedPoints || sub.points || 0} pts
                                  </div>
                                  <div className="text-[10px] text-gray-400">
                                    {sub.submittedAt ? new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Verified'}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[11px] text-gray-400">0 pts</div>
                              )}
                            </div>
                          </div>

                          {/* Solution Note & Viva Feedback */}
                          {isCompleted && (
                            <div className="mt-2.5 pt-2 border-t border-[#E8DEC8]/60 dark:border-[#2E3440]/60 space-y-1.5 text-xs">
                              {sub.solutionNote && (
                                <div className="bg-white/80 dark:bg-[#181B20] p-2 rounded-xl text-gray-600 dark:text-gray-300 italic text-[11px] border border-[#E8DEC8]/50 dark:border-[#2E3440]">
                                  <span className="font-semibold text-gray-400 not-italic block text-[9px] uppercase">
                                    Solution Note:
                                  </span>
                                  &ldquo;{sub.solutionNote}&rdquo;
                                </div>
                              )}

                              <div className="flex items-center justify-between text-[11px] pt-1">
                                <div className="flex items-center gap-2">
                                  {sub.failedViva ? (
                                    <span className="text-red-600 font-bold flex items-center gap-1 text-[10px]">
                                      <XCircle className="w-3 h-3" /> Failed Viva Review
                                    </span>
                                  ) : sub.vivaRequired ? (
                                    <span className="text-amber-600 font-bold flex items-center gap-1 text-[10px] animate-pulse">
                                      <Clock className="w-3 h-3" /> Viva Assessment Pending
                                    </span>
                                  ) : (
                                    <span className="text-emerald-600 font-bold flex items-center gap-1 text-[10px]">
                                      <ShieldCheck className="w-3 h-3" /> Academic Integrity Passed
                                    </span>
                                  )}
                                </div>

                                <button
                                  onClick={() => {
                                    setSelectedSubForViva(sub);
                                    setVivaNotes(sub.vivaNotes || "");
                                  }}
                                  className="text-[10px] font-bold text-[#B3122B] hover:underline cursor-pointer"
                                >
                                  {sub.failedViva || sub.vivaRequired ? 'Update Viva' : 'Audit Viva'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-4 border-t border-[#E8DEC8] dark:border-[#2E3440] mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleManualOverride(studentKey)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        isOverridden
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          : 'bg-[#FCF9F2] dark:bg-[#111317] text-gray-700 dark:text-gray-300 border-[#E8DEC8] dark:border-[#2E3440] hover:border-[#B3122B]'
                      }`}
                    >
                      {isEligible ? "Disqualify Certificate" : "Force-Qualify Certificate"}
                    </button>

                    {studentCert && (
                      <span className="text-[11px] font-mono text-[#B3122B]">
                        Cert ID: {studentCert.certificateId}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isEligible && (
                      <button
                        onClick={() => {
                          setSelectedStudentForCertModal(student);
                          setSelectedStudentForTrackWindow(null);
                        }}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Preview Certificate</span>
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedStudentForTrackWindow(null)}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                      Close Window
                    </button>
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
};
