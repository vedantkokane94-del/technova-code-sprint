import React, { useState } from 'react';
import { ShieldCheck, Video, Mic, Lock, Eye, AlertCircle, CheckSquare, Square, FileText, ArrowRight } from 'lucide-react';
import { SVITHubLogo } from './BrandLogo';

export const ProctoringConsentModal = ({
  dayNumber,
  onAcceptConsent,
  onRequestAlternative,
  isOpen = true
}) => {
  const [agreed, setAgreed] = useState(false);
  const [showAlternativeForm, setShowAlternativeForm] = useState(false);
  const [alternativeReason, setAlternativeReason] = useState('');
  const [alternativeSubmitted, setAlternativeSubmitted] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#181B20] rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-2xl relative text-left my-8">
        
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-[#E8DEC8] dark:border-[#2E3440]">
          <SVITHubLogo className="w-12 h-12" />
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#B3122B]/10 text-[#B3122B] dark:text-[#ff8a9e] text-[10px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>DPDP Act 2023 Compliant</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-[#1A1A1A] dark:text-white">
              Coding Integrity & Safety Checks
            </h2>
            <p className="text-xs text-gray-500">Day {dayNumber} Coding Task & Daily Quiz</p>
          </div>
        </div>

        {!showAlternativeForm ? (
          <div className="space-y-4 my-5 text-xs text-gray-700 dark:text-gray-300">
            
            <p className="font-semibold text-gray-800 dark:text-gray-200 leading-relaxed">
              To ensure fairness, discourage AI-assisted generation, and uphold academic integrity across SVIT Nashik, privacy-safe automated checks operate while this task page is open.
            </p>

            {/* What is checked */}
            <div className="p-3.5 rounded-2xl bg-[#FCF9F2] dark:bg-[#121418] border border-[#E8DEC8] dark:border-[#2E3440] space-y-2">
              <div className="flex items-start gap-2.5">
                <Video className="w-4 h-4 text-[#B3122B] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#1A1A1A] dark:text-white">What is checked:</strong>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400">
                    Camera & microphone processed locally inside your browser (low 320x240 resolution). Checks presence, lighting, and ambient noise levels.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2 border-t border-[#E8DEC8]/50 dark:border-[#2E3440]">
                <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#1A1A1A] dark:text-white">Zero Continuous Streaming:</strong>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400">
                    No video or audio is ever recorded or streamed. Only brief snapshots are saved if a specific flag is raised (e.g. camera covered &gt;20s).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2 border-t border-[#E8DEC8]/50 dark:border-[#2E3440]">
                <Eye className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#1A1A1A] dark:text-white">Who can see it & Retention:</strong>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400">
                    Accessible only to SVIT faculty admins and viva reviewers. All data is automatically deleted within 30 days after results publication.
                  </p>
                </div>
              </div>
            </div>

            {/* Honor Code & DPDP Act 2023 Consent Checkbox */}
            <div 
              onClick={() => setAgreed(!agreed)}
              className="flex items-start gap-3 p-3 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] hover:bg-gray-50 dark:hover:bg-[#1f242d] transition-colors cursor-pointer select-none"
            >
              <button type="button" className="text-[#B3122B] shrink-0 mt-0.5">
                {agreed ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-gray-400" />}
              </button>
              <div className="text-[11px] text-gray-600 dark:text-gray-300">
                I give consent for camera and microphone safety checks for Day {dayNumber} under the <strong>SVIT Code Sprint Honor Code</strong>. I understand I have the right to withdraw consent anytime under the Digital Personal Data Protection Act, 2023.
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-[#E8DEC8] dark:border-[#2E3440] flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowAlternativeForm(true)}
                className="text-[11px] font-bold text-gray-500 hover:text-[#B3122B] transition-colors underline cursor-pointer"
              >
                No working camera/mic? Request viva alternative
              </button>

              <button
                type="button"
                disabled={!agreed}
                onClick={onAcceptConsent}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  agreed 
                    ? 'bg-[#B3122B] text-white hover:bg-[#8B0D20] shadow-md cursor-pointer' 
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                }`}
              >
                <span>Accept & Begin Day {dayNumber}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        ) : (
          /* ALTERNATIVE REQUEST FORM */
          <div className="space-y-4 my-5 text-xs text-gray-700 dark:text-gray-300">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
              <h3 className="font-bold text-sm mb-1 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Request Viva-Based Alternative Verification</span>
              </h3>
              <p className="text-[11px] leading-relaxed">
                If your device lacks a working camera/microphone or you decline automated checks, you can request manual verification via a 2-minute live faculty viva. <strong>You will never be penalised for requesting an alternative.</strong>
              </p>
            </div>

            {!alternativeSubmitted ? (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  setAlternativeSubmitted(true);
                  if (onRequestAlternative) onRequestAlternative(alternativeReason);
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Reason for Alternative (Optional):
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Hardware camera failure, low bandwidth phone connection..."
                    value={alternativeReason}
                    onChange={(e) => setAlternativeReason(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#121418] text-xs focus:outline-hidden focus:border-[#B3122B]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAlternativeForm(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900"
                  >
                    Back to Consent
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] cursor-pointer"
                  >
                    Submit Request & Enter Task
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-4 space-y-3">
                <ShieldCheck className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-sm text-[#1A1A1A] dark:text-white">
                  Alternative Registered Successfully
                </h4>
                <p className="text-xs text-gray-500">
                  Your request has been saved. Your task submission will be verified via viva review. You can now proceed to solve the challenge.
                </p>
                <button
                  type="button"
                  onClick={onAcceptConsent}
                  className="px-6 py-2 rounded-xl text-xs font-bold bg-[#B3122B] text-white"
                >
                  Proceed to Task
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
