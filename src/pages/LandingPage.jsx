import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Flame, 
  Trophy, 
  Calendar, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  Users, 
  Clock, 
  BookOpen, 
  Layers,
  Award,
  ChevronRight
} from 'lucide-react';

import { SVITHubLogo, DurgaMataSketch } from '../components/BrandLogo';
import { SPRINT_START_DATE } from '../data/tasksSeed';

export const LandingPage = ({ setCurrentTab }) => {
  const { tasks, user } = useApp();

  const rules = [
    {
      title: "Daily 8 AM IST Unlock",
      desc: "Each morning at 8:00 AM IST, your assigned day task variant unlocks. Deadline is 11:59 PM IST."
    },
    {
      title: "70% Program + 30% Quiz (100 Pts Total)",
      desc: "Day 1-9 points scale from 5 to 20 pts. 70% from automatic test cases and 30% from the daily quiz."
    },
    {
      title: "Pass Mark = 50 / 100 Points",
      desc: "Score 50 or more points to earn your verified certificate. Completing all 9 days is not required."
    },
    {
      title: "Badges & Leaderboard Tie-Breakers",
      desc: "Early Bird and 9-Day Streak badges award recognition and break leaderboard ties (no extra points)."
    },
    {
      title: "Catch-Up Mode (50% Points)",
      desc: "Catch up on previous days anytime until 22 Oct 11:59 PM IST to earn 50% of that day's points."
    },
    {
      title: "DPDP Privacy & Integrity Suite",
      desc: "Consent-based camera/mic checks run strictly client-side to discourage AI assistance. Flags assist mentor review; viva verifies authentic work."
    }
  ];

  const languages = [
    { 
      name: "C Language", 
      desc: "Core procedural logic, memory patterns, pointers, loops, arrays and structured problem solving.", 
      badge: "Fast & Foundational",
      color: "from-blue-600 to-indigo-700"
    },
    { 
      name: "C++", 
      desc: "Modern C++, Standard Template Library (STL), object design, recursion, and algorithm efficiency.", 
      badge: "High Performance",
      color: "from-sky-600 to-cyan-700"
    },
    { 
      name: "Java", 
      desc: "Object-oriented architecture, collections framework, safe data types, and enterprise patterns.", 
      badge: "Robust & Scalable",
      color: "from-orange-600 to-amber-700"
    },
    { 
      name: "Python", 
      desc: "Clean Pythonic syntax, list comprehensions, built-in data structures, parsing, and rapid logic.", 
      badge: "Elegant & Versatile",
      color: "from-emerald-600 to-teal-700"
    }
  ];

  return (
    <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors pb-20 overflow-x-hidden">
      
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-10 pb-20 sm:pt-16 sm:pb-28 border-b border-[#E8DEC8] dark:border-[#2E3440]">
        
        {/* Divine Background Motif: Faint Durga Mata Sacred Sketch Watermark (Opacity <= 0.08 in hero only) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.05] dark:opacity-[0.06] w-[460px] h-[460px] text-[#B3122B]">
          <DurgaMataSketch className="w-full h-full" />
        </div>

        {/* Faint ambient glow shapes */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-[#B3122B]/5 dark:bg-[#B3122B]/10 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-amber-500/5 dark:bg-amber-500/10 blur-3xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          
          {/* Institutional Badge with Hub Logo & Divine Durga Mata Grace */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-white dark:bg-[#1E232B] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs text-xs font-bold text-[#8B0D20] dark:text-[#ff8a9e]">
              <SVITHubLogo className="w-6 h-6 shrink-0" />
              <span>Technical Skill Development Hub • SVIT Nashik</span>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold">
              <DurgaMataSketch className="w-5 h-5 text-[#B3122B] shrink-0" />
              <span>Shri Durga Mata Blessings • Wisdom & Shakti</span>
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-[#B3122B]/10 dark:bg-[#B3122B]/20 border border-[#B3122B]/30 text-[#B3122B] dark:text-[#ff8a9e] text-xs font-bold shadow-xs">
              <Calendar className="w-4 h-4 shrink-0 text-[#B3122B] dark:text-[#ff8a9e]" />
              <span>Day 1 Starts: {SPRINT_START_DATE}</span>
            </div>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-[#1A1A1A] dark:text-white tracking-tight leading-tight max-w-4xl mx-auto">
            TECHNOVA <span className="text-[#B3122B]">CODE SPRINT</span>
            <span className="block text-2xl sm:text-4xl font-extrabold text-[#4A4A4A] dark:text-[#CBD5E1] mt-2">
              9 Days to Build
            </span>
          </h1>


          <p className="mt-4 text-base sm:text-xl text-[#6b6375] dark:text-[#94a3b8] max-w-2xl mx-auto font-medium">
            Solve 9 daily programs in your choice of C, C++, Java or Python, paired with a short daily quiz. Designed for real foundational mastery, from loops and arrays to sorting and full modular applications.
          </p>

          <div className="mt-4 flex items-center justify-center gap-3 text-sm font-bold text-[#8B0D20] dark:text-[#ff8a9e]">
            <span className="px-3 py-1 rounded-md bg-[#B3122B]/10 dark:bg-[#B3122B]/20">Learn</span>
            <span>•</span>
            <span className="px-3 py-1 rounded-md bg-[#B3122B]/10 dark:bg-[#B3122B]/20">Build</span>
            <span>•</span>
            <span className="px-3 py-1 rounded-md bg-[#B3122B]/10 dark:bg-[#B3122B]/20">Grow</span>
          </div>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setCurrentTab(user ? 'dashboard' : 'register')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-white bg-[#B3122B] hover:bg-[#8B0D20] shadow-lg shadow-[#B3122B]/30 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{user ? "Go to My Dashboard" : "Join the Sprint Now"}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentTab('leaderboard')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-[#1A1A1A] dark:text-white bg-white dark:bg-[#1E232B] border border-[#E8DEC8] dark:border-[#2E3440] hover:bg-[#F5EFEB] dark:hover:bg-[#252A34] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trophy className="w-5 h-5 text-amber-500" />
              <span>View Leaderboard</span>
            </button>
          </div>

          {/* Live Metric Pills */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="p-4 rounded-xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] text-center shadow-xs">
              <div className="text-2xl font-black text-[#B3122B]">9 Days</div>
              <div className="text-xs text-[#6b6375] dark:text-[#94a3b8] font-medium mt-0.5">Consecutive Building</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] text-center shadow-xs">
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">100 Pts</div>
              <div className="text-xs text-[#6b6375] dark:text-[#94a3b8] font-medium mt-0.5">Total Points (Pass: 50)</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] text-center shadow-xs">
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">4 Languages</div>
              <div className="text-xs text-[#6b6375] dark:text-[#94a3b8] font-medium mt-0.5">C, C++, Java, Python</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] text-center shadow-xs">
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400">3 Variants</div>
              <div className="text-xs text-[#6b6375] dark:text-[#94a3b8] font-medium mt-0.5">Anti-copy Hash Assigned</div>
            </div>
          </div>
        </div>
      </section>

      {/* Languages Selection Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1A1A1A] dark:text-white">
            Choose Your Language
          </h2>
          <p className="text-sm text-[#6b6375] dark:text-[#94a3b8] mt-1">
            Pick your preferred programming language at registration: C, C++, Java, or Python. Each offers 9 daily progressive programs.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {languages.map((lang, idx) => (
            <div 
              key={idx}
              className="p-6 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm hover:border-[#B3122B] transition-all flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-[#B3122B]/10 dark:bg-[#B3122B]/20 text-[#B3122B] dark:text-[#ff8a9e]">
                  {lang.badge}
                </span>
                <h3 className="text-lg font-bold text-[#1A1A1A] dark:text-white mt-3">{lang.name}</h3>
                <p className="text-xs text-[#6b6375] dark:text-[#94a3b8] mt-2 leading-relaxed">{lang.desc}</p>
              </div>
              <div className="mt-5 pt-4 border-t border-[#E8DEC8]/60 dark:border-[#2E3440] flex items-center justify-between text-xs font-semibold text-[#8B0D20] dark:text-[#ff8a9e]">
                <span>9 Daily Programs</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 9-Day Timeline Roadmap */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-10 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 pb-4 border-b border-[#E8DEC8] dark:border-[#2E3440]">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1A1A1A] dark:text-white">
                9-Day Roadmap Timeline
              </h2>
              <p className="text-xs sm:text-sm text-[#6b6375] dark:text-[#94a3b8] mt-1">
                Progression curve from Beginner to Capstone. Each task takes 30-60 minutes.
              </p>
            </div>
            <div className="mt-3 sm:mt-0 px-3 py-1.5 rounded-lg bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] text-xs font-bold text-[#8B0D20] dark:text-[#ff8a9e]">
              Unlocks daily at 8:00 AM IST
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {tasks.map((task) => (
              <div 
                key={task.day}
                className="p-4 sm:p-5 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] hover:border-[#B3122B]/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-lg bg-[#B3122B] text-white font-extrabold text-xs flex items-center justify-center">
                      D{task.day}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      {task.points} pts
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-[#1A1A1A] dark:text-white mt-3">
                    {task.title}
                  </h4>
                  <div className="text-[11px] font-semibold text-[#8B0D20] dark:text-[#ff8a9e]">
                    Level: {task.level}
                  </div>
                  <p className="text-xs text-[#6b6375] dark:text-[#94a3b8] mt-2 line-clamp-2">
                    {task.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E8DEC8]/50 dark:border-[#2E3440] flex items-center justify-between text-[11px]">
                  <span className="text-gray-500 font-medium">3 Variants (A, B, C)</span>
                  <span className="font-semibold text-[#B3122B] dark:text-[#ff8a9e]">3 Progressive Hints</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rules & Integrity Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* Rules Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm">
            <h3 className="text-xl font-extrabold text-[#1A1A1A] dark:text-white flex items-center gap-2 mb-6">
              <CheckCircle2 className="w-5 h-5 text-[#B3122B]" />
              <span>Sprint Rules & Scoring Schedule</span>
            </h3>

            <div className="space-y-4">
              {rules.map((rule, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-[#FCF9F2] dark:bg-[#111317]">
                  <div className="w-5 h-5 rounded-full bg-[#B3122B]/10 text-[#B3122B] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#1A1A1A] dark:text-white">{rule.title}</div>
                    <div className="text-xs text-[#6b6375] dark:text-[#94a3b8] mt-0.5 leading-relaxed">{rule.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Integrity Suite Highlights */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm">
            <h3 className="text-xl font-extrabold text-[#1A1A1A] dark:text-white flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-[#B3122B]" />
              <span>Academic Integrity Architecture</span>
            </h3>
            <p className="text-xs text-[#6b6375] dark:text-[#94a3b8] mb-6">
              Our philosophy: Flags assist faculty mentors in mentoring, never auto-penalizing students.
            </p>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/5 dark:bg-red-500/10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#B3122B] text-white flex items-center justify-center font-bold text-xs">
                  AI ✕
                </div>
                <div className="text-xs">
                  <div className="font-bold text-red-700 dark:text-red-400">Strict Prohibition of AI Modules</div>
                  <div className="text-gray-600 dark:text-gray-300">ChatGPT, Claude, Gemini, Copilot, & AI tools are strictly banned. All code must be student-crafted.</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                  TAB
                </div>
                <div className="text-xs">
                  <div className="font-bold text-amber-700 dark:text-amber-400">Tab Switch Auto-Ejection</div>
                  <div className="text-gray-600 dark:text-gray-300">Switching tabs or minimizing instantly disqualifies and locks the active submission session.</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 text-[#B3122B] flex items-center justify-center font-bold text-xs">
                  A/B/C
                </div>
                <div className="text-xs">
                  <div className="font-bold text-[#1A1A1A] dark:text-white">Deterministic Hash Variants</div>
                  <div className="text-gray-500">Each student is assigned one of 3 task variants via userId hash.</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                  2M
                </div>
                <div className="text-xs">
                  <div className="font-bold text-[#1A1A1A] dark:text-white">2-Minute Quick Viva</div>
                  <div className="text-gray-500">Mentors verify comprehension; students who explain their code excel.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 text-center">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-[#8B0D20] to-[#B3122B] text-white shadow-xl shadow-[#B3122B]/20">
          <h3 className="text-2xl sm:text-3xl font-extrabold">Ready to build your developer streak?</h3>
          <p className="mt-2 text-sm sm:text-base text-red-100 max-w-xl mx-auto">
            SVIT Nashik students can sign in, complete their profile with Roll Number, and gear up for Day 1 kickoff starting {SPRINT_START_DATE}.
          </p>
          <button
            onClick={() => setCurrentTab('register')}
            className="mt-6 px-8 py-3.5 rounded-xl font-bold bg-white text-[#B3122B] hover:bg-red-50 hover:scale-105 transition-all shadow-md"
          >
            Register / Sign In
          </button>
        </div>
      </section>
    </div>
  );
};
