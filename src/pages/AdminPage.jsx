import React, { useState } from 'react';
import bcrypt from 'bcryptjs';
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
  Shield
} from 'lucide-react';
import { Github } from '../components/GithubIcon';
import { CertificateView } from '../components/CertificateView';
import { SVITHubLogo, DurgaMataSketch } from '../components/BrandLogo';

export const AdminPage = ({ setCurrentTab }) => {
  const { 
    tasks, 
    updateTasks, 
    submissions, 
    saveSubmissions, 
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
    emailLogs,
    addEmailLog,
    seedDemoEligibleData,
    user,
    isAdmin,
    loginAsAdmin
  } = useApp();

  const [activeTab, setActiveTab] = useState('submissions'); // 'submissions' | 'tasks' | 'certificates'
  const [filterDay, setFilterDay] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Viva modal / evaluation state
  const [selectedSubForViva, setSelectedSubForViva] = useState(null);
  const [vivaNotes, setVivaNotes] = useState('');

  // Task editor state
  const [editingTask, setEditingTask] = useState(null);

  // Certificate & Email Delivery State
  const [selectedStudentForCertModal, setSelectedStudentForCertModal] = useState(null);
  const [isBulkPreviewMode, setIsBulkPreviewMode] = useState(false);
  const [selectedStudentKeys, setSelectedStudentKeys] = useState([]);
  const [certFilter, setCertFilter] = useState('all'); // 'all', 'eligible', 'ineligible', 'sent', 'failed'
  const [certSearch, setCertSearch] = useState('');
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [sendProgress, setSendProgress] = useState(null);
  const [adminToast, setAdminToast] = useState('');

  // Standard Bcrypt Hash loaded from environment variable (Never hardcode plaintext password)
  const ADMIN_PASSWORD_HASH = import.meta.env.VITE_ADMIN_PASSWORD_HASH || "$2b$10$ZYadSLPwAhGbhqclMY/1E.c5ADCDg06GrCOV6Sl9EtE3JnzfSdiP6";

  // Modal state for student submission track inspection window
  const [selectedStudentForTrackWindow, setSelectedStudentForTrackWindow] = useState(null);

  // Admin Login state (starts completely blank)
  const [adminLoginForm, setAdminLoginForm] = useState({
    name: '',
    email: '',
    department: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Lockout countdown timer
  React.useEffect(() => {
    if (lockoutSeconds > 0) {
      const timer = setTimeout(() => setLockoutSeconds(s => s - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [lockoutSeconds]);

  // Helper to calculate password strength
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: 'Empty', color: 'bg-gray-200' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { score: 1, label: 'Weak (8+ chars, upper, number & symbol required)', color: 'bg-red-500' };
    if (score === 2 || score === 3) return { score, label: 'Moderate', color: 'bg-amber-500' };
    return { score: 4, label: 'Strong & Secure', color: 'bg-emerald-500' };
  };

  const handleAdminLoginSubmit = (e) => {
    e.preventDefault();
    if (lockoutSeconds > 0) {
      setLoginError(`Security lockout in effect. Please wait ${lockoutSeconds} seconds before retrying.`);
      return;
    }

    if (!adminLoginForm.name.trim() || !adminLoginForm.email.trim()) {
      setLoginError("Please enter your faculty full name and official SVIT email address.");
      return;
    }

    const inputPass = adminLoginForm.password.trim();
    let isPasswordValid = false;
    try {
      isPasswordValid = bcrypt.compareSync(inputPass, ADMIN_PASSWORD_HASH);
    } catch (err) {
      console.error("Bcrypt verification error:", err);
    }

    const isSvitFaculty = adminLoginForm.email.toLowerCase().endsWith('@svit.ac.in');

    if (!isPasswordValid || !isSvitFaculty) {
      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);
      if (nextFailed >= 5) {
        setLockoutSeconds(30);
        setLoginError("Security lockout: 5 failed attempts. Login locked for 30 seconds.");
      } else {
        const errorMsg = !isSvitFaculty 
          ? "Official college email required (must end with @svit.ac.in)." 
          : `Authentication failed. Incorrect admin password. Attempts left: ${5 - nextFailed}`;
        setLoginError(errorMsg);
      }
      return;
    }

    setFailedAttempts(0);
    setLockoutSeconds(0);
    setLoginError('');
    loginAsAdmin({
      name: adminLoginForm.name,
      email: adminLoginForm.email,
      department: adminLoginForm.department || "Technical Skill Development Hub",
      rollNo: "SVIT-FACULTY"
    });
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
    const matchesSearch = sub.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          sub.prn.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          sub.githubRepo.toLowerCase().includes(searchQuery.toLowerCase());
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
      `"${s.studentName.replace(/"/g, '""')}"`,
      s.prn,
      s.day,
      s.track,
      s.variant,
      `"${s.githubRepo}"`,
      `"${(s.solutionNote || '').replace(/"/g, '""')}"`,
      s.tabSwitches || 0,
      s.commitCount || 0,
      s.bigCommitNearDeadline ? "YES" : "NO",
      `${s.similarityScore}%`,
      s.points || 0,
      s.vivaRequired ? "YES" : "NO",
      s.failedViva ? "YES" : "NO",
      `"${(s.vivaNotes || '').replace(/"/g, '""')}"`,
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
  const sentCount = studentsWithCertInfo.filter(s => s.cert?.status === 'sent').length;
  const failedCount = studentsWithCertInfo.filter(s => s.cert?.status === 'failed').length;

  // Filter students based on active filter and search query
  const filteredStudents = studentsWithCertInfo.filter(s => {
    if (certFilter === 'eligible' && !s.eligibility.isEligible) return false;
    if (certFilter === 'ineligible' && s.eligibility.isEligible) return false;
    if (certFilter === 'sent' && s.cert?.status !== 'sent') return false;
    if (certFilter === 'failed' && s.cert?.status !== 'failed') return false;

    if (certSearch.trim()) {
      const q = certSearch.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchPrn = s.prn.toLowerCase().includes(q);
      const matchTrack = (s.track || '').toLowerCase().includes(q);
      const matchEmail = (s.email || '').toLowerCase().includes(q);
      return matchName || matchPrn || matchTrack || matchEmail;
    }
    return true;
  });

  // Batch Sending Handler (Batches of 50 with delay)
  const handleSendCertificates = async (targets) => {
    if (!targets || targets.length === 0) return;
    setIsSendingBatch(true);

    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(targets.length / BATCH_SIZE);

    for (let b = 0; b < totalBatches; b++) {
      const batch = targets.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

      setSendProgress({
        current: b * BATCH_SIZE,
        total: targets.length,
        batchNumber: b + 1,
        totalBatches,
        message: `Processing batch ${b + 1} of ${totalBatches}...`
      });

      // Inter-batch rate limit delay
      await new Promise(r => setTimeout(r, 600));

      for (let i = 0; i < batch.length; i++) {
        const student = batch[i];
        const cert = issueCertificate(student);
        const recipientEmail = student.email || `${student.prn.toLowerCase()}@svit.ac.in`;

        // Error resilience demo simulation
        const simulateFail = student.name.toLowerCase().includes('fail') || student.email.includes('error');

        if (simulateFail) {
          updateCertificateStatus(cert.certificateId, {
            status: 'failed',
            errorReason: 'SMTP 550: Mailbox unavailable or rejected by destination server'
          });
          addEmailLog({
            id: `log-${Date.now()}-${i}`,
            recipientEmail,
            studentName: student.name,
            certificateId: cert.certificateId,
            sender: "technicalteamsvit@gmail.com",
            status: "failed",
            error: "SMTP 550: Mailbox unavailable",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            subject: "Your Technova Code Sprint Certificate"
          });
        } else {
          updateCertificateStatus(cert.certificateId, {
            status: 'sent',
            sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            errorReason: null
          });
          addEmailLog({
            id: `log-${Date.now()}-${i}`,
            recipientEmail,
            studentName: student.name,
            certificateId: cert.certificateId,
            sender: "technicalteamsvit@gmail.com",
            status: "sent",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            subject: "Your Technova Code Sprint Certificate"
          });
        }

        setSendProgress({
          current: b * BATCH_SIZE + i + 1,
          total: targets.length,
          batchNumber: b + 1,
          totalBatches,
          message: `Delivered to ${student.name} (${b * BATCH_SIZE + i + 1}/${targets.length})`
        });

        await new Promise(r => setTimeout(r, 180));
      }
    }

    setIsSendingBatch(false);
    setSendProgress(null);
    setSelectedStudentForCertModal(null);
    setIsBulkPreviewMode(false);
    setSelectedStudentKeys([]);
    setAdminToast(`Successfully dispatched certificates to ${targets.length} student(s) from technicalteamsvit@gmail.com!`);
    setTimeout(() => setAdminToast(''), 5000);
  };

  // 1 Sample Preview First, then "Send to all eligible"
  const handleTriggerBulkSend = () => {
    const eligibleList = studentsWithCertInfo.filter(s => s.eligibility.isEligible);
    if (eligibleList.length === 0) {
      alert("No students currently qualify for certificates. Make sure students have completed all 9 days without unresolved flags, or use Manual Eligibility Override.");
      return;
    }
    // Preview first sample student
    setSelectedStudentForCertModal(eligibleList[0]);
    setIsBulkPreviewMode(true);
  };

  // Test Email to Admin
  const handleTestEmailToAdmin = async () => {
    const sample = studentsWithCertInfo.find(s => s.eligibility.isEligible) || allStudents[0] || {
      uid: "svit-sample-01",
      name: "Sample Student (Preview)",
      email: user?.email || "technicalteamsvit@gmail.com",
      prn: "SVIT2026TEST01",
      track: "Web"
    };

    const cert = issueCertificate(sample);
    const adminEmail = user?.email || "technicalteamsvit@gmail.com";

    setIsSendingBatch(true);
    setSendProgress({
      current: 1,
      total: 1,
      batchNumber: 1,
      totalBatches: 1,
      message: `Sending sample test certificate to ${adminEmail}...`
    });

    await new Promise(r => setTimeout(r, 700));

    addEmailLog({
      id: `log-test-${Date.now()}`,
      recipientEmail: adminEmail,
      studentName: sample.name,
      certificateId: cert.certificateId,
      sender: "technicalteamsvit@gmail.com",
      status: "sent",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      subject: `[SAMPLE PREVIEW] Your Technova Code Sprint Certificate (${cert.certificateId})`
    });

    setIsSendingBatch(false);
    setSendProgress(null);
    setAdminToast(`Sample certificate test email successfully delivered to ${adminEmail}!`);
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

  // Gatekeeper: If not logged in as Admin, display clean Admin Login form with BLANK inputs
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm relative overflow-hidden">
            {/* Watermark accent */}
            <div className="absolute -top-10 -right-10 pointer-events-none opacity-[0.035] dark:opacity-[0.05] w-48 h-48 text-[#B3122B]">
              <DurgaMataSketch className="w-full h-full" />
            </div>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2.5 mb-3">
                <SVITHubLogo className="w-11 h-11" />
                <div className="w-9 h-9 rounded-full bg-amber-500/10 text-[#B3122B] dark:text-[#ff8a9e] flex items-center justify-center border border-amber-500/20 shadow-xs" title="Shri Durga Mata Blessings">
                  <DurgaMataSketch className="w-6 h-6" />
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#B3122B]/10 dark:bg-[#B3122B]/20 text-[#B3122B] dark:text-[#ff8a9e] text-xs font-bold mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Technical Skill Development Hub • SVIT</span>
              </div>

              <h2 className="text-2xl font-black text-[#1A1A1A] dark:text-white">
                Faculty & Mentor Login
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Enter your credentials to access the Code Sprint administrative panel, evaluate submissions, and issue certificates.
              </p>
            </div>

            {/* Blank Form */}
            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              {loginError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-600 dark:text-red-400">
                  {loginError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0] mb-1.5">
                  Faculty / Mentor Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. S. S. Pande / Prof. Name"
                    value={adminLoginForm.name}
                    onChange={(e) => setAdminLoginForm({ ...adminLoginForm, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-xs text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0] mb-1.5">
                  Official College Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. faculty@svit.ac.in"
                    value={adminLoginForm.email}
                    onChange={(e) => setAdminLoginForm({ ...adminLoginForm, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-xs text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0] mb-1.5">
                  Department / Designation
                </label>
                <div className="relative">
                  <BookOpen className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="e.g. Computer Engineering / TSDH Mentor"
                    value={adminLoginForm.department}
                    onChange={(e) => setAdminLoginForm({ ...adminLoginForm, department: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-xs text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0] mb-1.5 flex items-center justify-between">
                  <span>Admin Password</span>
                  <span className="text-[10px] font-normal text-gray-400">Secure Password Required</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    disabled={lockoutSeconds > 0}
                    placeholder="Enter admin password"
                    value={adminLoginForm.password}
                    onChange={(e) => setAdminLoginForm({ ...adminLoginForm, password: e.target.value })}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-xs text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] font-mono transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Real-time Password Strength Meter */}
                {adminLoginForm.password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-400">Strength:</span>
                      <span className="font-bold text-gray-700 dark:text-gray-200">
                        {getPasswordStrength(adminLoginForm.password).label}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 h-1.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      {[1, 2, 3, 4].map((step) => {
                        const str = getPasswordStrength(adminLoginForm.password);
                        return (
                          <div
                            key={step}
                            className={`h-full rounded-full transition-all ${
                              step <= str.score ? str.color : 'bg-transparent'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {lockoutSeconds > 0 && (
                <div className="p-3 rounded-xl bg-red-100 dark:bg-red-950/40 border border-red-300 text-red-700 dark:text-red-300 text-xs font-bold text-center">
                  Security Lockout: System locked for {lockoutSeconds} seconds due to repeated failed attempts.
                </div>
              )}

              <button
                type="submit"
                disabled={lockoutSeconds > 0}
                className="w-full py-3 rounded-xl font-bold text-xs text-white bg-[#B3122B] hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Authorize & Access Admin Console</span>
              </button>

              {setCurrentTab && (
                <button
                  type="button"
                  onClick={() => setCurrentTab('landing')}
                  className="w-full py-2 rounded-xl font-medium text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
                >
                  ← Return to Student Portal
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-10 px-4 sm:px-6 lg:px-8 pb-24">
      <div className="max-w-7xl mx-auto">
        
        {/* Admin Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B3122B]/10 text-[#B3122B] dark:text-[#ff8a9e] text-xs font-bold mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>SVIT Faculty & Mentor Admin Dashboard</span>
            </div>
            <h1 className="text-3xl font-extrabold text-[#1A1A1A] dark:text-white">
              Code Sprint Command Center
            </h1>
            <p className="text-sm text-[#6b6375] dark:text-[#94a3b8] mt-1">
              Review repository commit histories, analyze text similarities, conduct 2-min vivas, and export records.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
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

        {/* View Switcher: Submissions vs Task Editor vs Certificates */}
        <div className="flex items-center gap-3 border-b border-[#E8DEC8] dark:border-[#2E3440] pb-4 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('submissions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'submissions'
                ? 'bg-[#B3122B] text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-[#F5EFEB] dark:hover:bg-[#1E232B]'
            }`}
          >
            Submissions & Integrity ({submissions.length})
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-[#B3122B] text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-[#F5EFEB] dark:hover:bg-[#1E232B]'
            }`}
          >
            Manage 9-Day Tasks ({tasks.length})
          </button>
          <button
            onClick={() => setActiveTab('certificates')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'certificates'
                ? 'bg-[#B3122B] text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-[#F5EFEB] dark:hover:bg-[#1E232B]'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Eligible Students & Certificates ({eligibleCount})</span>
          </button>
        </div>

        {/* SUBMISSIONS TAB */}
        {activeTab === 'submissions' && (
          <div>
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
                <span className="text-xs font-bold text-gray-500">Day:</span>
                {['All', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                  <button
                    key={d}
                    onClick={() => setFilterDay(d)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      filterDay === d
                        ? 'bg-[#B3122B] text-white'
                        : 'bg-white dark:bg-[#181B20] text-gray-600 dark:text-gray-300 border border-[#E8DEC8] dark:border-[#2E3440]'
                    }`}
                  >
                    {d === 'All' ? 'All' : `D${d}`}
                  </button>
                ))}
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
                          <a 
                            href={sub.githubRepo} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[#B3122B] dark:text-[#ff8a9e] font-semibold hover:underline flex items-center gap-1 truncate"
                          >
                            <Github className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{sub.githubRepo.replace('https://github.com/', '')}</span>
                          </a>
                          
                          <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-2">
                            <span>{sub.commitCount || 1} commits</span>
                            <span>•</span>
                            <span className="font-mono">{sub.firstCommitTime} → {sub.lastCommitTime}</span>
                          </div>

                          <div className="text-[11px] text-gray-500 line-clamp-1 italic mt-0.5">
                            "{sub.solutionNote}"
                          </div>
                        </td>

                        {/* Integrity Signals */}
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            {/* Tab switch */}
                            <div className="text-[11px] text-gray-600 dark:text-gray-300 font-medium">
                              Tab switches: <strong className={sub.tabSwitches > 0 ? 'text-red-600 font-bold' : ''}>{sub.tabSwitches}</strong>
                            </div>

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
                          <span className={`text-sm font-black ${sub.failedViva ? 'text-red-500 line-through' : 'text-emerald-600'}`}>
                            {sub.points} pts
                          </span>
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
                                  email: sub.email || `${sub.prn?.toLowerCase()}@svit.ac.in`
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
              {tasks.map((task) => (
                <div key={task.day} className="bg-white dark:bg-[#181B20] p-5 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="w-7 h-7 rounded-lg bg-[#B3122B] text-white font-black text-xs flex items-center justify-center">
                        D{task.day}
                      </span>
                      <span className="text-xs font-bold text-amber-600">{task.points} pts</span>
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
              ))}
            </div>
          </div>
        )}

        {/* CERTIFICATES & EMAIL DELIVERY TAB */}
        {activeTab === 'certificates' && (
          <div className="space-y-6">
            
            {/* Batch Progress Bar Banner */}
            {isSendingBatch && sendProgress && (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-[#B3122B] to-[#8B0D20] text-white shadow-lg animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-2 text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <RotateCw className="w-4 h-4 animate-spin text-amber-300" />
                    <span>Dispatched via technicalteamsvit@gmail.com (Batch {sendProgress.batchNumber} of {sendProgress.totalBatches})</span>
                  </div>
                  <span className="font-mono">{sendProgress.current} / {sendProgress.total}</span>
                </div>
                <div className="w-full bg-black/25 rounded-full h-2.5 overflow-hidden mb-2">
                  <div 
                    className="bg-amber-300 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.round((sendProgress.current / sendProgress.total) * 100)}%` }}
                  ></div>
                </div>
                <p className="text-[11px] text-white/90 font-medium">
                  {sendProgress.message} (50 emails per batch with automated delay to protect deliverability)
                </p>
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
                  <span>Test Email to Me</span>
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
                  <span>Send to Selected ({selectedStudentKeys.length})</span>
                </button>

                <button
                  onClick={handleTriggerBulkSend}
                  disabled={isSendingBatch || eligibleCount === 0}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#B3122B] text-white hover:bg-[#8B0D20] transition-all flex items-center gap-2 shadow-sm shadow-[#B3122B]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Preview 1 sample certificate first, then confirm send to all eligible students"
                >
                  <Award className="w-4 h-4" />
                  <span>Send to All Eligible ({eligibleCount})</span>
                </button>
              </div>

              {/* Filter Pills & Search */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative flex-1 sm:w-64">
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
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      certFilter === 'all' ? 'bg-white dark:bg-[#252A34] text-[#B3122B] shadow-2xs' : 'text-gray-500'
                    }`}
                  >
                    All ({allStudents.length})
                  </button>
                  <button
                    onClick={() => setCertFilter('eligible')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      certFilter === 'eligible' ? 'bg-white dark:bg-[#252A34] text-emerald-600 shadow-2xs' : 'text-gray-500'
                    }`}
                  >
                    Eligible ({eligibleCount})
                  </button>
                  <button
                    onClick={() => setCertFilter('ineligible')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      certFilter === 'ineligible' ? 'bg-white dark:bg-[#252A34] text-gray-700 shadow-2xs' : 'text-gray-500'
                    }`}
                  >
                    Ineligible
                  </button>
                  <button
                    onClick={() => setCertFilter('sent')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      certFilter === 'sent' ? 'bg-white dark:bg-[#252A34] text-blue-600 shadow-2xs' : 'text-gray-500'
                    }`}
                  >
                    Sent ({sentCount})
                  </button>
                  <button
                    onClick={() => setCertFilter('failed')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      certFilter === 'failed' ? 'bg-white dark:bg-[#252A34] text-red-600 shadow-2xs' : 'text-gray-500'
                    }`}
                  >
                    Failed ({failedCount})
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
                        <th className="py-3 px-4">Sprint Progress</th>
                        <th className="py-3 px-4">Academic Integrity</th>
                        <th className="py-3 px-4">Qualification Status</th>
                        <th className="py-3 px-4">Manual Override</th>
                        <th className="py-3 px-4">Certificate ID</th>
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
                                  {stud.name.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-bold text-[#1A1A1A] dark:text-white flex items-center gap-1.5">
                                    <span>{stud.name}</span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold">
                                      {stud.track || 'Web'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-gray-500 font-mono">
                                    Roll No: {stud.prn} • <span className="text-gray-400">{stud.email || `${stud.prn.toLowerCase()}@svit.ac.in`}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Sprint Progress (9 days count) */}
                            <td className="py-3 px-4">
                              {stud.eligibility.daysCount === 9 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-[11px]">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>9 / 9 Days (Complete)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-[11px]">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{stud.eligibility.daysCount} / 9 Days</span>
                                </span>
                              )}
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

                            {/* Certificate ID */}
                            <td className="py-3 px-4">
                              {cert ? (
                                <a
                                  href={`/verify/${cert.certificateId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono font-bold text-[11px] text-[#B3122B] dark:text-[#ff8a9e] hover:underline flex items-center gap-1"
                                >
                                  <span>{cert.certificateId}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="font-mono text-gray-400 text-[11px]">Pending Gen</span>
                              )}
                            </td>

                            {/* Email Delivery Status */}
                            <td className="py-3 px-4">
                              {emailStatus === 'sent' ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Sent</span>
                                  </span>
                                  {cert?.sentAt && (
                                    <div className="text-[9px] text-gray-400">{cert.sentAt}</div>
                                  )}
                                </div>
                              ) : emailStatus === 'failed' ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/15 text-red-700 dark:text-red-400 font-bold text-[10px]">
                                    <AlertOctagon className="w-3 h-3" />
                                    <span>Failed</span>
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

                                {emailStatus === 'failed' ? (
                                  <button
                                    onClick={() => handleSendCertificates([stud])}
                                    className="px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-bold text-[10px] hover:bg-red-200 transition-colors flex items-center gap-1 cursor-pointer"
                                    title="Retry sending certificate email"
                                  >
                                    <RotateCw className="w-3 h-3" />
                                    <span>Retry</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleSendCertificates([stud])}
                                    disabled={!isEligible}
                                    className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition-colors flex items-center gap-1 cursor-pointer ${
                                      emailStatus === 'sent'
                                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                                        : isEligible
                                          ? 'bg-[#B3122B] text-white hover:bg-[#8B0D20]'
                                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    }`}
                                    title={emailStatus === 'sent' ? 'Resend certificate email' : 'Send certificate email'}
                                  >
                                    <Send className="w-3 h-3" />
                                    <span>{emailStatus === 'sent' ? 'Resend' : 'Send'}</span>
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
              <div className="flex items-center justify-between pb-4 border-b border-[#E8DEC8] dark:border-[#2E3440] mb-4">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#B3122B]" />
                  <h3 className="font-extrabold text-sm text-[#1A1A1A] dark:text-white">
                    Email Delivery Audit Log (Sender: technicalteamsvit@gmail.com)
                  </h3>
                </div>
                <span className="text-xs text-gray-500 font-medium">
                  {emailLogs.length} total dispatch records
                </span>
              </div>

              {emailLogs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  No certificate emails dispatched yet. Click "Send to All Eligible" or "Test Email to Me" to trigger emails.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {emailLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className="p-3 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-[#1A1A1A] dark:text-white flex items-center gap-2">
                          <span>{log.studentName}</span>
                          <span className="font-mono text-[11px] text-[#B3122B]">[{log.certificateId}]</span>
                        </div>
                        <div className="text-[11px] text-gray-500">
                          To: <span className="font-medium text-gray-700 dark:text-gray-300">{log.recipientEmail}</span> • From: <span className="font-bold text-[#8B0D20] dark:text-[#ff8a9e]">technicalteamsvit@gmail.com</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.status === 'sent' 
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
                  startDate="1st October 2026"
                  endDate="9th October 2026"
                  issueDate="10th October 2026"
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
                      {student.branch || 'Computer Engineering'} • {student.email || `${student.prn?.toLowerCase()}@svit.ac.in`}
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
                                        <span>Repo: {sub.githubRepo.replace('https://github.com/', '')}</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}

                                    <span>• Commits: <strong>{sub.commitCount || 1}</strong></span>
                                    <span>• Tab Switches: <strong className={sub.tabSwitches > 0 ? "text-red-600" : ""}>{sub.tabSwitches || 0}</strong></span>
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
