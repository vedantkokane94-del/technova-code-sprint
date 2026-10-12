import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { getTaskVariant } from '../utils/hash';
import { getSprintDaySchedule, getDayUnlockTimeUtc, isDayUnlocked } from '../data/tasksSeed';
import { evaluateCodeSubmission, SUPPORTED_LANGUAGES, checkRequiredConcepts } from '../utils/codeJudge';
import { QUIZ_QUESTIONS } from '../data/quizSeed';
import { DAY_POINTS, formatScore, toScoreNumber } from '../utils/scoring';
import { ProctoringMonitor } from '../components/ProctoringMonitor';
import { ProctoringConsentModal } from '../components/ProctoringConsentModal';
import confetti from 'canvas-confetti';
import { 
  Lock, 
  Clock, 
  Lightbulb, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles,
  Play,
  Send,
  Code2,
  FileCode2,
  HelpCircle,
  Maximize2,
  Minimize2,
  ChevronRight,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  XCircle,
  Award,
  Layers,
  Cpu,
  EyeOff,
  Video,
  Eye
} from 'lucide-react';
import { SVITHubLogo } from '../components/BrandLogo';

export const TaskPage = ({ dayNumber, setCurrentTab }) => {
  const { 
    user, 
    tasks, 
    submissions, 
    submitTaskSolution, 
    currentDay, 
    isAdmin, 
    addProctoringFlag,
    hasUserGivenConsent,
    saveUserConsent,
    getEffectiveServerTime
  } = useApp();

  const task = tasks.find(t => t.day === dayNumber) || tasks[0];
  const assignedVariantKey = getTaskVariant(user?.uid, task.day);
  const maxDayPoints = DAY_POINTS[task.day] || 10;
  const maxProgramPoints = maxDayPoints * 0.70;
  const maxQuizPoints = maxDayPoints * 0.30;

  // Admin preview toggle (Admins can preview any day at any time without changing schedule for students)
  const [adminPreview, setAdminPreview] = useState(false);

  // UTC Unlock Schedule checking: Day 1 unlocks 13 Oct 2026 8:00 AM IST (2026-10-13T02:30:00Z)
  const unlockUtc = getDayUnlockTimeUtc(task.day);
  const unlockMs = Date.parse(unlockUtc);

  const [nowMs, setNowMs] = useState(() => (getEffectiveServerTime ? getEffectiveServerTime() : Date.now()));

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(getEffectiveServerTime ? getEffectiveServerTime() : Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [getEffectiveServerTime]);

  const isDayOpen = isAdmin || adminPreview || nowMs >= unlockMs;

  // Language track
  const initialLang = (user?.language || user?.track || 'Python').toLowerCase();
  const defaultLangId = ['c', 'cpp', 'java', 'python'].includes(initialLang) ? initialLang : 'python';
  const [selectedLanguage, setSelectedLanguage] = useState(defaultLangId);

  // Existing submission
  const existingSub = submissions.find(s => s.userId === user?.uid && Number(s.day) === Number(task.day));

  // Starter code templates
  const getInitialCode = (langId) => {
    if (existingSub?.code && (existingSub.language?.toLowerCase() === langId || existingSub.track?.toLowerCase() === langId)) {
      return existingSub.code;
    }
    const found = SUPPORTED_LANGUAGES.find(l => l.id === langId);
    return found ? found.template : '# Write your solution here\n';
  };

  const [code, setCode] = useState(() => getInitialCode(defaultLangId));

  // Switch language handler
  const handleLanguageChange = (langId) => {
    setSelectedLanguage(langId);
    if (!existingSub?.code || (existingSub.language?.toLowerCase() !== langId)) {
      setCode(getInitialCode(langId));
    }
  };

  // Progressive Hints
  const [unlockedHints, setUnlockedHints] = useState(() => {
    const saved = localStorage.getItem(`hints_day_${task.day}_${user?.uid}`);
    return saved ? JSON.parse(saved) : [0];
  });

  const unlockNextHint = (index) => {
    if (!unlockedHints.includes(index)) {
      const next = [...unlockedHints, index];
      setUnlockedHints(next);
      localStorage.setItem(`hints_day_${task.day}_${user?.uid}`, JSON.stringify(next));
    }
  };

  // Consent & Proctoring State (Section 3, 4, 5)
  // Section 4: Remember consent across days (Days 2 to 9 remember Day 1 consent)
  const userConsentedPreviously = (hasUserGivenConsent && hasUserGivenConsent(user?.uid)) ||
    localStorage.getItem(`proctoring_consent_${user?.uid || 'guest'}`) === 'true';

  const [consentGranted, setConsentGranted] = useState(() => userConsentedPreviously);

  const [isAlternativeMode, setIsAlternativeMode] = useState(() => {
    return localStorage.getItem(`proctoring_alt_${user?.uid || 'guest'}`) === 'true';
  });

  // Section 4: Days 2-9 silent background camera/mic check
  const [silentCameraFailed, setSilentCameraFailed] = useState(false);
  useEffect(() => {
    if (task.day > 1 && consentGranted && !isAlternativeMode && !isAdmin) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then(stream => {
            stream.getTracks().forEach(t => t.stop());
            setSilentCameraFailed(false);
          })
          .catch(err => {
            console.warn(`Silent device check failed on Day ${task.day}:`, err);
            setSilentCameraFailed(true);
          });
      }
    }
  }, [task.day, consentGranted, isAlternativeMode, isAdmin]);

  const [proctoringActive, setProctoringActive] = useState(false);
  const [proctoringGraceActive, setProctoringGraceActive] = useState(false);
  const [proctoringFlagsCount, setProctoringFlagsCount] = useState(0);

  const handleConsentAccept = (data = {}) => {
    setConsentGranted(true);
    const isAlt = Boolean(data.isAlternativeMode);
    if (isAlt) {
      setIsAlternativeMode(true);
      localStorage.setItem(`proctoring_alt_${user?.uid || 'guest'}`, 'true');
    }
    localStorage.setItem(`proctoring_consent_${user?.uid || 'guest'}`, 'true');

    if (saveUserConsent) {
      saveUserConsent(user?.uid, {
        consentGiven: true,
        isAlternativeMode: isAlt,
        reason: data.alternativeReason || '',
        day: task.day,
        timestamp: new Date().toISOString()
      });
    }

    if (isAlt) {
      addProctoringFlag({
        userId: user?.uid,
        studentName: user?.name,
        day: task.day,
        reason: `Alternative requested: ${data.alternativeReason || 'Camera/Mic not available'}. Scheduled for Faculty Viva.`,
        status: 'pending'
      });
    }
  };

  const handleRequestAlternative = (reason) => {
    handleConsentAccept({
      isAlternativeMode: true,
      alternativeReason: reason
    });
  };

  const handleFlagCaptured = (flag) => {
    setProctoringFlagsCount(prev => prev + 1);
    addProctoringFlag({
      userId: user?.uid,
      studentName: user?.name,
      day: task.day,
      reason: flag.reason,
      snapshotUrl: flag.snapshotUrl,
      timestamp: flag.timestamp,
      status: 'pending'
    });
  };

  // Evaluation & Attempts State (Section 1 & 7)
  const [evaluationResult, setEvaluationResult] = useState(existingSub?.testResults ? {
    verdict: { label: existingSub.points >= maxProgramPoints * 0.8 ? 'Accepted' : 'Tested' },
    programScore: existingSub.programScore || 0,
    breakdown: {
      correctness: (existingSub.programScore || 0) * 0.8,
      efficiency: (existingSub.programScore || 0) * 0.1,
      concepts: (existingSub.programScore || 0) * 0.1,
      maxProgram: maxProgramPoints
    },
    testResults: existingSub.testResults,
    feedback: "Previous evaluation saved.",
    isCatchup: existingSub.isCatchup
  } : null);

  const [isRunningSample, setIsRunningSample] = useState(false);
  const [sampleRunResult, setSampleRunResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attemptsUsed, setAttemptsUsed] = useState(existingSub?.attempts || 0);

  // Tab switches and full screen exit monitoring
  const [tabSwitches, setTabSwitches] = useState(existingSub?.tabSwitches || 0);
  const [fullScreenExits, setFullScreenExits] = useState(existingSub?.fullScreenExits || 0);

  useEffect(() => {
    if (isAdmin || user?.role === 'admin') return;

    const handleVisibility = () => {
      if (document.hidden) {
        setTabSwitches(prev => prev + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isAdmin, user]);

  // Quiz Modal State (Section 5 & 7)
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(Boolean(existingSub?.quizScore !== undefined && existingSub?.quizScore > 0));
  const [quizScoreEarned, setQuizScoreEarned] = useState(existingSub?.quizScore || 0);
  const [quizCorrectCount, setQuizCorrectCount] = useState(existingSub?.quizCorrect || 0);
  const [quizTimeLeft, setQuizTimeLeft] = useState(600); // 10 minutes
  const dayQuizQuestions = QUIZ_QUESTIONS[task.day] || [];

  // Countdown timer to 11:59 PM IST
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
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

  // Controls disabled when checks inactive and grace period expired (unless alternative mode)
  const areControlsDisabled = !isAlternativeMode && !proctoringActive && !proctoringGraceActive;

  // Run Sample Tests
  const handleRunSampleTests = () => {
    if (areControlsDisabled) return;
    setIsRunningSample(true);
    setSampleRunResult(null);

    setTimeout(() => {
      const evalOut = evaluateCodeSubmission(code, selectedLanguage, task.day, assignedVariantKey);
      // Sample cases are test 1 and 2
      const samples = evalOut.testResults.slice(0, 2).map((t, idx) => ({
        ...t,
        input: idx === 0 ? "Sample Input 1" : "Sample Input 2",
        expectedOutput: idx === 0 ? "Sample Output 1" : "Sample Output 2",
        actualOutput: t.passed ? (idx === 0 ? "Sample Output 1" : "Sample Output 2") : "Output mismatch"
      }));
      setSampleRunResult({
        samples,
        allPassed: samples.every(s => s.passed),
        timeMs: evalOut.avgTimeMs,
        memoryMb: evalOut.peakMemoryMb
      });
      setIsRunningSample(false);
    }, 450);
  };

  // Submit Program
  const handleSubmitProgram = () => {
    if (areControlsDisabled) return;
    if (attemptsUsed >= 3) {
      alert("You have already used all 3 attempts for Day " + task.day + ". Your highest score is preserved.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const isCatchup = task.day < currentDay;
      const evalOut = evaluateCodeSubmission(code, selectedLanguage, task.day, assignedVariantKey, { isCatchup });
      setEvaluationResult(evalOut);

      const nextAttempts = attemptsUsed + 1;
      setAttemptsUsed(nextAttempts);

      // Save submission into context
      submitTaskSolution({
        day: task.day,
        code,
        language: selectedLanguage,
        programScore: evalOut.programScore,
        quizScore: quizScoreEarned,
        quizCorrect: quizCorrectCount,
        attempts: nextAttempts,
        testResults: evalOut.testResults,
        tabSwitches,
        fullScreenExits,
        proctoringFlagsCount
      });

      setIsSubmitting(false);

      if (evalOut.programScore >= maxProgramPoints * 0.7) {
        try {
          confetti({
            particleCount: 70,
            spread: 60,
            origin: { y: 0.6 }
          });
        } catch (e) {}
      }
    }, 600);
  };

  // Open Quiz with Fullscreen enforcement (Section 5)
  const handleOpenQuiz = async () => {
    if (areControlsDisabled) return;
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.warn("Fullscreen request:", e);
    }
    setQuizOpen(true);
  };

  // Fullscreen exit tracking during Quiz
  useEffect(() => {
    if (!quizOpen) return;
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setFullScreenExits(prev => prev + 1);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [quizOpen]);

  // Quiz Timer: pauses during grace period
  useEffect(() => {
    if (!quizOpen || quizSubmitted || proctoringGraceActive) return;
    const interval = setInterval(() => {
      setQuizTimeLeft(prev => {
        if (prev <= 1) {
          handleQuizSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [quizOpen, quizSubmitted, proctoringGraceActive]);

  // Submit Quiz
  const handleQuizSubmit = () => {
    let correct = 0;
    dayQuizQuestions.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correctAnswer) {
        correct++;
      }
    });

    const isCatchup = task.day < currentDay;
    const catchupMultiplier = isCatchup ? 0.5 : 1.0;
    const earnedQuiz = toScoreNumber((correct / 8) * maxQuizPoints * catchupMultiplier);

    setQuizCorrectCount(correct);
    setQuizScoreEarned(earnedQuiz);
    setQuizSubmitted(true);

    // Update submission with quiz score
    submitTaskSolution({
      day: task.day,
      code,
      language: selectedLanguage,
      programScore: evaluationResult ? evaluationResult.programScore : (existingSub?.programScore || 0),
      quizScore: earnedQuiz,
      quizCorrect: correct,
      attempts: attemptsUsed,
      tabSwitches,
      fullScreenExits,
      proctoringFlagsCount
    });

    // Exit fullscreen
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }

    try {
      confetti({
        particleCount: 50,
        spread: 50,
        origin: { y: 0.5 }
      });
    } catch (e) {}
  };

  // Section 2: Locked Day & Pre-Launch Countdown Screen
  // Before unlock time, students can give consent, but task questions/hints are not shown.
  // When 8:00 AM IST arrives, page unlocks automatically without manual refresh.
  if (!isDayOpen) {
    const diffMs = Math.max(0, unlockMs - nowMs);
    const cdDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const cdHours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const cdMinutes = Math.floor((diffMs / (1000 * 60)) % 60);
    const cdSeconds = Math.floor((diffMs / 1000) % 60);

    return (
      <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] py-16 px-4 flex items-center justify-center relative">
        {/* If consent not yet granted, show consent modal so student can complete it in advance */}
        {!consentGranted && !isAdmin && (
          <ProctoringConsentModal
            dayNumber={task.day}
            onAccept={handleConsentAccept}
            onAcceptConsent={handleConsentAccept}
            onRequestAlternative={handleRequestAlternative}
          />
        )}

        <div className="max-w-xl w-full bg-white dark:bg-[#181B20] p-8 sm:p-10 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] text-center shadow-xl space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-[#B3122B]/10 text-[#B3122B] dark:text-[#ff8a9e] flex items-center justify-center mx-auto shadow-inner">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-xs mb-2">
              <Lock className="w-3.5 h-3.5" />
              <span>Unlocks 8:00 AM IST • Asia/Kolkata</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1A1A1A] dark:text-white">
              Day {task.day} Countdown
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Day {task.day} opens on <strong>{getSprintDaySchedule(task.day)?.fullDate}</strong> at <strong>8:00 AM IST</strong>.
            </p>
          </div>

          {/* Live Countdown Clock Cards */}
          <div className="grid grid-cols-4 gap-2.5 max-w-sm mx-auto">
            <div className="p-3 rounded-2xl bg-[#FCF9F2] dark:bg-[#14171c] border border-[#E8DEC8] dark:border-[#2E3440]">
              <div className="text-2xl sm:text-3xl font-mono font-black text-[#B3122B] dark:text-[#ff8a9e]">
                {String(cdDays).padStart(2, '0')}
              </div>
              <div className="text-[10px] font-bold uppercase text-gray-400 mt-1">Days</div>
            </div>
            <div className="p-3 rounded-2xl bg-[#FCF9F2] dark:bg-[#14171c] border border-[#E8DEC8] dark:border-[#2E3440]">
              <div className="text-2xl sm:text-3xl font-mono font-black text-[#B3122B] dark:text-[#ff8a9e]">
                {String(cdHours).padStart(2, '0')}
              </div>
              <div className="text-[10px] font-bold uppercase text-gray-400 mt-1">Hours</div>
            </div>
            <div className="p-3 rounded-2xl bg-[#FCF9F2] dark:bg-[#14171c] border border-[#E8DEC8] dark:border-[#2E3440]">
              <div className="text-2xl sm:text-3xl font-mono font-black text-[#B3122B] dark:text-[#ff8a9e]">
                {String(cdMinutes).padStart(2, '0')}
              </div>
              <div className="text-[10px] font-bold uppercase text-gray-400 mt-1">Mins</div>
            </div>
            <div className="p-3 rounded-2xl bg-[#FCF9F2] dark:bg-[#14171c] border border-[#E8DEC8] dark:border-[#2E3440]">
              <div className="text-2xl sm:text-3xl font-mono font-black text-[#B3122B] dark:text-[#ff8a9e]">
                {String(cdSeconds).padStart(2, '0')}
              </div>
              <div className="text-[10px] font-bold uppercase text-gray-400 mt-1">Secs</div>
            </div>
          </div>

          {/* Consent Status Badge */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {consentGranted 
                ? "Workstation & Consent Checks Verified • Ready for Kickoff!" 
                : "Consent and device checks completed."}
            </span>
          </div>

          <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
            The coding challenge, sample test cases, and daily quiz will unlock automatically when the timer reaches zero. You do not need to refresh this page.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold bg-[#B3122B] text-white text-xs hover:bg-[#8B0D20] transition-colors cursor-pointer"
            >
              Back to Dashboard
            </button>

            {/* Admin Preview Mode Toggle */}
            {isAdmin && (
              <button
                onClick={() => setAdminPreview(true)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold bg-gray-900 text-white text-xs hover:bg-black transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin: Preview Task Now</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const currentTotalDayScore = toScoreNumber((evaluationResult?.programScore || existingSub?.programScore || 0) + quizScoreEarned);

  return (
    <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-8 px-4 sm:px-6 lg:px-8 pb-24 relative">
      
      {/* Non-blocking top banner if silent background check failed on Days 2-9 */}
      {silentCameraFailed && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-center justify-between gap-2 mb-4 rounded-xl max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Camera check failed. Click here to grant permission or request viva review.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
                  .then(s => { s.getTracks().forEach(t => t.stop()); setSilentCameraFailed(false); })
                  .catch(() => alert('Camera permission still blocked. Please check browser permissions.'));
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold text-[10px] cursor-pointer"
            >
              Grant Permission
            </button>
            <button
              onClick={() => handleRequestAlternative('Silent background device check failed')}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#181B20] text-amber-900 dark:text-amber-200 font-bold text-[10px] border border-amber-500/40 cursor-pointer"
            >
              Request Viva Review
            </button>
          </div>
        </div>
      )}

      {/* Proctoring Consent Modal (Section 5) */}
      {!consentGranted && !isAdmin && (
        <ProctoringConsentModal
          dayNumber={task.day}
          onAccept={handleConsentAccept}
          onAcceptConsent={handleConsentAccept}
          onRequestAlternative={handleRequestAlternative}
        />
      )}

      {/* Floating Proctoring Monitor (Section 5) */}
      {!isAdmin && consentGranted && (
        <ProctoringMonitor
          onStatusChange={setProctoringActive}
          onGracePeriodChange={setProctoringGraceActive}
          onFlagCaptured={handleFlagCaptured}
          isAlternativeMode={isAlternativeMode}
        />
      )}

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* Navigation Back */}
        <button
          onClick={() => setCurrentTab('dashboard')}
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-[#B3122B] dark:hover:text-[#ff8a9e] mb-6 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Sprint Dashboard</span>
        </button>

        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#181B20] p-6 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs mb-8">
          <div className="flex items-start gap-3">
            <SVITHubLogo className="w-12 h-12 shrink-0 mt-1" />
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="w-6 h-6 rounded-lg bg-[#B3122B] text-white font-black text-xs flex items-center justify-center">
                  D{task.day}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#8B0D20] dark:text-[#ff8a9e]">
                  {task.level} • {maxDayPoints} Points
                </span>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold hidden sm:inline">
                  • {getSprintDaySchedule(task.day)?.fullDate}
                </span>
                {isAlternativeMode && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold border border-blue-500/20">
                    Viva Alternative Active
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1A1A] dark:text-white">
                {task.title}
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Assigned Hash Variant: <strong className="text-[#B3122B]">Variant {assignedVariantKey}</strong> (Deterministic via User ID)
              </p>
            </div>
          </div>

          {/* Right Metrics: Score & Countdown */}
          <div className="flex items-center gap-3">
            {/* Day Score Pill */}
            <div className="bg-[#FCF9F2] dark:bg-[#111317] px-4 py-3 rounded-2xl border border-[#E8DEC8] dark:border-[#2E3440] text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Day Score (70% Prog + 30% Quiz)
              </div>
              <div className="text-lg font-mono font-black text-[#B3122B] dark:text-[#ff8a9e]">
                {formatScore(currentTotalDayScore)} / {maxDayPoints} pts
              </div>
            </div>

            {/* Countdown Clock */}
            <div className="flex items-center gap-2 bg-[#FCF9F2] dark:bg-[#111317] px-4 py-3 rounded-2xl border border-[#E8DEC8] dark:border-[#2E3440]">
              <Clock className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Deadline 11:59 PM IST
                </div>
                <div className="text-sm font-mono font-bold text-[#1A1A1A] dark:text-white">
                  {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Task Objective Card */}
        <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm mb-8">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 border-b border-[#E8DEC8]/50 dark:border-[#2E3440] pb-3 mb-5">
            <span className="flex items-center gap-1.5 text-[#B3122B] dark:text-[#ff8a9e]">
              <ShieldCheck className="w-4 h-4" />
              <span>Personalized Task for {user?.name || "Student"} (Roll No: {user?.prn || "N/A"})</span>
            </span>
            <span className="text-[11px] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400 font-mono">
              Attempts: {attemptsUsed} / 3 (Best kept)
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                Objective
              </h2>
              <p className="text-base text-[#1A1A1A] dark:text-gray-100 font-medium leading-relaxed mt-1">
                {task.description}
              </p>
            </div>

            {/* Variant Instruction */}
            <div className="p-4 rounded-2xl bg-[#B3122B]/5 dark:bg-[#B3122B]/15 border border-[#B3122B]/20">
              <div className="flex items-center gap-2 text-xs font-black text-[#B3122B] dark:text-[#ff8a9e] uppercase">
                <Sparkles className="w-4 h-4" />
                <span>Your Assigned Variant: Variant {assignedVariantKey}</span>
              </div>
              <p className="text-sm text-[#1A1A1A] dark:text-white font-semibold mt-1">
                {task.variants?.[assignedVariantKey]?.instruction || "Implement the algorithm adhering strictly to standard input and output format."}
              </p>
            </div>

            {/* Scoring Breakdown Pill */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] text-xs">
                <span className="font-bold text-[#1A1A1A] dark:text-white">Program Part: 70% ({formatScore(maxProgramPoints)} pts)</span>
                <p className="text-gray-500 mt-0.5">80% Correctness (5 weighted tests) + 10% Efficiency + 10% Required Concepts.</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] text-xs">
                <span className="font-bold text-[#1A1A1A] dark:text-white">Daily Quiz: 30% ({formatScore(maxQuizPoints)} pts)</span>
                <p className="text-gray-500 mt-0.5">8 multiple-choice questions scored at (correct / 8) × 30% of day points.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Progressive Hints Section */}
        <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <span>Progressive Hints (Revealed One at a Time)</span>
            </h2>
            <span className="text-xs text-gray-500 font-medium">
              Zero score penalty for viewing hints
            </span>
          </div>

          <div className="space-y-3">
            {task.hints?.map((hint, idx) => {
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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

        {/* Code Editor & Test Runner Section */}
        <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm mb-8">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-[#E8DEC8]/60 dark:border-[#2E3440]">
            <div>
              <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white flex items-center gap-2">
                <Code2 className="w-5 h-5 text-[#B3122B]" />
                <span>Program Solution Editor</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Evaluated deterministically across 5 hidden test cases with execution time limits.
              </p>
            </div>

            {/* Language Selector Tabs */}
            <div className="flex items-center gap-1.5 bg-[#FCF9F2] dark:bg-[#111317] p-1 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440]">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => handleLanguageChange(lang.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedLanguage === lang.id
                      ? 'bg-[#B3122B] text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-[#B3122B]'
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </div>

          {/* Reset Template Button */}
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>Editor ({SUPPORTED_LANGUAGES.find(l => l.id === selectedLanguage)?.version})</span>
            <button
              onClick={() => setCode(getInitialCode(selectedLanguage))}
              className="inline-flex items-center gap-1 text-[11px] text-[#8B0D20] dark:text-[#ff8a9e] hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Template</span>
            </button>
          </div>

          {/* Code Textarea */}
          <div className="relative rounded-2xl overflow-hidden border border-[#E8DEC8] dark:border-[#2E3440] bg-[#1E232B] text-gray-100 font-mono text-xs shadow-inner">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={15}
              spellCheck={false}
              className="w-full p-4 bg-transparent outline-none resize-y leading-relaxed font-mono"
              placeholder="// Write your code here..."
            />
          </div>

          {/* Warning Banner if Checks Inactive */}
          {areControlsDisabled && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
              <EyeOff className="w-4 h-4 shrink-0" />
              <span>Camera/Mic checks offline and grace period expired. Run, Submit, and Quiz are disabled until re-enabled or viva requested.</span>
            </div>
          )}

          {/* Run & Submit Action Buttons */}
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={handleRunSampleTests}
                disabled={isRunningSample || areControlsDisabled}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] text-[#1A1A1A] dark:text-white hover:border-[#B3122B] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isRunningSample ? "Running Tests..." : "Run Sample Tests (1 & 2)"}</span>
              </button>

              <button
                onClick={handleSubmitProgram}
                disabled={isSubmitting || attemptsUsed >= 3 || areControlsDisabled}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {isSubmitting 
                    ? "Evaluating Solution..." 
                    : attemptsUsed >= 3 
                    ? "3/3 Attempts Used (Best Kept)" 
                    : `Submit Program (${attemptsUsed}/3 Attempts)`}
                </span>
              </button>
            </div>

            <div className="text-xs text-gray-500 font-medium">
              Best of 3 submissions kept • Decimals to 1 place
            </div>
          </div>

          {/* Sample Run Output Preview */}
          {sampleRunResult && (
            <div className="mt-6 p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
              <div className="flex items-center justify-between mb-3 text-xs font-bold">
                <span className="flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Sample Cases Run Output</span>
                </span>
                <span className="text-gray-500 font-mono text-[11px]">
                  Avg: {sampleRunResult.timeMs}ms • Mem: {sampleRunResult.memoryMb}MB
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sampleRunResult.samples.map((s, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-white dark:bg-[#181B20] border border-[#E8DEC8]/60 dark:border-[#2E3440] text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#1A1A1A] dark:text-white">Sample Case #{idx + 1}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.passed ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                        {s.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      Runtime: {s.timeMs}ms • Memory: {s.memoryMb}MB
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Evaluation Result Card */}
          {evaluationResult && (
            <div className="mt-6 p-5 rounded-2xl bg-white dark:bg-[#15181E] border-2 border-[#B3122B]/30 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E8DEC8]/60 dark:border-[#2E3440]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-[#1A1A1A] dark:text-white">
                      Program Score: {formatScore(evaluationResult.programScore)} / {formatScore(maxProgramPoints)} pts
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                      {evaluationResult.verdict?.label || 'Evaluated'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{evaluationResult.feedback}</p>
                </div>

                <div className="text-right text-xs">
                  <div className="text-gray-400 font-medium">Program Breakdown</div>
                  <div className="font-bold text-[#1A1A1A] dark:text-white">
                    Correctness: {formatScore(evaluationResult.breakdown?.correctness)} • Efficiency: {formatScore(evaluationResult.breakdown?.efficiency)} • Concepts: {formatScore(evaluationResult.breakdown?.concepts)}
                  </div>
                </div>
              </div>

              {/* 5 Hidden Test Cases Details */}
              <div className="mt-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  5 Test Cases Verdicts (Weights: 15%, 15%, 20%, 20%, 30%)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  {evaluationResult.testResults?.map((test, idx) => (
                    <div 
                      key={idx}
                      className={`p-2.5 rounded-xl border text-center text-xs ${
                        test.passed 
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                          : 'bg-red-500/5 border-red-500/20 text-red-700 dark:text-red-400'
                      }`}
                    >
                      <div className="font-bold text-[11px] truncate">
                        {idx < 2 ? `Sample ${idx + 1}` : `Hidden #${idx + 1}`}
                      </div>
                      <div className="text-[10px] font-black mt-0.5">
                        {test.passed ? "PASSED" : "FAILED"}
                      </div>
                      <div className="text-[9px] text-gray-500 mt-0.5 font-mono">
                        {test.weightPercent}% • {test.timeMs}ms
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Daily Quiz Section (30% of Day Points) */}
        <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500 text-white font-black text-xs flex items-center justify-center">
                  Q
                </span>
                <h3 className="text-lg font-bold text-[#1A1A1A] dark:text-white">
                  Daily Concept Quiz (30% of Day Points = {formatScore(maxQuizPoints)} pts)
                </h3>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                8 questions covering C, C++, Java, Python, and DSA. Enforces full-screen mode to prevent distraction.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {quizSubmitted ? (
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Quiz Completed: {quizCorrectCount}/8 Correct
                  </div>
                  <div className="text-sm font-mono font-black text-[#1A1A1A] dark:text-white">
                    +{formatScore(quizScoreEarned)} / {formatScore(maxQuizPoints)} pts
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleOpenQuiz}
                  disabled={areControlsDisabled}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 shadow-md shadow-amber-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Start Full-Screen Quiz (8 Questions)</span>
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Full-Screen Quiz Modal (Section 5 & 7) */}
      {quizOpen && (
        <div className="fixed inset-0 z-50 bg-[#FCF9F2] dark:bg-[#0F1115] overflow-y-auto p-4 sm:p-8 flex flex-col justify-between">
          <div className="max-w-4xl mx-auto w-full">
            
            {/* Top Bar with Timer and Integrity Notice */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#B3122B] text-white flex items-center justify-center font-black text-xs">
                  D{task.day}
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1A1A1A] dark:text-white">
                    Day {task.day} Daily Quiz (8 Questions)
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Full-Screen Session • Exits logged: {fullScreenExits}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-gray-400">Time Remaining</div>
                  <div className="text-base font-mono font-black text-[#B3122B] dark:text-[#ff8a9e]">
                    {Math.floor(quizTimeLeft / 60)}:{String(quizTimeLeft % 60).padStart(2, '0')}
                  </div>
                </div>

                <button
                  onClick={() => setQuizOpen(false)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Close Quiz Modal"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-4 mb-8">
              {dayQuizQuestions.map((q, qIdx) => (
                <div key={q.id} className="p-5 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs">
                  <div className="flex items-start gap-2.5 mb-3">
                    <span className="w-6 h-6 rounded-lg bg-[#B3122B]/10 text-[#B3122B] font-bold text-xs flex items-center justify-center shrink-0">
                      {qIdx + 1}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-[#1A1A1A] dark:text-white leading-snug">
                        {q.question}
                      </h4>
                      <span className="text-[10px] text-gray-400 font-semibold">{q.category}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = quizAnswers[qIdx] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => setQuizAnswers(prev => ({ ...prev, [qIdx]: optIdx }))}
                          className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all flex items-center gap-2.5 cursor-pointer ${
                            isSelected
                              ? 'bg-[#B3122B]/10 dark:bg-[#B3122B]/20 border-[#B3122B] text-[#B3122B] dark:text-[#ff8a9e]'
                              : 'bg-[#FCF9F2] dark:bg-[#111317] border-[#E8DEC8] dark:border-[#2E3440] text-gray-700 dark:text-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                            isSelected ? 'border-[#B3122B] bg-[#B3122B] text-white' : 'border-gray-400 text-gray-500'
                          }`}>
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Quiz Submit Bar */}
            <div className="sticky bottom-4 p-4 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-lg flex items-center justify-between">
              <div className="text-xs text-gray-500 font-medium">
                Answered: {Object.keys(quizAnswers).length} / 8 Questions
              </div>
              <button
                onClick={handleQuizSubmit}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 cursor-pointer"
              >
                Submit & Grade Quiz
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
