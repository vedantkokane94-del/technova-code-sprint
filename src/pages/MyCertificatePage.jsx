import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CertificateView } from '../components/CertificateView';
import { computeUserSummary, formatScore } from '../utils/scoring';
import { 
  Award, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  FileCheck2, 
  Share2, 
  ExternalLink,
  Copy,
  Clock,
  ShieldAlert
} from 'lucide-react';

export const MyCertificatePage = ({ setCurrentTab }) => {
  const { 
    user, 
    submissions = [], 
    certificates = [], 
    getStudentEligibility, 
    manualOverrides,
    resendRequests = {},
    requestCertificateResend,
    resultsPublished
  } = useApp();
  const [copiedLink, setCopiedLink] = useState(false);
  const [resendToast, setResendToast] = useState('');

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] py-20 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white dark:bg-[#181B20] p-8 rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] text-center shadow-md">
          <div className="w-16 h-16 rounded-2xl bg-[#B3122B]/10 text-[#B3122B] flex items-center justify-center mx-auto mb-4">
            <Award className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#1A1A1A] dark:text-white">Sign In to View Certificate</h2>
          <p className="text-xs text-gray-500 mt-2">
            Please register or sign in with your SVIT credentials to access your certificate of completion.
          </p>
          <button
            onClick={() => setCurrentTab('register')}
            className="mt-6 px-6 py-2.5 rounded-xl font-bold bg-[#B3122B] text-white text-sm cursor-pointer"
          >
            Register / Sign In
          </button>
        </div>
      </div>
    );
  }

  // Filter user submissions
  const userSubmissions = submissions.filter(s => s.userId === user.uid || s.prn === user.prn);
  const summary = computeUserSummary(userSubmissions, manualOverrides[user.uid || user.prn]);
  const eligibility = getStudentEligibility(user.uid || user.prn);

  // Check if student has issued certificate
  const myCert = certificates.find(c => (c.userId === user.uid || c.prn === user.prn) && c.status !== 'revoked');

  const baseUrl = typeof window !== 'undefined' ? (import.meta.env.VITE_APP_URL || window.location.origin) : '';
  const verifyUrl = myCert ? `${baseUrl}/verify/${myCert.certificateId}` : '';

  const handleCopyLink = () => {
    if (!verifyUrl) return;
    navigator.clipboard.writeText(verifyUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-10 px-4 sm:px-6 lg:px-8 pb-24">
      <div className="max-w-5xl mx-auto">
        
        {/* Page Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B3122B]/10 dark:bg-[#B3122B]/20 text-[#B3122B] dark:text-[#ff8a9e] text-xs font-bold mb-2">
            <Award className="w-3.5 h-3.5" />
            <span>Official Completion Certificate</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#1A1A1A] dark:text-white">
            My Technova Certificate
          </h1>
          <p className="text-sm text-[#6b6375] dark:text-[#94a3b8] mt-1">
            Technical Skill Development Hub • Sir Visvesvaraya Institute of Technology, Nashik
          </p>
        </div>

        {/* Score & Status Pill */}
        <div className="max-w-xl mx-auto mb-6 p-4 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Score</span>
            <div className="text-xl font-mono font-black text-[#B3122B] dark:text-[#ff8a9e]">
              {formatScore(summary.totalScore)} / 100 points
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Pass Mark: 50 Pts</span>
            <div className="text-xs font-bold mt-0.5">
              {summary.progressStatus === 'Passed' && <span className="text-emerald-600 dark:text-emerald-400">✓ Passed</span>}
              {summary.progressStatus === 'Pending review' && <span className="text-orange-600 dark:text-orange-400">⏳ Pending Review</span>}
              {summary.progressStatus === 'Below pass mark' && <span className="text-amber-600 dark:text-amber-400">Below Pass Mark</span>}
              {summary.progressStatus === 'Pass mark not reached' && <span className="text-red-600 dark:text-red-400">Pass Mark Not Reached</span>}
              {summary.progressStatus === 'On track' && <span className="text-blue-600 dark:text-blue-400">On Track</span>}
            </div>
          </div>
        </div>

        {myCert && eligibility.isEligible && (resultsPublished || user?.role === 'admin') ? (
          /* ISSUED CERTIFICATE DISPLAY (Section 3 & 4) */
          <div className="space-y-6">
            
            {/* Verification Link Banner */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-2.5 font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Certificate Authenticated: <strong className="font-mono">{myCert.certificateId}</strong></span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="font-mono text-[11px] bg-white dark:bg-[#181B20] px-2 py-1 rounded border border-emerald-500/30 truncate max-w-xs">
                  {verifyUrl}
                </span>
                <button
                  onClick={handleCopyLink}
                  className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
                </button>
              </div>
            </div>

            {/* Section 9.6: Email Delivery Status, Spam Advice & Request Resend */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E8DEC8]/50 dark:border-[#2E3440]">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#B3122B]/10 text-[#B3122B] dark:text-[#ff8a9e]">
                    <FileCheck2 className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="font-bold text-xs text-[#1A1A1A] dark:text-white">
                      Official Certificate Email Delivery
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Sender: <strong className="text-[#8B0D20] dark:text-[#ff8a9e]">technicalteamsvit@gmail.com</strong>
                    </div>
                  </div>
                </div>

                {/* Status indicator */}
                <div className="flex items-center gap-2">
                  {myCert.sentAt || myCert.emailStatus === 'sent' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Certificate emailed on {myCert.sentAt || "October 2026"}</span>
                    </span>
                  ) : myCert.emailStatus === 'failed' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 font-bold text-[11px]">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Email delivery pending</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-[11px]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Queued for email dispatch</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Spam/Promotions advice note (Section 9.6) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <p className="text-gray-500 dark:text-gray-400 text-[11px] leading-relaxed">
                  💡 <strong>Tip:</strong> If you don't see the email, check your <strong>Spam</strong> or <strong>Promotions</strong> folder, or download your verified certificate directly from this page using the button below.
                </p>

                {/* Request Resend Button (Section 9.6: Max 2 requests per student) */}
                {(() => {
                  const studentKey = user.uid || user.prn;
                  const reqInfo = resendRequests[studentKey] || { count: 0 };
                  const isMaxReached = reqInfo.count >= 2;

                  return (
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => {
                          const res = requestCertificateResend(studentKey, "Student request from My Certificate portal");
                          setResendToast(res.message);
                          setTimeout(() => setResendToast(''), 4500);
                        }}
                        disabled={isMaxReached}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                          isMaxReached
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-300 dark:border-gray-700'
                            : 'bg-white dark:bg-[#181B20] text-gray-700 dark:text-gray-200 border border-[#E8DEC8] dark:border-[#2E3440] hover:text-[#B3122B] hover:border-[#B3122B]'
                        }`}
                        title={isMaxReached ? "Maximum 2 resend requests reached" : "Request faculty admin to resend email"}
                      >
                        <span>{isMaxReached ? "Resend Limit Reached (2/2)" : `Request Resend (${reqInfo.count}/2)`}</span>
                      </button>
                    </div>
                  );
                })()}
              </div>

              {resendToast && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-bold animate-in fade-in duration-200">
                  {resendToast}
                </div>
              )}
            </div>

            <CertificateView
              studentName={myCert.studentName || user.name}
              prn={myCert.prn || user.prn}
              language={myCert.language || user.language || user.track || 'Python'}
              track={myCert.language || user.language || user.track || 'Python'}
              score={myCert.score || summary.totalScore}
              certificateId={myCert.certificateId}
              startDate={myCert.startDate || "14 Oct 2026"}
              endDate={myCert.endDate || "22 Oct 2026"}
              issueDate={myCert.issuedDate || "23 Oct 2026"}
              showDownloadButton={true}
            />
          </div>
        ) : summary.hasPendingReview || eligibility.hasUnresolvedFlag ? (
          /* PENDING REVIEW (Section 2) */
          <div className="bg-white dark:bg-[#181B20] rounded-3xl p-8 border border-orange-500/30 shadow-sm text-center max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-[#1A1A1A] dark:text-white">
              Status: Pending Review
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
              Your submissions have reached <strong>{formatScore(summary.totalScore)} / 100 points</strong>, but an integrity flag has been marked by faculty for viva audit.
            </p>
            <div className="mt-5 p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 text-xs text-left">
              <div className="font-bold text-orange-800 dark:text-orange-300">Next Step: 2-Minute Faculty Viva</div>
              <p className="text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                Connect with the faculty mentor at the Hub. Once your viva is conducted and cleared, your status will change to "Passed" and your certificate will be released immediately.
              </p>
            </div>
            <button
              onClick={() => setCurrentTab('dashboard')}
              className="mt-6 px-6 py-2.5 rounded-xl font-bold bg-[#B3122B] text-white text-xs cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        ) : summary.totalScore >= 50 ? (
          /* PASSED BUT EITHER RESULTS PENDING PUBLICATION OR CERTIFICATE GENERATION */
          <div className="bg-white dark:bg-[#181B20] rounded-3xl p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm text-center max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <FileCheck2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-[#1A1A1A] dark:text-white">
              {resultsPublished ? "Congratulations! You Passed the Code Sprint! 🎉" : "Official Results Pending Publication ⏳"}
            </h2>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              {resultsPublished
                ? `You scored ${formatScore(summary.totalScore)} / 100 points (pass mark is 50). Your official certificate is queued for cryptographic release by the Technical Skill Development Hub.`
                : `You scored ${formatScore(summary.totalScore)} / 100 points. Evaluation of all submissions is currently underway. Certificates will be released and available for download here as soon as official sprint results are published by the faculty organizers.`
              }
            </p>
            <div className="mt-6 p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] text-xs text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Student:</span>
                <span className="font-bold">{user.name} ({user.prn})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Language Track:</span>
                <span className="font-bold">{user.language || user.track || 'Python'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Total Score:</span>
                <span className="font-bold text-emerald-600">{formatScore(summary.totalScore)} / 100 pts</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Results Status:</span>
                <span className={`font-bold ${resultsPublished ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {resultsPublished ? "Official Results Published" : "Pending Official Publication"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* BELOW PASS MARK (< 50) */
          <div className="bg-white dark:bg-[#181B20] rounded-3xl p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm max-w-xl mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-[#1A1A1A] dark:text-white">
              Certificate Locked: {formatScore(summary.totalScore)} / 100 Points
            </h2>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto leading-relaxed">
              To pass and qualify for certification, students must score <strong>50 or more points</strong> out of 100. Completing all 9 days is not required.
            </p>

            <div className="my-6 p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] text-xs text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Current Score:</span>
                <span className="font-mono font-bold text-[#B3122B]">{formatScore(summary.totalScore)} / 100</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Pass Mark Required:</span>
                <span className="font-mono font-bold text-emerald-600">50.0 / 100</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Points Needed:</span>
                <span className="font-mono font-bold text-amber-600">
                  {formatScore(Math.max(0, 50 - summary.totalScore))} pts
                </span>
              </div>
            </div>

            <button
              onClick={() => setCurrentTab('dashboard')}
              className="w-full py-3 rounded-xl font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Solve Tasks & Catch Up (Earn 50% on Missed Days)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
