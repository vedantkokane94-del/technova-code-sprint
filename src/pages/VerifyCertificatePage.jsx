import React from 'react';
import { useApp } from '../context/AppContext';
import { SVITHubLogo, DurgaMataSketch } from '../components/BrandLogo';
import { ShieldCheck, CheckCircle2, XCircle, Award, Calendar, BookOpen, Hash, ArrowLeft, ExternalLink } from 'lucide-react';

export const VerifyCertificatePage = ({ certificateId, onBack = null }) => {
  const { certificates = [], submissions = [] } = useApp();

  // Find issued certificate by ID
  const cert = certificates.find(c => c.certificateId.toUpperCase() === (certificateId || '').toUpperCase());

  const isValid = !!cert;

  return (
    <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        
        {/* Navigation Back */}
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-[#B3122B] mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Technova Portal</span>
          </button>
        )}

        {/* Verification Card */}
        <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-10 border border-[#E8DEC8] dark:border-[#2E3440] shadow-xl relative overflow-hidden text-center">
          
          {/* Header Logos */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <SVITHubLogo className="w-14 h-14" />
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-[#B3122B] flex items-center justify-center border border-amber-500/20 shadow-xs">
              <DurgaMataSketch className="w-8 h-8" />
            </div>
          </div>

          <div className="text-[11px] font-bold uppercase tracking-wider text-[#B3122B] mb-1">
            Technical Skill Development Hub • SVIT Nashik
          </div>
          <h1 className="text-2xl font-black text-[#1A1A1A] dark:text-white">
            Official Certificate Verification
          </h1>
          <p className="text-xs text-gray-500 mt-1 mb-8">
            Public authenticity validator for Technova Code Sprint: 9 Days to Build
          </p>

          {isValid ? (
            <div>
              {/* Authenticity Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-bold text-sm mb-6 shadow-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Verified Official Certificate</span>
              </div>

              {/* Certificate Details Card */}
              <div className="bg-[#FCF9F2] dark:bg-[#111317] rounded-2xl p-6 border border-[#E8DEC8] dark:border-[#2E3440] text-left space-y-4">
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-400">Recipient Name</span>
                  <div className="text-lg font-bold text-[#1A1A1A] dark:text-white font-serif">
                    {cert.studentName}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-gray-400">Certificate ID</span>
                    <div className="font-mono font-bold text-sm text-[#B3122B]">
                      {cert.certificateId}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-gray-400">Roll Number</span>
                    <div className="font-mono font-semibold text-sm text-gray-700 dark:text-gray-300">
                      {cert.prn}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-gray-400">Completed Track</span>
                    <div className="font-bold text-sm text-gray-800 dark:text-gray-200">
                      {cert.track} Track
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-gray-400">Completion Duration</span>
                    <div className="font-medium text-xs text-gray-700 dark:text-gray-300">
                      {cert.startDate} - {cert.endDate}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E8DEC8]/50 dark:border-[#2E3440] flex items-center justify-between text-xs text-gray-500">
                  <span>Days Completed: <strong>9 of 9 Days</strong></span>
                  <span>Issued: <strong>{cert.issuedDate}</strong></span>
                </div>
              </div>

              {/* Signatures Verified */}
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-around text-center text-xs">
                <div>
                  <div className="font-bold text-[#1A1A1A] dark:text-white">Vedant Kokane</div>
                  <div className="text-[10px] text-gray-500">Technical Secretary</div>
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#B3122B]"></div>
                <div>
                  <div className="font-bold text-[#1A1A1A] dark:text-white">Dr. S. S. Pande</div>
                  <div className="text-[10px] text-gray-500">Principal, SVIT Nashik</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8">
              <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-red-600">
                Invalid or Unverified Certificate ID
              </h2>
              <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto">
                No certificate found matching ID <strong className="font-mono text-gray-800 dark:text-gray-200">{certificateId}</strong>. 
                Please verify that the ID was entered correctly or contact the Technical Skill Development Hub.
              </p>
            </div>
          )}

          {/* Social Links */}
          <div className="mt-8 pt-6 border-t border-[#E8DEC8] dark:border-[#2E3440] flex items-center justify-center gap-6 text-xs text-gray-500">
            <a 
              href="https://instagram.com/tsdh_svit" 
              target="_blank" 
              rel="noreferrer"
              className="text-[#B3122B] hover:underline font-semibold flex items-center gap-1"
            >
              <span>Instagram: @tsdh_svit</span>
            </a>
            <span>•</span>
            <a 
              href="https://linkedin.com/company/technical-skill-development-hub" 
              target="_blank" 
              rel="noreferrer"
              className="text-[#0A66C2] hover:underline font-semibold flex items-center gap-1"
            >
              <span>LinkedIn Group</span>
            </a>
          </div>

        </div>
      </div>
    </div>
  );
};
