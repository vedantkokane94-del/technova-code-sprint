import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Trophy, 
  Flame, 
  Search, 
  Filter, 
  Award, 
  Medal, 
  ExternalLink, 
  Sparkles,
  ChevronUp,
  UserCheck
} from 'lucide-react';
import { Github } from '../components/GithubIcon';

export const LeaderboardPage = () => {
  const { submissions, user } = useApp();

  const [selectedTrack, setSelectedTrack] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Group submissions by student
  const studentMap = {};

  submissions.forEach(sub => {
    if (!studentMap[sub.userId]) {
      studentMap[sub.userId] = {
        userId: sub.userId,
        name: sub.studentName,
        prn: sub.prn,
        track: sub.track || 'Web',
        totalPoints: 0,
        submissionsCount: 0,
        completedDays: new Set(),
        failedVivaCount: 0,
        submissions: []
      };
    }

    studentMap[sub.userId].submissions.push(sub);
    if (!sub.failedViva) {
      studentMap[sub.userId].totalPoints += sub.points || 0;
      studentMap[sub.userId].completedDays.add(sub.day);
      studentMap[sub.userId].submissionsCount++;
    } else {
      studentMap[sub.userId].failedVivaCount++;
    }
  });

  // Convert map to array and compute streaks
  let leaderboard = Object.values(studentMap).map(stud => {
    let streak = 0;
    for (let d = 1; d <= 9; d++) {
      if (stud.completedDays.has(d)) {
        streak++;
      } else {
        break;
      }
    }
    // Perfect streak bonus +10
    const perfectBonus = stud.completedDays.size === 9 ? 10 : 0;
    return {
      ...stud,
      streak,
      finalScore: stud.totalPoints + perfectBonus
    };
  });

  // Sort descending by finalScore then by streak
  leaderboard.sort((a, b) => {
    if (b.finalScore !== a.finalScore) {
      return b.finalScore - a.finalScore;
    }
    return b.streak - a.streak;
  });

  // Filter
  const filtered = leaderboard.filter(item => {
    const matchesTrack = selectedTrack === 'All' || item.track === selectedTrack;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.prn.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTrack && matchesSearch;
  });

  const tracks = ['All', 'Web', 'App', 'Python', 'DSA'];

  return (
    <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-10 px-4 sm:px-6 lg:px-8 pb-24">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-bold mb-2">
            <Trophy className="w-3.5 h-3.5" />
            <span>Live Campus Standings</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1A1A1A] dark:text-white">
            Code Sprint Leaderboard
          </h1>
          <p className="text-sm text-[#6b6375] dark:text-[#94a3b8] mt-1 max-w-xl mx-auto">
            Real-time rankings based on task completion, early-bird bonuses (+5 pts), and 9-day consistency streaks.
          </p>
        </div>

        {/* Podium Top 3 (if available) */}
        {filtered.length >= 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 max-w-4xl mx-auto items-end">
            
            {/* Rank 2 */}
            <div className="order-2 md:order-1 bg-white dark:bg-[#181B20] p-6 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] text-center shadow-xs md:h-64 flex flex-col justify-center relative">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-black text-sm flex items-center justify-center mx-auto mb-2 ring-4 ring-gray-100 dark:ring-gray-800">
                2
              </div>
              <h3 className="font-extrabold text-base text-[#1A1A1A] dark:text-white truncate">
                {filtered[1].name}
              </h3>
              <div className="text-xs text-gray-400 font-mono">Roll No: {filtered[1].prn}</div>
              <div className="mt-3 text-2xl font-black text-[#1A1A1A] dark:text-white">
                {filtered[1].finalScore} <span className="text-xs font-semibold text-gray-500">pts</span>
              </div>
              <div className="mt-1 flex items-center justify-center gap-1 text-xs font-bold text-red-500">
                <Flame className="w-3.5 h-3.5" />
                <span>{filtered[1].streak} Day Streak</span>
              </div>
            </div>

            {/* Rank 1 (Champion) */}
            <div className="order-1 md:order-2 bg-gradient-to-b from-amber-500/10 to-transparent bg-white dark:bg-[#181B20] p-7 rounded-3xl border-2 border-amber-500/50 text-center shadow-lg md:h-72 flex flex-col justify-center relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-500 text-amber-950 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
                <Trophy className="w-3 h-3" />
                <span>Leader</span>
              </div>
              <div className="w-14 h-14 rounded-full bg-amber-500 text-white font-black text-xl flex items-center justify-center mx-auto mb-2 ring-4 ring-amber-300/40">
                👑
              </div>
              <h3 className="font-black text-lg text-[#1A1A1A] dark:text-white truncate">
                {filtered[0].name}
              </h3>
              <div className="text-xs text-gray-400 font-mono">Roll No: {filtered[0].prn}</div>
              <div className="mt-3 text-3xl font-black text-amber-600 dark:text-amber-400">
                {filtered[0].finalScore} <span className="text-xs font-semibold text-gray-500">pts</span>
              </div>
              <div className="mt-1 flex items-center justify-center gap-1 text-xs font-bold text-red-500">
                <Flame className="w-4 h-4 animate-pulse" />
                <span>{filtered[0].streak} Day Streak</span>
              </div>
            </div>

            {/* Rank 3 */}
            <div className="order-3 md:order-3 bg-white dark:bg-[#181B20] p-6 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] text-center shadow-xs md:h-60 flex flex-col justify-center relative">
              <div className="w-10 h-10 rounded-full bg-amber-700/20 text-amber-800 dark:text-amber-300 font-black text-sm flex items-center justify-center mx-auto mb-2 ring-4 ring-amber-700/10">
                3
              </div>
              <h3 className="font-extrabold text-base text-[#1A1A1A] dark:text-white truncate">
                {filtered[2].name}
              </h3>
              <div className="text-xs text-gray-400 font-mono">Roll No: {filtered[2].prn}</div>
              <div className="mt-3 text-2xl font-black text-[#1A1A1A] dark:text-white">
                {filtered[2].finalScore} <span className="text-xs font-semibold text-gray-500">pts</span>
              </div>
              <div className="mt-1 flex items-center justify-center gap-1 text-xs font-bold text-red-500">
                <Flame className="w-3.5 h-3.5" />
                <span>{filtered[2].streak} Day Streak</span>
              </div>
            </div>

          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          
          {/* Track Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto p-1 bg-white dark:bg-[#181B20] rounded-xl border border-[#E8DEC8] dark:border-[#2E3440]">
            {tracks.map(t => (
              <button
                key={t}
                onClick={() => setSelectedTrack(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  selectedTrack === t
                    ? 'bg-[#B3122B] text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-[#FCF9F2] dark:hover:bg-[#252A34]'
                }`}
              >
                {t} {t !== 'All' ? 'Track' : ''}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search name or Roll Number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-white dark:bg-[#181B20] text-xs text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B]"
            />
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-white dark:bg-[#181B20] rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FCF9F2] dark:bg-[#111317] border-b border-[#E8DEC8] dark:border-[#2E3440] text-gray-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Rank</th>
                  <th className="py-3.5 px-4 sm:px-6">Student</th>
                  <th className="py-3.5 px-4 sm:px-6">Track</th>
                  <th className="py-3.5 px-4 sm:px-6">Streak</th>
                  <th className="py-3.5 px-4 sm:px-6">Days Solved</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Total Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DEC8]/50 dark:divide-[#2E3440]">
                {filtered.map((item, index) => {
                  const isCurrentUser = user && item.userId === user.uid;
                  return (
                    <tr
                      key={item.userId}
                      className={`hover:bg-[#FCF9F2]/60 dark:hover:bg-[#1A1D24] transition-colors ${
                        isCurrentUser ? 'bg-[#B3122B]/5 dark:bg-[#B3122B]/10 font-medium' : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-4 px-4 sm:px-6">
                        <span className={`w-6 h-6 rounded-lg font-black text-xs inline-flex items-center justify-center ${
                          index === 0
                            ? 'bg-amber-500 text-white'
                            : index === 1
                            ? 'bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white'
                            : index === 2
                            ? 'bg-amber-700 text-white'
                            : 'text-gray-500'
                        }`}>
                          {index + 1}
                        </span>
                      </td>

                      {/* Student Info */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#B3122B]/10 text-[#B3122B] flex items-center justify-center font-bold text-xs ring-1 ring-[#B3122B]/30">
                            {item.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-[#1A1A1A] dark:text-white flex items-center gap-1.5">
                              <span>{item.name}</span>
                              {isCurrentUser && (
                                <span className="text-[10px] bg-[#B3122B] text-white font-bold px-1.5 py-0.2 rounded-full">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono">
                              Roll No: {item.prn}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Track */}
                      <td className="py-4 px-4 sm:px-6">
                        <span className="px-2 py-0.5 rounded-md bg-[#FCF9F2] dark:bg-[#252A34] border border-[#E8DEC8] dark:border-[#2E3440] font-semibold text-[11px] text-gray-700 dark:text-gray-300">
                          {item.track}
                        </span>
                      </td>

                      {/* Streak */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-1 font-bold text-red-600 dark:text-red-400">
                          <Flame className="w-3.5 h-3.5" />
                          <span>{item.streak} d</span>
                        </div>
                      </td>

                      {/* Days Solved */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="text-gray-600 dark:text-gray-300 font-semibold">
                          {item.completedDays.size} / 9
                        </div>
                      </td>

                      {/* Score */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <span className="text-base font-black text-[#B3122B] dark:text-[#ff8a9e]">
                          {item.finalScore}
                        </span>
                        <span className="text-[10px] text-gray-400 ml-1">pts</span>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400">
                      <Trophy className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <div className="font-bold text-sm text-gray-700 dark:text-gray-300">
                        {submissions.length === 0 ? "No sprint submissions yet" : "No matching participants found"}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                        {submissions.length === 0 
                          ? "Leaderboard standings will update dynamically in real time as registered students submit daily sprint tasks."
                          : "Try adjusting your search query or track filters."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
