import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Clock, 
  HelpCircle, 
  Award, 
  AlertTriangle, 
  CheckCircle2, 
  Maximize2, 
  XCircle,
  FileText,
  Sliders,
  ChevronRight
} from 'lucide-react';
import { SVITHubLogo } from './BrandLogo';

export const QuizJudgingCriteriaModal = ({
  dayNumber,
  maxQuizPoints,
  examSettings,
  onAcceptAndProceed,
  onClose
}) => {
  const [agreed, setAgreed] = useState(false);

  const negativeMarking = examSettings?.negativeMarking ?? 0;
  const timeLimitMinutes = Math.round((examSettings?.quizTimeLimitSeconds ?? 600) / 60);
  const customText = examSettings?.judgingCriteriaText;

  const pointsPerQuestion = (maxQuizPoints / 8).toFixed(2);

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-[#181B20] rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-2xl max-w-3xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <SVITHubLogo className="w-10 h-10 shrink-0" />
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#B3122B]/10 text-[#B3122B] dark:text-[#ff8a9e] text-[11px] font-bold mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Day {dayNumber} Daily Concept Quiz</span>
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold text-[#1A1A1A] dark:text-white">
                Judging Criteria & Examination Guidelines
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Guidelines Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs text-gray-700 dark:text-gray-300">
          
          {/* Custom Admin Announcement if provided */}
          {customText && customText.trim() && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300">
              <div className="font-bold text-sm mb-1 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Faculty Announcement & Special Instructions</span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{customText}</p>
            </div>
          )}

          {/* 1. Marks per Question & Total Marks */}
          <div className="p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A] dark:text-white mb-2">
              <Award className="w-4 h-4 text-[#B3122B]" />
              <span>1. Marks Per Question & Total Scoring</span>
            </div>
            <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
              <li><strong>Total Questions:</strong> 8 multiple-choice concept questions.</li>
              <li><strong>Daily Quiz Weightage:</strong> Exactly 30% of Day {dayNumber}'s total points (<strong>{maxQuizPoints.toFixed(1)} points</strong> total).</li>
              <li><strong>Points Per Correct Answer:</strong> ~{pointsPerQuestion} points each (proportional to daily point scale).</li>
              <li>Catch-up day submissions receive 50% of earned points.</li>
            </ul>
          </div>

          {/* 2. Negative Marking Rule */}
          <div className="p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A] dark:text-white mb-2">
              <HelpCircle className="w-4 h-4 text-amber-600" />
              <span>2. Negative Marking Policy</span>
            </div>
            <p className="leading-relaxed">
              {negativeMarking > 0 ? (
                <span className="text-red-600 dark:text-red-400 font-bold">
                  Negative Marking Active: A penalty of {negativeMarking} marks is deducted for each incorrect answer. Unanswered questions receive 0 marks.
                </span>
              ) : (
                <span>
                  <strong>No Negative Marking:</strong> There is no penalty for incorrect answers (0 deduction). Attempting all questions is encouraged.
                </span>
              )}
            </p>
          </div>

          {/* 3. Time Limit & Timeout */}
          <div className="p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A] dark:text-white mb-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>3. Time Limit & Automatic Submission</span>
            </div>
            <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
              <li><strong>Duration:</strong> {timeLimitMinutes} minutes from the moment you click "Start Full-Screen Quiz".</li>
              <li>A countdown clock is displayed continuously at the top.</li>
              <li><strong>On Timeout:</strong> When the timer expires, answers selected up to that second are automatically submitted and graded without penalty.</li>
            </ul>
          </div>

          {/* 4. Tie-Breaker Rules */}
          <div className="p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A] dark:text-white mb-2">
              <Sliders className="w-4 h-4 text-purple-600" />
              <span>4. Leaderboard & Tie-Breaker Rules</span>
            </div>
            <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
              <li>Leaderboard ranking is strictly sorted by total points scored out of 100.</li>
              <li>In case of a tie, precedence is given to the student with more on-time submitted days.</li>
              <li>If still tied, precedence goes to the student with the earlier final submission timestamp and lower elapsed quiz time.</li>
            </ul>
          </div>

          {/* 5. Results & Ranking Publication */}
          <div className="p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A] dark:text-white mb-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>5. Result & Ranking Publication Rules</span>
            </div>
            <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
              <li>Quiz score and correct answer breakdown are shown immediately after submission.</li>
              <li>Total cumulative score is updated in real-time on your student dashboard and public leaderboard.</li>
              <li>Final results lock permanently at 11:59 PM IST on 21 Oct 2026. Passing mark for certificate eligibility is 50 or more points.</li>
            </ul>
          </div>

          {/* 6. Program Task Rules */}
          <div className="p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A] dark:text-white mb-2">
              <FileText className="w-4 h-4 text-[#B3122B]" />
              <span>6. Program Task Rules (70% of Day Points)</span>
            </div>
            <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
              <li><strong>Correctness (80% of program part):</strong> Verified via automated execution against hidden and boundary test cases.</li>
              <li><strong>Efficiency (10% of program part):</strong> Checked for optimal algorithmic time and memory limits.</li>
              <li><strong>Code Quality (10% of program part):</strong> Verified against required DSA constructs and idiomatic patterns.</li>
              <li>Up to 3 program submissions permitted per day; highest evaluation score is preserved.</li>
            </ul>
          </div>

          {/* 7. Strict Proctoring & Auto-Exit Disqualification Rules */}
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-900 dark:text-red-300">
            <div className="flex items-center gap-2 text-sm font-bold mb-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>7. Strict Proctoring & Immediate Auto-Exit Rules</span>
            </div>
            <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
              <li><strong>Camera & Mic Mandatory:</strong> Camera and microphone access must remain granted and active. Turning off devices ends the test immediately.</li>
              <li><strong>Tab / Window Switching Prohibited:</strong> Navigating away, switching tabs, or minimizing the browser immediately terminates the test, auto-submits current answers, marks your status <strong>"Exited: tab switch"</strong>, and locks re-entry permanently.</li>
              <li><strong>Fullscreen Enforcement:</strong> Exiting fullscreen mode immediately ends and locks the test.</li>
              <li><strong>Automated Vision Proctoring:</strong> In-browser AI detection monitors the video feed. Detecting a cell phone, multiple faces, or no face for &gt;10s triggers immediate auto-exit and locks re-entry.</li>
              <li><strong>Shortcut & Clipboard Lockdown:</strong> Copy, cut, paste, right-click, devtools (F12, Inspect Element) are disabled throughout the session.</li>
              <li><strong>Server-Side Audit:</strong> All exits and proctoring violations are recorded server-side with IP, timestamp, and snapshot evidence. The server rejects answer submissions after an exit.</li>
            </ul>
          </div>

        </div>

        {/* Footer with Mandatory Agreement Checkbox */}
        <div className="p-5 sm:p-6 border-t border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317]">
          <label className="flex items-start gap-3 cursor-pointer select-none mb-4">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-[#B3122B] focus:ring-[#B3122B] cursor-pointer"
            />
            <span className="text-xs font-semibold text-[#1A1A1A] dark:text-white leading-relaxed">
              I have read, understood, and agree to the Technova Code Sprint Judging Criteria, Negative Marking rules, and Proctoring Auto-Exit Guidelines. I understand that switching tabs, exiting fullscreen, or proctoring violations will immediately end the test and lock re-entry.
            </span>
          </label>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E232B] transition-colors cursor-pointer"
            >
              Cancel & Return
            </button>

            <button
              type="button"
              disabled={!agreed}
              onClick={() => {
                if (agreed && onAcceptAndProceed) {
                  onAcceptAndProceed();
                }
              }}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Accept & Begin Full-Screen Quiz</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
