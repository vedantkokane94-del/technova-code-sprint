import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getTaskVariant, detectAiGeneratedContent } from '../utils/hash';
import confetti from 'canvas-confetti';
import { 
  Lock, 
  Clock, 
  HelpCircle, 
  Lightbulb, 
  CheckCircle2, 
  ExternalLink, 
  ShieldAlert, 
  ArrowLeft, 
  AlertTriangle, 
  Sparkles,
  Eye,
  Send,
  Flame,
  FileCode2,
  Copy,
  Ban,
  AlertOctagon,
  Bot,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { Github } from '../components/GithubIcon';
import { SVITHubLogo, DurgaMataSketch } from '../components/BrandLogo';

export const TaskPage = ({ dayNumber, setCurrentTab }) => {

  const { user, tasks, submissions, submitTaskSolution, currentDay, isAdmin } = useApp();

  const task = tasks.find(t => t.day === dayNumber) || tasks[0];
  const assignedVariantKey = getTaskVariant(user?.uid, task.day);

  // Check if DSA track applies
  const isDsaTrack = user?.track === 'DSA' && task.dsaTrack;
  const currentTaskDetails = isDsaTrack ? task.dsaTrack : task;
  const variantData = currentTaskDetails.variants?.[assignedVariantKey] || {
    name: `Variant ${assignedVariantKey}`,
    instruction: "Complete the day assignment matching your assigned track criteria."
  };

  // Find existing submission if already submitted
  const existingSub = submissions.find(s => s.userId === user?.uid && s.day === task.day);

  // Form State
  const [githubRepo, setGithubRepo] = useState(existingSub?.githubRepo || "");
  const [solutionNote, setSolutionNote] = useState(existingSub?.solutionNote || "");
  const [demoLink, setDemoLink] = useState(existingSub?.demoLink || "");
  const [honorCode, setHonorCode] = useState(!!existingSub);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Progressive Hints (Hints 1, 2, 3)
  const [unlockedHints, setUnlockedHints] = useState(() => {
    const saved = localStorage.getItem(`hints_day_${task.day}_${user?.uid}`);
    return saved ? JSON.parse(saved) : [0]; // Hint 1 is free/revealed by default
  });

  const unlockNextHint = (index) => {
    if (!unlockedHints.includes(index)) {
      const next = [...unlockedHints, index];
      setUnlockedHints(next);
      localStorage.setItem(`hints_day_${task.day}_${user?.uid}`, JSON.stringify(next));
    }
  };

  // Integrity Feature: Tab-switch / blur ejection & anti-cheat system
  const [tabSwitchCount, setTabSwitchCount] = useState(existingSub?.tabSwitches || 0);
  const [isDisqualifiedByTabSwitch, setIsDisqualifiedByTabSwitch] = useState(false);
  const [ejectionReason, setEjectionReason] = useState("");

  useEffect(() => {
    // Only monitor student active submission sessions
    if (isAdmin || user?.role === 'admin' || existingSub) return;

    const handleTabViolation = (event) => {
      setTabSwitchCount(prev => prev + 1);
      setIsDisqualifiedByTabSwitch(true);
      const reasonMsg = "You switched browser tabs or minimized the active sprint window. Tab switching is strictly prohibited to prevent external code copying and unauthorized AI usage.";
      setEjectionReason(reasonMsg);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleTabViolation('visibilitychange');
      }
    };

    window.addEventListener('blur', handleTabViolation);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleTabViolation);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAdmin, user, existingSub]);

  // Integrity Feature: Copy / Right-click block handlers
  const handleContextMenu = (e) => {
    e.preventDefault();
  };

  const handleCopyAttempt = (e) => {
    e.preventDefault();
  };

  // Live Countdown to 11:59:59 PM IST
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
      // Calculate end of day today (23:59:59 IST)
      // IST is UTC + 5:30
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const istTime = new Date(utc + (3600000 * 5.5));

      const deadline = new Date(istTime);
      deadline.setHours(23, 59, 59, 999);

      const diff = deadline.getTime() - istTime.getTime();
      if (diff > 0) {
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft({ hours, minutes, seconds });
      } else {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isAdmin || user?.role === 'admin') {
      setFeedback({ type: 'error', text: 'Task submission is strictly disabled for faculty administrators.' });
      return;
    }

    if (isDisqualifiedByTabSwitch || tabSwitchCount > 0) {
      setFeedback({ 
        type: 'error', 
        text: 'Submission Rejected: Browser tab switch detected. External navigation during submission is strictly prohibited.' 
      });
      return;
    }

    // AI Prohibition Client Check
    const aiCheck = detectAiGeneratedContent(solutionNote);
    if (aiCheck.isAiSuspected) {
      setFeedback({
        type: 'error',
        text: `${aiCheck.reason} Please explain the architecture using your own original words. AI modules (ChatGPT, Claude, Gemini, etc.) are strictly prohibited.`
      });
      return;
    }

    if (!githubRepo.trim().startsWith('http')) {
      setFeedback({ type: 'error', text: 'Please enter a valid GitHub repository URL.' });
      return;
    }
    if (solutionNote.trim().length < 25) {
      setFeedback({ type: 'error', text: 'Please provide at least 2-3 lines in your own words explaining how you solved it.' });
      return;
    }
    if (!honorCode) {
      setFeedback({ type: 'error', text: 'You must confirm the Academic Integrity & No AI Honor Code before submitting.' });
      return;
    }

    setSubmitting(true);
    const result = submitTaskSolution({
      day: task.day,
      githubRepo,
      solutionNote,
      demoLink,
      tabSwitches: tabSwitchCount
    });

    setSubmitting(false);
    if (result.success) {
      setFeedback({ 
        type: 'success', 
        text: `Success! Solution submitted! You earned ${result.points} points.` 
      });

      // Trigger Confetti effect
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (err) {}
    } else {
      setFeedback({ type: 'error', text: result.message || 'Submission failed.' });
    }
  };

  const isLocked = task.day > currentDay;

  if (isLocked) {
    return (
      <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] py-20 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white dark:bg-[#181B20] p-8 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] text-center shadow-md">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-[#1A1A1A] dark:text-white">Day {task.day} is Locked</h2>
          <p className="text-sm text-gray-500 mt-2">
            This task unlocks daily at <strong>8:00 AM IST</strong> on Day {task.day}.
          </p>
          <button
            onClick={() => setCurrentTab('dashboard')}
            className="mt-6 px-6 py-2.5 rounded-xl font-bold bg-[#B3122B] text-white text-sm"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-8 px-4 sm:px-6 lg:px-8 pb-24 relative overflow-hidden">
      
      {/* Dynamic Per-User Watermark Overlay across page */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.08] dark:opacity-[0.12] select-none flex flex-wrap gap-24 p-10 font-black text-xl text-[#8B0D20] dark:text-[#ff8a9e] rotate-[-25deg] overflow-hidden">
        {Array.from({ length: 48 }).map((_, i) => (
          <div key={i} className="whitespace-nowrap">
            {user?.name || "SVIT STUDENT"} • Roll No: {user?.prn || "STUDENT"} • शक्ति • विद्या • TECHNOVA 2026
          </div>
        ))}
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        
        {/* Navigation Back */}
        <button
          onClick={() => setCurrentTab('dashboard')}
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-[#B3122B] dark:hover:text-[#ff8a9e] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Sprint Dashboard</span>
        </button>

        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#181B20] p-6 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs mb-8 relative overflow-hidden">
          {/* Subtle divine watermark in header */}
          <div className="absolute right-36 -bottom-8 pointer-events-none opacity-[0.04] dark:opacity-[0.06] w-36 h-36 text-[#B3122B]">
            <DurgaMataSketch className="w-full h-full" />
          </div>

          <div className="flex items-start gap-3">
            <SVITHubLogo className="w-12 h-12 shrink-0 mt-1" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-lg bg-[#B3122B] text-white font-black text-xs flex items-center justify-center">
                  D{task.day}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#8B0D20] dark:text-[#ff8a9e]">
                  {user?.track || "Web"} Track • {currentTaskDetails.level || task.level}
                </span>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold hidden sm:inline">
                  • Technical Skill Development Hub
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1A1A] dark:text-white">
                {currentTaskDetails.title}
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Assigned Variant: <strong className="text-[#B3122B]">Variant {assignedVariantKey} ({variantData.name})</strong>
              </p>
            </div>
          </div>


          {/* Countdown Clock to 11:59 PM IST */}
          <div className="flex items-center gap-3 bg-[#FCF9F2] dark:bg-[#111317] px-4 py-3 rounded-2xl border border-[#E8DEC8] dark:border-[#2E3440]">
            <Clock className="w-5 h-5 text-[#B3122B] animate-spin-slow" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Deadline (11:59 PM IST)
              </div>
              <div className="text-lg font-mono font-black text-[#1A1A1A] dark:text-white">
                {String(timeLeft.hours).padStart(2, '0')}:
                {String(timeLeft.minutes).padStart(2, '0')}:
                {String(timeLeft.seconds).padStart(2, '0')}
              </div>
            </div>
          </div>
        </div>

        {/* Task Specification Card (Protected with no-copy & no-select) */}
        <div 
          onContextMenu={handleContextMenu}
          onCopy={handleCopyAttempt}
          className="no-copy-zone select-none bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm mb-8 relative"
        >
          {/* Integrity Banner */}
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 border-b border-[#E8DEC8]/50 dark:border-[#2E3440] pb-3 mb-5">
            <span className="flex items-center gap-1.5 text-[#B3122B] dark:text-[#ff8a9e]">
              <ShieldAlert className="w-4 h-4" />
              <span>Copy Protected • Personalized for {user?.name || "Student"} (Roll No: {user?.prn || "N/A"})</span>
            </span>
            <span className="text-[11px] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400 font-mono">
              Tab switches logged: {tabSwitchCount}
            </span>
          </div>

          {/* Description */}
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                Objective
              </h2>
              <p className="text-base text-[#1A1A1A] dark:text-gray-100 font-medium leading-relaxed mt-1">
                {currentTaskDetails.description}
              </p>
            </div>

            {/* Student's Assigned Variant Instruction */}
            <div className="p-4 rounded-2xl bg-[#B3122B]/5 dark:bg-[#B3122B]/15 border border-[#B3122B]/20">
              <div className="flex items-center gap-2 text-xs font-black text-[#B3122B] dark:text-[#ff8a9e] uppercase">
                <Sparkles className="w-4 h-4" />
                <span>Your Assigned Variant: Variant {assignedVariantKey} — {variantData.name}</span>
              </div>
              <p className="text-sm text-[#1A1A1A] dark:text-white font-semibold mt-1">
                {variantData.instruction}
              </p>
            </div>

            {/* Bonus (Optional) */}
            {currentTaskDetails.bonus && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
                <span className="font-bold">⭐ Optional Bonus: </span>
                {currentTaskDetails.bonus}
              </div>
            )}
          </div>
        </div>

        {/* Progressive 3 Hints Section */}
        <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <span>Progressive Hints (Revealed One at a Time)</span>
            </h2>
            <span className="text-xs text-gray-500 font-medium">
              Zero penalty for viewing hints!
            </span>
          </div>

          <div className="space-y-3">
            {currentTaskDetails.hints?.map((hint, idx) => {
              const isUnlocked = unlockedHints.includes(idx);
              const canUnlock = idx === 0 || unlockedHints.includes(idx - 1);

              return (
                <div 
                  key={idx}
                  className={`p-4 rounded-2xl border transition-all ${
                    isUnlocked
                      ? 'bg-[#FCF9F2] dark:bg-[#111317] border-[#E8DEC8] dark:border-[#2E3440]'
                      : 'bg-gray-50 dark:bg-[#15181E] border-dashed border-gray-300 dark:border-gray-700'
                  }`}
                >
                  {isUnlocked ? (
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-400 uppercase">Hint #{idx + 1}</div>
                        <div className="text-sm text-[#1A1A1A] dark:text-gray-200 font-medium mt-0.5">
                          {hint}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                        <Lock className="w-4 h-4" />
                        <span>Hint #{idx + 1} is locked</span>
                      </div>
                      <button
                        onClick={() => unlockNextHint(idx)}
                        disabled={!canUnlock}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          canUnlock
                            ? 'bg-[#B3122B] text-white hover:bg-[#8B0D20]'
                            : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {canUnlock ? `Reveal Hint #${idx + 1}` : 'Reveal previous hint first'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Prominent Mandatory Academic Integrity & AI Prohibition Notice */}
        <div className="bg-red-500/10 dark:bg-red-500/15 border-2 border-red-500/30 rounded-3xl p-5 sm:p-6 mb-8 relative overflow-hidden shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#B3122B] text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Ban className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-[#B3122B] text-white text-[10px] font-black uppercase tracking-wider">
                  Mandatory Student Notice
                </span>
                <span className="text-xs font-black text-red-700 dark:text-red-400">
                  Zero AI Policy & Real-time Tab Monitoring Active
                </span>
              </div>
              <h3 className="text-base font-extrabold text-[#1A1A1A] dark:text-white mt-1">
                Strict Prohibition of AI Modules & External Tab Navigation
              </h3>
              <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">
                The use of AI modules (including <strong>ChatGPT, Claude, Gemini, GitHub Copilot, v0, Cursor</strong>, or any LLM assistance) is <strong>strictly prohibited</strong> for code synthesis and solution notes. All submissions must be your original work.
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/80 dark:bg-[#181B20]/80 border border-red-500/20 text-red-800 dark:text-red-300 font-semibold">
                  <AlertOctagon className="w-4 h-4 text-[#B3122B] shrink-0" />
                  <span><strong>Tab Switch = Auto-Ejection:</strong> Switching browser tabs or minimizing instantly locks and disqualifies your submission session.</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/80 dark:bg-[#181B20]/80 border border-red-500/20 text-red-800 dark:text-red-300 font-semibold">
                  <Bot className="w-4 h-4 text-[#B3122B] shrink-0" />
                  <span><strong>AI Synthesis Inspection:</strong> AI-generated patterns trigger immediate academic flag and 0-score viva audit.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submission Form / Faculty Preview Block */}
        <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[#1A1A1A] dark:text-white flex items-center gap-2">
              <FileCode2 className="w-5 h-5 text-[#B3122B]" />
              <span>{isAdmin ? "Faculty Challenge Preview" : existingSub ? "Update Your Submission" : "Submit Your Solution"}</span>
            </h2>
            <span className="text-xs font-semibold text-gray-500">
              {isAdmin ? "Admin Read-Only Inspection" : "Monitored Session • Single Window Required"}
            </span>
          </div>

          {feedback && (
            <div className={`p-4 rounded-2xl mb-6 text-xs font-bold flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400'
            }`}>
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{feedback.text}</span>
            </div>
          )}

          {isAdmin ? (
            /* Admin Mode: Explicitly disabled task submissions for admin */
            <div className="p-6 sm:p-8 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#B3122B]/10 text-[#B3122B] flex items-center justify-center mx-auto mb-3">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-[#1A1A1A] dark:text-white">
                Task Submissions Disabled for Faculty Administrators
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 max-w-lg mx-auto leading-relaxed">
                You are currently logged in as an administrator previewing <strong>Day {task.day}</strong> sprint challenges. Task submissions and scoring are strictly reserved for registered SVIT students.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setCurrentTab('admin')}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#B3122B] text-white hover:bg-[#8B0D20] shadow-sm shadow-[#B3122B]/20 transition-all cursor-pointer"
                >
                  Open Faculty Admin Console
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentTab('dashboard')}
                  className="px-4 py-2.5 rounded-xl font-semibold text-xs border border-[#E8DEC8] dark:border-[#2E3440] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : isDisqualifiedByTabSwitch || (tabSwitchCount > 0 && !existingSub) ? (
            /* Tab-Switch Disqualification / Ejection Screen */
            <div className="p-8 sm:p-10 rounded-3xl bg-red-500/10 dark:bg-red-500/15 border-2 border-red-500 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-[#B3122B] text-white flex items-center justify-center mx-auto shadow-lg shadow-[#B3122B]/30 animate-pulse">
                <Ban className="w-8 h-8" />
              </div>
              <div className="inline-block px-3 py-1 rounded-full bg-red-600 text-white font-black text-[11px] uppercase tracking-wider">
                Ejected from Task Submission
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-400">
                Tab Switch Violation Detected
              </h3>
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 max-w-lg mx-auto leading-relaxed">
                {ejectionReason || "You switched away from the active sprint window. In accordance with Technova SVIT Academic Integrity Rules, switching browser tabs or using external tools during task submission is strictly prohibited."}
              </p>
              
              <div className="p-4 rounded-2xl bg-white dark:bg-[#181B20] border border-red-500/30 max-w-md mx-auto text-left text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Student:</span>
                  <span className="font-bold text-[#1A1A1A] dark:text-white">{user?.name} (Roll No: {user?.prn})</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Violations Recorded:</span>
                  <span className="font-mono font-bold text-red-600">{tabSwitchCount} tab switch event(s)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Integrity Status:</span>
                  <span className="font-bold text-[#B3122B]">Submission Form Locked</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentTab('dashboard')}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Return to Sprint Dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDisqualifiedByTabSwitch(false);
                    setTabSwitchCount(0);
                    setFeedback(null);
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2 cursor-pointer"
                  title="Acknowledge violation rules and restart fresh session without switching tabs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Acknowledge & Restart Session (0 Tabs)</span>
                </button>
              </div>
            </div>
          ) : (
            /* Student Mode: Regular submission form */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* GitHub Repo */}
              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] dark:text-white mb-1.5">
                  GitHub Repository URL <span className="text-[#B3122B]">*</span>
                </label>
                <div className="relative">
                  <Github className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="url"
                    required
                    placeholder="https://github.com/your-username/technova-day1"
                    value={githubRepo}
                    onChange={(e) => setGithubRepo(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-sm text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] transition-colors"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Make sure your repository is public and includes your commit history.
                </p>
              </div>

              {/* Solution Explanation Note (2-3 lines) */}
              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] dark:text-white mb-1.5">
                  How I Solved It (2-3 lines) <span className="text-[#B3122B]">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Briefly explain your thought process, data structures, or styling techniques used..."
                  value={solutionNote}
                  onChange={(e) => setSolutionNote(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-sm text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] transition-colors"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  This note helps faculty assess your logic during random 2-minute vivas.
                </p>
              </div>

              {/* Optional Live Demo Link */}
              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] dark:text-white mb-1.5">
                  Live Demo / Deployment Link (Optional)
                </label>
                <div className="relative">
                  <ExternalLink className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="url"
                    placeholder="https://your-project.vercel.app or GitHub Pages"
                    value={demoLink}
                    onChange={(e) => setDemoLink(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-sm text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] transition-colors"
                  />
                </div>
              </div>

              {/* Honor Code Checkbox */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={honorCode}
                    onChange={(e) => setHonorCode(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded text-[#B3122B] focus:ring-[#B3122B] border-gray-300"
                  />
                  <span className="text-xs text-amber-950 dark:text-amber-200 font-semibold leading-relaxed">
                    Strict Academic Integrity Pledge: <em>"I wrote this code independently without using AI modules (ChatGPT, Claude, Gemini, Copilot, etc.) or external copy-paste tabs. I am prepared to live-code and explain my solution in a mandatory 2-minute faculty viva."</em>
                  </span>
                </label>
              </div>

              {/* Submit Action */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-[#B3122B] hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? "Verifying..." : existingSub ? "Update Submission" : "Submit Day Solution"}</span>
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
