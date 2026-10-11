import React from 'react';
import { useApp } from '../context/AppContext';
import { CertificateView } from '../components/CertificateView';
import { 
  Award, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  FileCheck2, 
  Share2, 
  Info,
  Calendar
} from 'lucide-react';

export const MyCertificatePage = ({ setCurrentTab }) => {
  const { user, submissions = [], certificates = [], eligibleStudents = [] } = useApp();

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
            className="mt-6 px-6 py-2.5 rounded-xl font-bold bg-[#B3122B] text-white text-sm"
          >
            Register / Sign In
          </button>
        </div>
      </div>
    );
  }

  // Filter user submissions
  const userSubmissions = submissions.filter(s => s.userId === user.uid);
  const completedDays = new Set(
    userSubmissions
      .filter(s => !s.failedViva && (s.status === 'approved' || s.status === 'submitted'))
      .map(s => s.day)
  );

  // Check if student has issued certificate
  const myCert = certificates.find(c => c.userId === user.uid || c.prn === user.prn);

  // Eligibility evaluation: all 9 days solved + no unresolved flag or failed viva
  const hasFailedViva = userSubmissions.some(s => s.failedViva);
  const hasUnresolvedFlag = userSubmissions.some(s => s.vivaRequired || s.status === 'flagged');
  const isEligible = completedDays.size === 9 && !hasFailedViva && !hasUnresolvedFlag;

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
            Issued by Technical Skill Development Hub, Sir Visvesvaraya Institute of Technology, Nashik
          </p>
        </div>

        {myCert ? (
          /* ISSUED CERTIFICATE DISPLAY */
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-2.5 font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Certificate Issued & Authenticated: {myCert.certificateId}</span>
              </div>
              <span className="text-gray-500">Issued on {myCert.issuedDate}</span>
            </div>

            <CertificateView
              studentName={myCert.studentName || user.name}
              prn={myCert.prn || user.prn}
              track={myCert.track || user.track}
              certificateId={myCert.certificateId}
              startDate={myCert.startDate || "1st October 2026"}
              endDate={myCert.endDate || "9th October 2026"}
              issueDate={myCert.issuedDate || "10th October 2026"}
              showDownloadButton={true}
            />
          </div>
        ) : isEligible ? (
          /* ELIGIBLE BUT PENDING ADMIN RELEASE */
          <div className="bg-white dark:bg-[#181B20] rounded-3xl p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm text-center max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <FileCheck2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-[#1A1A1A] dark:text-white">
              Congratulations! You are Eligible for Certification 🎉
            </h2>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              You have completed all 9 days of challenges with clean academic integrity.
              Faculty mentors are currently auditing final submissions and generating official digitally signed certificates.
            </p>

            <div className="mt-6 p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] text-xs text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Days Solved:</span>
                <span className="font-bold text-emerald-600">9 / 9 Days (Complete)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Integrity Status:</span>
                <span className="font-bold text-emerald-600">Verified & Clean</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Assigned Track:</span>
                <span className="font-bold">{user.track} Track</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 mt-4">
              You will receive an email from <strong>technicalteamsvit@gmail.com</strong> once your PDF is released.
            </p>
          </div>
        ) : (
          /* NOT YET ELIGIBLE: PROGRESS CHECKLIST */
          <div className="bg-white dark:bg-[#181B20] rounded-3xl p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm max-w-xl mx-auto">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-[#1A1A1A] dark:text-white">
                Certificate Locked ({completedDays.size} / 9 Days Completed)
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Complete all 9 days of coding challenges to qualify for the official SVIT certificate.
              </p>
            </div>

            {/* Checklist */}
            <div className="space-y-3 text-xs mb-6">
              <div className="p-3.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#1A1A1A] dark:text-white">Complete all 9 Sprint Days</div>
                  <div className="text-gray-500">Catch-up days count towards eligibility!</div>
                </div>
                <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                  completedDays.size === 9 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {completedDays.size} / 9 Days
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#1A1A1A] dark:text-white">No Unresolved Flags or Failed Vivas</div>
                  <div className="text-gray-500">Pass viva explanation if flagged by faculty.</div>
                </div>
                <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                  !hasFailedViva && !hasUnresolvedFlag ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>
                  {!hasFailedViva && !hasUnresolvedFlag ? 'Passed' : 'Pending Review'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setCurrentTab('dashboard')}
              className="w-full py-3 rounded-xl font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] text-xs flex items-center justify-center gap-2"
            >
              <span>Continue Building on Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
