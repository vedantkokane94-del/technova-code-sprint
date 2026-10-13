import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { computeUserSummary, formatScore } from '../utils/scoring';
import { getTaskVariant } from '../utils/hash';
import { getSprintDaySchedule, TASKS } from '../data/tasksSeed';
import { DAY_POINTS } from '../utils/scoring';
import { 
  Flame, 
  Trophy, 
  Award, 
  CheckCircle2, 
  Lock, 
  Clock, 
  AlertCircle, 
  ArrowRight, 
  RotateCcw, 
  Sparkles,
  ChevronRight,
  ShieldAlert,
  Play,
  Send,
  HelpCircle,
  X
} from 'lucide-react';

export const DashboardPage = ({ setCurrentTab, setSelectedDay }) => {
  const { user, tasks, submissions, currentDay, setSprintDay, manualOverrides } = useApp();

  const [tipDismissed, setTipDismissed] = useState(() => {
    return localStorage.getItem('technova_tip_dismissed') === 'true';
  });

  const handleDismissTip = () => {
    setTipDismissed(true);
    localStorage.setItem('technova_tip_dismissed', 'true');
  };

  const taskList = (tasks && tasks.length > 0) ? tasks : TASKS;

  // Filter submissions by current user (matching uid or prn)
  const normUserPrn = String(user?.prn || '').trim().toUpperCase();
  const userSubmissions = submissions.filter(
    s => s.userId === user?.uid || (normUserPrn && String(s.prn || '').trim().toUpperCase() === normUserPrn)
  );
  const summary = computeUserSummary(userSubmissions, manualOverrides[user?.uid] ?? manualOverrides[normUserPrn]);

  // Compute User Rank across all unique users (Leaderboard tie-breaking logic)
  const allUserMap = {};
  submissions.forEach(sub => {
    const key = String(sub.prn || '').trim().toUpperCase() || sub.userId;
    if (!key) return;
    if (!allUserMap[key]) {
      allUserMap[key] = [];
    }
    allUserMap[key].push(sub);
  });

  const rankedUsers = Object.entries(allUserMap).map(([key, subs]) => ({
    key,
    summary: computeUserSummary(subs)
  })).sort((a, b) => {
    if (b.summary.totalScore !== a.summary.totalScore) {
      return b.summary.totalScore - a.summary.totalScore;
    }
    if (b.summary.onTimeCount !== a.summary.onTimeCount) {
      return b.summary.onTimeCount - a.summary.onTimeCount;
    }
    return (a.summary.lastSubmissionTime || Infinity) - (b.summary.lastSubmissionTime || Infinity);
  });

  const userRankIndex = rankedUsers.findIndex(u => u.key === normUserPrn || u.key === user?.uid);
  const userRank = userRankIndex >= 0 ? userRankIndex + 1 : rankedUsers.length + 1;

  // Handler to open task page for a specific day
  const handleOpenDay = (day) => {
    setSelectedDay(day);
    setCurrentTab('task');
  };

  // Status badge styling helper
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Passed':
        return {
          bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-500',
          label: 'Passed (Eligible for Certificate)'
        };
      case 'Pending review':
        return {
          bg: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30',
          dot: 'bg-orange-500',
          label: 'Pending Review (Faculty Viva Required)'
        };
      case 'Pass mark not reached':
        return {
          bg: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
          dot: 'bg-red-500',
          label: 'Pass Mark Not Reached'
        };
      case 'Below pass mark':
        return {
          bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
          dot: 'bg-amber-500',
          label: 'Below Pass Mark (< 50 pts)'
        };
      case 'On track':
      default:
        return {
          bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
          dot: 'bg-blue-500',
          label: 'On Track'
        };
    }
  };

  const statusConfig = getStatusBadge(summary.progressStatus);

  // If user is not yet registered or is suspended, block dashboard access
  if (!user || user.suspended) {
    const isSuspended = Boolean(user?.suspended || user?.accountStatus === 'suspended');
    return (
      <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-16 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#B3122B]/10 text-[#B3122B] flex items-center justify-center mx-auto mb-4">
            {isSuspended ? <ShieldAlert className="w-8 h-8" /> : <Sparkles className="w-8 h-8" />}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#1A1A1A] dark:text-white">
            {isSuspended ? 'Account Suspended' : 'Student Registration Required'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-2 mb-6">
            {isSuspended
              ? 'Your account has been suspended by the event administrator. Please contact the SVIT Technical Skill Development Hub.'
              : 'Welcome to Technova Code Sprint! Please complete your SVIT student registration to unlock your daily 9-day coding challenges and start building.'}
          </p>
          {!isSuspended && (
            <button
              onClick={() => setCurrentTab('register')}
              className="w-full py-3.5 px-6 rounded-xl font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] text-sm flex items-center justify-center gap-2 shadow-md shadow-[#B3122B]/20 transition-all cursor-pointer"
            >
              <span>Register Student Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Calculate progress percentage out of 100
  const progressPercent = Math.min(100, Math.max(0, (summary.totalScore / 100) * 100));

  // Determine Today's task and progress button
  const todayDay = currentDay > 0 ? currentDay : 1;
  const todayTask = taskList.find(t => t.day === todayDay) || taskList[0];
  const todaySub = userSubmissions.find(s => Number(s.day) === Number(todayDay));
  const todayPoints = DAY_POINTS[todayDay] || todayTask?.points || 10;
  const todayVariant = getTaskVariant(user?.uid, todayDay);

  let todayButtonText = 'Start';
  if (todaySub?.quizSubmitted || (todaySub?.programScore !== undefined && todaySub?.attempts >= 3)) {
    todayButtonText = 'View result';
  } else if (todaySub || sessionStorage.getItem(`technova_draft_code_day_${todayDay}_${user?.uid}_${(user?.language || 'python').toLowerCase()}`)) {
    todayButtonText = 'Continue';
  }

  return (
    <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-8 px-4 sm:px-6 lg:px-8 pb-24">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Top Header & Greeting */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-[#B3122B]/10 dark:bg-[#B3122B]/20 text-[#B3122B] dark:text-[#ff8a9e]">
                {user?.language || user?.track || "Python"} Track • {user?.year || "SE"} {user?.division ? `• Div ${user.division}` : ''}
              </span>
              <span className="text-xs font-mono text-gray-500">
                Roll No: {user?.prn || ""}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="w-3 h-3" />
                SVIT Student ({user?.branch || 'COMP'})
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1A1A] dark:text-white mt-1">
              Welcome, {user?.name}! 👋
            </h1>
            <p className="text-xs sm:text-sm text-[#6b6375] dark:text-[#94a3b8] mt-0.5">
              Sprint active from <span className="font-semibold text-[#1A1A1A] dark:text-white">14 Oct to 22 Oct 2026</span>. Active Sprint Day: <span className="font-bold text-[#B3122B] dark:text-[#ff8a9e]">Day {todayDay} of 9 ({getSprintDaySchedule(todayDay)?.dateStr})</span>
            </p>
          </div>

          {/* Quick Simulation Control: Advance / Set Sprint Day */}
          <div className="flex items-center gap-2 self-start md:self-auto bg-white dark:bg-[#181B20] p-1.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] text-xs">
            <span className="text-gray-500 px-2 font-medium">Sprint Day:</span>
            {[1, 2, 3, 5, 9].map((d) => (
              <button
                key={d}
                onClick={() => setSprintDay(d)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  currentDay === d 
                    ? 'bg-[#B3122B] text-white shadow-xs' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-[#FCF9F2] dark:hover:bg-[#252A34]'
                }`}
              >
                Day {d}
              </button>
            ))}
          </div>
        </div>

        {/* 2.1 Top Summary Section: Large "Today" Card & Progress Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Large "Today" Card */}
          <div className="lg:col-span-7 bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 border-2 border-[#B3122B]/30 shadow-md flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-[#B3122B] text-white font-extrabold text-xs">
                    Day {todayDay} of 9
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8B0D20] dark:text-[#ff8a9e]">
                    {todayTask.level} • {todayPoints} Points Available
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#B3122B]/10 dark:bg-[#B3122B]/20 text-[#B3122B] dark:text-[#ff8a9e] text-xs font-bold border border-[#B3122B]/20">
                  Your version: {todayVariant}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1A1A1A] dark:text-white leading-tight">
                {todayTask.title}
              </h2>

              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Closes today at 11:59 PM • {getSprintDaySchedule(todayDay)?.fullDate}</span>
              </div>
            </div>

            {/* Action CTA Button (At least 44px height for touch accessibility) */}
            <div className="mt-6 pt-5 border-t border-[#E8DEC8]/60 dark:border-[#2E3440] flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="text-xs text-gray-500 font-medium">
                {todaySub ? (
                  <span>Score recorded: <strong className="text-[#B3122B] dark:text-[#ff8a9e]">{formatScore(todaySub.points)} / {todayPoints} pts</strong></span>
                ) : (
                  <span>Earn up to {todayPoints} points (70% Program + 30% Daily Quiz)</span>
                )}
              </div>

              <button
                onClick={() => handleOpenDay(todayDay)}
                className="w-full sm:w-auto min-h-[44px] h-12 px-8 rounded-xl font-extrabold text-sm bg-[#B3122B] text-white hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{todayButtonText}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress Ring & Certificate Status Card */}
          <div className="lg:col-span-5 bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Sprint Certificate Progress
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusConfig.bg}`}>
                  <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`}></span>
                  <span>{statusConfig.label}</span>
                </span>
              </div>

              <div className="flex items-baseline justify-between mb-1">
                <div className="text-3xl font-black text-[#1A1A1A] dark:text-white">
                  {formatScore(summary.totalScore)} <span className="text-lg font-bold text-gray-400">/ 100 pts</span>
                </div>
                <div className="text-sm font-bold text-[#B3122B] dark:text-[#ff8a9e]">
                  {summary.completedCount} of 9 days done
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Pass mark: <strong>50 points to earn your certificate</strong>. Completing all 9 days is not required.
              </p>

              {/* Progress Bar with Pass Mark indicator at 50% */}
              <div className="relative pt-6 pb-2 mt-2">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    50 Pts Pass
                  </span>
                  <div className="w-0.5 h-3 bg-amber-500 mt-0.5"></div>
                </div>

                <div className="w-full h-3.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden p-0.5 border border-[#E8DEC8]/50 dark:border-[#2E3440]">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      summary.totalScore >= 50
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600'
                        : 'bg-gradient-to-r from-[#B3122B] to-amber-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>

                <div className="flex justify-between items-center text-[11px] font-bold text-gray-400 mt-2">
                  <span>0 pts</span>
                  <span className="text-amber-600 dark:text-amber-400 font-extrabold">50 pts (Certificate)</span>
                  <span>100 pts</span>
                </div>
              </div>
            </div>

            {/* Badges strip */}
            <div className="mt-4 pt-3 border-t border-[#E8DEC8]/50 dark:border-[#2E3440] flex items-center justify-between text-xs">
              <span className="text-gray-500">Earned Badges:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {summary.badges?.length > 0 ? (
                  summary.badges.map(b => (
                    <span key={b.id} title={b.description} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 font-bold text-[11px]">
                      <span>{b.icon}</span>
                      <span>{b.label}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400 italic text-[11px]">Solve tasks to earn badges</span>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Stats Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* Total Points */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs flex items-center gap-3.5 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-[#1A1A1A] dark:text-white">
                {formatScore(summary.totalScore)} / 100
              </div>
              <div className="text-xs font-semibold text-[#6b6375] dark:text-[#94a3b8]">
                Points Earned (Pass: 50)
              </div>
            </div>
          </div>

          {/* On-Time Days */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs flex items-center gap-3.5 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-red-500/10 text-[#B3122B] flex items-center justify-center font-bold shrink-0">
              <Flame className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-[#B3122B]">
                {summary.onTimeCount} Days
              </div>
              <div className="text-xs font-semibold text-[#6b6375] dark:text-[#94a3b8]">
                On-Time Submissions
              </div>
            </div>
          </div>

          {/* Current Rank */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs flex items-center gap-3.5 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold shrink-0">
              <Award className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-[#1A1A1A] dark:text-white">
                #{userRank}
              </div>
              <div className="text-xs font-semibold text-[#6b6375] dark:text-[#94a3b8]">
                Leaderboard Rank
              </div>
            </div>
          </div>

          {/* Completed Submissions */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs flex items-center gap-3.5 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-[#1A1A1A] dark:text-white">
                {summary.completedCount} / 9
              </div>
              <div className="text-xs font-semibold text-[#6b6375] dark:text-[#94a3b8]">
                Days Completed
              </div>
            </div>
          </div>

        </div>

        {/* Dismissible Tip Banner (Requirement 2.2) */}
        {!tipDismissed && (
          <div className="p-4 rounded-2xl bg-white dark:bg-[#181B20] border border-amber-500/30 text-amber-950 dark:text-amber-200 flex items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xs sm:text-sm">
                <span className="font-bold text-[#1A1A1A] dark:text-white">Sprint Tip: </span>
                Need more points? Catch up on any past missed day until 11:59 PM IST on 22 Oct 2026 to earn 50% points and reach the 50-point pass mark!
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setCurrentTab('leaderboard')}
                className="hidden sm:inline-flex text-xs font-bold text-[#B3122B] dark:text-[#ff8a9e] hover:underline items-center gap-1 cursor-pointer"
              >
                <span>Leaderboard</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDismissTip}
                aria-label="Dismiss tip"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:bg-gray-800 transition-colors cursor-pointer"
                title="Dismiss tip"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 2.2 The Nine-Day List: 1 column on mobile, max 2 columns on desktop */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-extrabold text-[#1A1A1A] dark:text-white">
                Sprint Checklist (9 Days to Build)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Complete daily programs & concept quizzes. Solid card backgrounds ensure high contrast.
              </p>
            </div>
            <span className="text-xs text-gray-500 font-medium hidden sm:inline">
              1 column mobile • 2 columns desktop
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {taskList.map((task) => {
              const sub = userSubmissions.find(s => Number(s.day) === Number(task.day));
              const isSubmitted = !!sub;
              const isOpen = task.day === currentDay;
              const isMissed = task.day < currentDay && !sub;
              const isLocked = task.day > currentDay;
              const taskPoints = DAY_POINTS[task.day] || task.points;
              const assignedVariantLetter = getTaskVariant(user?.uid, task.day);

              // Locked Row: Minimal representation as requested
              if (isLocked) {
                return (
                  <div
                    key={task.day}
                    className="bg-white dark:bg-[#181B20] rounded-2xl p-4 sm:p-5 border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs flex items-center justify-between opacity-75"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center font-black text-xs shrink-0">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-500">Day {task.day}</div>
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Opens {getSprintDaySchedule(task.day)?.dateStr} at 8:00 AM IST
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-500">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Locked</span>
                    </span>
                  </div>
                );
              }

              // Open Row: Clean, no dense descriptions, 4-step checklist & action
              return (
                <div
                  key={task.day}
                  className={`bg-white dark:bg-[#181B20] rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                    isOpen
                      ? 'border-[#B3122B] shadow-md ring-2 ring-[#B3122B]/20'
                      : isSubmitted
                      ? 'border-emerald-500/40 shadow-xs'
                      : 'border-amber-500/30 shadow-xs'
                  }`}
                >
                  <div>
                    {/* Header: Title, Level chip, Points, Status Icon + Label */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-start gap-3">
                        <span className={`w-9 h-9 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                          isOpen 
                            ? 'bg-[#B3122B] text-white shadow-xs' 
                            : isSubmitted
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-600 text-white'
                        }`}>
                          D{task.day}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#8B0D20] dark:text-[#ff8a9e]">
                              {task.level}
                            </span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                              {taskPoints} pts
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-[#1A1A1A] dark:text-white leading-snug">
                            {task.title}
                          </h3>
                        </div>
                      </div>

                      {/* Status Icon + Text Label (Never color alone) */}
                      <div>
                        {isSubmitted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Done ({formatScore(sub.points)} pts)</span>
                          </span>
                        ) : isOpen ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#B3122B]/10 text-[#B3122B] dark:text-[#ff8a9e] text-xs font-bold animate-pulse">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Today</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs font-bold">
                            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                            <span>Catch-up</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Variant chip: 'Your version: A, B or C' */}
                    <div className="mt-2.5 mb-3 flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-[#B3122B]/10 dark:bg-[#B3122B]/20 text-[#B3122B] dark:text-[#ff8a9e] text-[11px] font-bold border border-[#B3122B]/20">
                        Your version: {assignedVariantLetter}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {getSprintDaySchedule(task.day)?.dateStr}
                      </span>
                    </div>

                    {/* 4-Step Checklist on open row (Requirement 2.2) */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-[#FCF9F2] dark:bg-[#14171C] border border-[#E8DEC8] dark:border-[#2E3440] text-xs mb-3">
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                        <span className="truncate">1. Read task</span>
                      </div>
                      <div className={`flex items-center gap-1.5 font-semibold ${
                        isSubmitted ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {isSubmitted ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <Play className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                        )}
                        <span className="truncate">2. Write & run code</span>
                      </div>
                      <div className={`flex items-center gap-1.5 font-semibold ${
                        isSubmitted ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {isSubmitted ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <Send className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                        )}
                        <span className="truncate">3. Submit program</span>
                      </div>
                      <div className={`flex items-center gap-1.5 font-semibold ${
                        sub?.quizSubmitted ? 'text-emerald-700 dark:text-emerald-400' : isSubmitted ? 'text-amber-700 dark:text-amber-400' : 'text-gray-400'
                      }`}>
                        {sub?.quizSubmitted ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                        ) : isSubmitted ? (
                          <HelpCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                        )}
                        <span className="truncate">4. Take quiz</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer CTA */}
                  <div className="pt-3 border-t border-[#E8DEC8]/50 dark:border-[#2E3440] flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-500">
                      {isSubmitted ? 'Result submitted' : isOpen ? 'Due 11:59 PM IST' : '50% catch-up points'}
                    </span>

                    <button
                      onClick={() => handleOpenDay(task.day)}
                      className={`min-h-[38px] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isOpen
                          ? 'bg-[#B3122B] text-white hover:bg-[#8B0D20] shadow-xs'
                          : isSubmitted
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200'
                          : 'bg-amber-600 text-white hover:bg-amber-700'
                      }`}
                    >
                      <span>
                        {isSubmitted ? 'View / Retry' : isOpen ? 'Solve Task' : 'Catch Up'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
