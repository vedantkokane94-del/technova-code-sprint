import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { computeUserSummary, formatScore } from '../utils/scoring';
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
  UserCheck,
  Clock,
  ShieldCheck
} from 'lucide-react';

export const LeaderboardPage = () => {
  const { submissions, user, manualOverrides } = useApp();

  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Group submissions by student
  const studentMap = {};

  submissions.forEach(sub => {
    const key = sub.userId || sub.prn;
    if (!studentMap[key]) {
      studentMap[key] = {
        userId: sub.userId,
        name: sub.studentName,
        prn: sub.prn,
        language: sub.language || sub.track || 'Python',
        submissions: []
      };
    }
    studentMap[key].submissions.push(sub);
  });

  // Calculate summaries with strict tie-breaking logic (Section 1)
  let leaderboard = Object.values(studentMap).map(stud => {
    const summary = computeUserSummary(stud.submissions, manualOverrides[stud.userId || stud.prn]);
    return {
      ...stud,
      summary
    };
  });

  // Sort by:
  // 1. Total score out of 100 (descending)
  // 2. On-time days count (descending)
  // 3. Earlier last-submission time (ascending)
  leaderboard.sort((a, b) => {
    if (b.summary.totalScore !== a.summary.totalScore) {
      return b.summary.totalScore - a.summary.totalScore;
    }
    if (b.summary.onTimeCount !== a.summary.onTimeCount) {
      return b.summary.onTimeCount - a.summary.onTimeCount;
    }
    return (a.summary.lastSubmissionTime || Infinity) - (b.summary.lastSubmissionTime || Infinity);
  });

  // Filter
  const filtered = leaderboard.filter(item => {
    const matchesLang = selectedLanguage === 'All' || 
      item.language.toLowerCase() === selectedLanguage.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.prn.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLang && matchesSearch;
  });

  const languages = ['All', 'C', 'C++', 'Java', 'Python'];

  return (
    <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-10 px-4 sm:px-6 lg:px-8 pb-24">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-bold mb-2">
            <Trophy className="w-3.5 h-3.5" />
            <span>Official Campus Standings</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1A1A1A] dark:text-white">
            Code Sprint Leaderboard
          </h1>
          <p className="text-sm text-[#6b6375] dark:text-[#94a3b8] mt-1 max-w-xl mx-auto">
            Ranked by score out of 100. Ties resolved by on-time days, then earlier last submission time.
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
                {formatScore(filtered[1].summary.totalScore)} <span className="text-xs font-semibold text-gray-500">/ 100</span>
              </div>
              <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-bold text-gray-500">
                <span>{filtered[1].summary.onTimeCount} on-time days</span>
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
                {formatScore(filtered[0].summary.totalScore)} <span className="text-xs font-semibold text-gray-500">/ 100</span>
              </div>
              <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{filtered[0].summary.onTimeCount} on-time days</span>
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
                {formatScore(filtered[2].summary.totalScore)} <span className="text-xs font-semibold text-gray-500">/ 100</span>
              </div>
              <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-bold text-gray-500">
                <span>{filtered[2].summary.onTimeCount} on-time days</span>
              </div>
            </div>

          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          
          {/* Language Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto p-1 bg-white dark:bg-[#181B20] rounded-xl border border-[#E8DEC8] dark:border-[#2E3440]">
            {languages.map(lang => (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedLanguage === lang
                    ? 'bg-[#B3122B] text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-[#FCF9F2] dark:hover:bg-[#252A34]'
                }`}
              >
                {lang} {lang !== 'All' ? 'Track' : ''}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search student or Roll Number..."
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
                  <th className="py-3.5 px-4 sm:px-6">Language</th>
                  <th className="py-3.5 px-4 sm:px-6">On-Time Days</th>
                  <th className="py-3.5 px-4 sm:px-6">Badges</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Total Score (/100)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DEC8]/50 dark:divide-[#2E3440]">
                {filtered.map((item, index) => {
                  const isCurrentUser = user && (item.userId === user.uid || item.prn === user.prn);
                  return (
                    <tr
                      key={item.userId || item.prn}
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

                      {/* Student Info: Initials circle in red on cream (Section 6A) */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#FCF9F2] dark:bg-[#2A181C] border border-[#E8DEC8] dark:border-[#4A2028] text-[#B3122B] dark:text-[#ff8a9e] flex items-center justify-center font-bold text-xs shrink-0">
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

                      {/* Language */}
                      <td className="py-4 px-4 sm:px-6">
                        <span className="px-2.5 py-1 rounded-md bg-[#FCF9F2] dark:bg-[#252A34] border border-[#E8DEC8] dark:border-[#2E3440] font-semibold text-[11px] text-gray-700 dark:text-gray-300">
                          {item.language}
                        </span>
                      </td>

                      {/* On-Time Days */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-300">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>{item.summary.onTimeCount} / 9</span>
                        </div>
                      </td>

                      {/* Badges (0 points, recognition & tie-breakers) */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-1.5">
                          {item.summary.badges?.length > 0 ? (
                            item.summary.badges.map(b => (
                              <span 
                                key={b.id} 
                                title={b.description}
                                className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-500/20"
                              >
                                {b.icon} {b.label}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-[11px]">—</span>
                          )}
                        </div>
                      </td>

                      {/* Total Score out of 100 */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <span className="text-base font-black text-[#B3122B] dark:text-[#ff8a9e]">
                          {formatScore(item.summary.totalScore)}
                        </span>
                        <span className="text-[10px] text-gray-400 ml-1">/ 100</span>
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
                        Standings update in real time as students submit solutions and quizzes.
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
