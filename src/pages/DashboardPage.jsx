import React from 'react';
import { useApp } from '../context/AppContext';
import { computeUserSummary } from '../utils/scoring';
import { getTaskVariant } from '../utils/hash';
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
  Calendar,
  Layers,
  ChevronRight,
  TrendingUp
} from 'lucide-react';

export const DashboardPage = ({ setCurrentTab, setSelectedDay }) => {
  const { user, tasks, submissions, currentDay, setSprintDay } = useApp();

  // Filter submissions by current user
  const userSubmissions = submissions.filter(s => s.userId === user?.uid);
  const summary = computeUserSummary(userSubmissions);

  // Compute User Rank across all unique users
  const allUserPoints = {};
  submissions.forEach(sub => {
    if (!allUserPoints[sub.userId]) {
      allUserPoints[sub.userId] = 0;
    }
    if (!sub.failedViva) {
      allUserPoints[sub.userId] += sub.points || 0;
    }
  });

  const sortedLeaderboard = Object.entries(allUserPoints).sort((a, b) => b[1] - a[1]);
  const userRankIndex = sortedLeaderboard.findIndex(([uid]) => uid === user?.uid);
  const userRank = userRankIndex >= 0 ? userRankIndex + 1 : sortedLeaderboard.length + 1;

  // Handler to open task page for a specific day
  const handleOpenDay = (day) => {
    setSelectedDay(day);
    setCurrentTab('task');
  };

  // If user is not yet registered, prompt clean onboarding
  if (!user) {
    return (
      <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-16 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#B3122B]/10 text-[#B3122B] flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#1A1A1A] dark:text-white">
            Student Registration Required
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-2 mb-6">
            Welcome to Technova Code Sprint! Please complete your SVIT student registration to unlock your daily 9-day coding challenges and start building.
          </p>
          <button
            onClick={() => setCurrentTab('register')}
            className="w-full py-3.5 px-6 rounded-xl font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] text-sm flex items-center justify-center gap-2 shadow-md shadow-[#B3122B]/20 transition-all cursor-pointer"
          >
            <span>Register as Student</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-8 px-4 sm:px-6 lg:px-8 pb-24">
      <div className="max-w-7xl mx-auto">
        
        {/* Top Header & Greeting */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-[#B3122B]/10 dark:bg-[#B3122B]/20 text-[#B3122B] dark:text-[#ff8a9e]">
                {user?.track || "Web"} Track • {user?.year || "SE"}
              </span>
              <span className="text-xs font-mono text-gray-500">
                Roll No: {user?.prn || ""}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1A1A] dark:text-white mt-1">
              Welcome, {user?.name}! 👋
            </h1>
            <p className="text-xs sm:text-sm text-[#6b6375] dark:text-[#94a3b8] mt-0.5">
              Keep your coding momentum strong. Active Sprint Day: <span className="font-bold text-[#B3122B] dark:text-[#ff8a9e]">Day {currentDay} of 9</span>
            </p>
          </div>

          {/* Quick Simulation Control: Advance / Set Sprint Day */}
          <div className="flex items-center gap-2 self-start md:self-auto bg-white dark:bg-[#181B20] p-1.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] text-xs">
            <span className="text-gray-500 px-2 font-medium">Simulate Day:</span>
            {[1, 2, 3, 5, 9].map((d) => (
              <button
                key={d}
                onClick={() => setSprintDay(d)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
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

        {/* Stats Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          
          {/* Total Points */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs flex items-center gap-3.5 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-[#1A1A1A] dark:text-white">
                {summary.totalPoints}
              </div>
              <div className="text-xs font-semibold text-[#6b6375] dark:text-[#94a3b8]">
                Total Points Earned
              </div>
            </div>
          </div>

          {/* Streak Counter */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs flex items-center gap-3.5 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-red-500/10 text-[#B3122B] flex items-center justify-center font-bold shrink-0">
              <Flame className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-[#B3122B]">
                {summary.streak} / 9 Days
              </div>
              <div className="text-xs font-semibold text-[#6b6375] dark:text-[#94a3b8]">
                Consecutive Streak 🔥
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
                Sprint Rank (SVIT)
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
                Tasks Submitted
              </div>
            </div>
          </div>
        </div>

        {/* Catch-Up & Scoring Alert Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-red-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold">Missed a day? Don't stop! </span>
              Missing a day never blocks the next. Catch up on any past missed day until Day 9 for <strong>50% points</strong>.
            </div>
          </div>
          <button
            onClick={() => setCurrentTab('leaderboard')}
            className="text-xs font-bold text-amber-800 dark:text-amber-300 hover:underline flex items-center gap-1 shrink-0"
          >
            <span>Live Leaderboard</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 9 Day Cards Grid */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#1A1A1A] dark:text-white">
              Sprint Timeline (9 Days)
            </h2>
            <span className="text-xs text-gray-500">
              Assigned Variant: <strong className="text-[#B3122B]">Variant {getTaskVariant(user?.uid, currentDay)}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {tasks.map((task) => {
              const sub = userSubmissions.find(s => s.day === task.day);
              const isSubmitted = !!sub;
              const isOpen = task.day === currentDay;
              const isMissed = task.day < currentDay && !sub;
              const isLocked = task.day > currentDay;

              // Title adjustment if user is on DSA track
              const displayTitle = (user?.track === 'DSA' && task.dsaTrack) 
                ? task.dsaTrack.title 
                : task.title;

              const assignedVariantLetter = getTaskVariant(user?.uid, task.day);

              return (
                <div
                  key={task.day}
                  className={`rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                    isOpen
                      ? 'bg-white dark:bg-[#181B20] border-[#B3122B] shadow-md ring-2 ring-[#B3122B]/20'
                      : isSubmitted
                      ? 'bg-white dark:bg-[#181B20] border-emerald-500/40 shadow-xs'
                      : isMissed
                      ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30'
                      : 'bg-gray-100/60 dark:bg-[#14171C] border-[#E8DEC8]/50 dark:border-[#2E3440] opacity-80'
                  }`}
                >
                  <div>
                    {/* Status Badge & Day */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center ${
                          isOpen 
                            ? 'bg-[#B3122B] text-white shadow-xs' 
                            : isSubmitted
                            ? 'bg-emerald-600 text-white'
                            : isMissed
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          D{task.day}
                        </span>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                            Day {task.day}
                          </span>
                          <div className="text-[11px] font-semibold text-[#8B0D20] dark:text-[#ff8a9e]">
                            {task.level}
                          </div>
                        </div>
                      </div>

                      {/* State Pills */}
                      {isSubmitted && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Submitted (+{sub.points} pts)</span>
                        </span>
                      )}

                      {isOpen && !isSubmitted && (
                        <span className="px-2.5 py-1 rounded-full bg-[#B3122B]/10 dark:bg-[#B3122B]/20 text-[#B3122B] dark:text-[#ff8a9e] text-xs font-bold flex items-center gap-1 animate-pulse">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Active Today</span>
                        </span>
                      )}

                      {isMissed && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1">
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Missed (50% Catch-up)</span>
                        </span>
                      )}

                      {isLocked && (
                        <span className="px-2.5 py-1 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-bold flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Locked</span>
                        </span>
                      )}
                    </div>

                    {/* Card Title & Description */}
                    <h3 className="text-base font-bold text-[#1A1A1A] dark:text-white">
                      {displayTitle}
                    </h3>
                    
                    <p className="text-xs text-[#6b6375] dark:text-[#94a3b8] mt-1.5 line-clamp-2">
                      {user?.track === 'DSA' && task.dsaTrack ? task.dsaTrack.description : task.description}
                    </p>

                    {/* Assigned Variant Notice */}
                    {!isLocked && (
                      <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FCF9F2] dark:bg-[#1E232B] border border-[#E8DEC8] dark:border-[#2E3440] text-[11px] font-medium text-gray-600 dark:text-gray-300">
                        <span>Assigned:</span>
                        <strong className="text-[#B3122B] dark:text-[#ff8a9e]">Variant {assignedVariantLetter}</strong>
                      </div>
                    )}
                  </div>

                  {/* Footer & Action CTA */}
                  <div className="mt-5 pt-3 border-t border-[#E8DEC8]/50 dark:border-[#2E3440] flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#B3122B]">
                      {task.points} Base Pts
                    </span>

                    {isLocked ? (
                      <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Unlocks 8 AM IST</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleOpenDay(task.day)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          isOpen
                            ? 'bg-[#B3122B] text-white hover:bg-[#8B0D20] shadow-xs'
                            : isSubmitted
                            ? 'bg-[#F5EFEB] dark:bg-[#252A34] text-[#1A1A1A] dark:text-white hover:border-[#B3122B]'
                            : 'bg-amber-600 text-white hover:bg-amber-700'
                        }`}
                      >
                        <span>{isSubmitted ? 'View / Edit' : isMissed ? 'Catch Up' : 'Solve Task'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
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
