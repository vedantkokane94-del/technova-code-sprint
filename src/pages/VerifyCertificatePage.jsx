import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { SVITHubLogo } from '../components/BrandLogo';
import { CheckCircle2, XCircle, AlertOctagon, ArrowLeft, ShieldCheck, ShieldAlert } from 'lucide-react';
import { formatScore } from '../utils/scoring';

// In-memory rate limiting tracker (max 10 lookups per 30 seconds per client)
const RATE_LIMIT_WINDOW_MS = 30000;
const MAX_LOOKUPS_PER_WINDOW = 10;
let lookupTimestamps = [];

export const VerifyCertificatePage = ({ certificateId, onBack = null }) => {
  const { certificates = [], logVerification } = useApp();
  const [isRateLimited, setIsRateLimited] = useState(false);

  useEffect(() => {
    const now = Date.now();
    lookupTimestamps = lookupTimestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (lookupTimestamps.length >= MAX_LOOKUPS_PER_WINDOW) {
      setIsRateLimited(true);
    } else {
      lookupTimestamps.push(now);
      setIsRateLimited(false);
      if (certificateId && logVerification) {
        const clean = (certificateId || '').trim().toUpperCase();
        const found = certificates.find(c => (c.certificateId || '').trim().toUpperCase() === clean);
        const res = !found ? 'not_found' : (found.status === 'revoked' || found.revoked) ? 'revoked' : 'valid';
        logVerification(certificateId, res, {
          studentName: found?.studentName || 'Unknown',
          language: found?.language || found?.track || 'N/A'
        });
      }
    }
  }, [certificateId]);

  // Find issued certificate by ID (case-insensitive)
  const cleanId = (certificateId || '').trim().toUpperCase();
  const cert = certificates.find(c => (c.certificateId || '').trim().toUpperCase() === cleanId);

  const isRevoked = cert && (cert.status === 'revoked' || cert.revoked);
  const isValid = cert && !isRevoked;

  return (
    <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        
        {/* Navigation Back */}
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-[#B3122B] mb-6 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Technova Portal</span>
          </button>
        )}

        {/* Verification Card */}
        <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-10 border border-[#E8DEC8] dark:border-[#2E3440] shadow-xl relative overflow-hidden text-center">
          
          {/* Institutional Header Logo */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <SVITHubLogo className="w-14 h-14" />
          </div>

          <div className="text-[11px] font-bold uppercase tracking-wider text-[#B3122B] mb-1">
            Technical Skill Development Hub • SVIT Nashik
          </div>
          <h1 className="text-2xl font-black text-[#1A1A1A] dark:text-white">
            Certificate Authenticity Verification
          </h1>
          <p className="text-xs text-gray-500 mt-1 mb-6">
            Official Public Verification System • Sir Visvesvaraya Institute of Technology
          </p>

          {isRateLimited ? (
            <div className="py-8">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4">
                <AlertOctagon className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-amber-600">
                Rate Limit Exceeded
              </h2>
              <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto">
                Too many verification requests detected from this connection. Please wait 30 seconds before retrying to prevent automated scanning.
              </p>
            </div>
          ) : isRevoked ? (
            /* SECTION 4: REVOKED CERTIFICATE VIEW */
            <div className="py-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 font-bold text-sm mb-6 shadow-xs">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <span>This certificate has been revoked</span>
              </div>

              <div className="bg-red-50 dark:bg-red-950/20 rounded-2xl p-6 border border-red-200 dark:border-red-900/40 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-700 dark:text-red-300">Certificate ID:</span>
                  <span className="font-mono font-bold text-sm text-[#1A1A1A] dark:text-white">{cert.certificateId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-700 dark:text-red-300">Revocation Date:</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{cert.revokedAt || cert.issuedDate || "October 2026"}</span>
                </div>
                {(cert.revokedReason || cert.revocationReason) && (
                  <div className="pt-2 border-t border-red-200 dark:border-red-900/40">
                    <span className="text-[11px] font-bold uppercase text-red-700 dark:text-red-400">Reason for Revocation:</span>
                    <p className="text-xs text-red-900 dark:text-red-200 mt-0.5">{cert.revokedReason || cert.revocationReason}</p>
                  </div>
                )}
              </div>
            </div>
          ) : isValid ? (
            /* SECTION 4: VALID CERTIFICATE VIEW (Shows ONLY Name, Language, Final Score / 100, Challenge Name, Dates, Issue Date, Issuer) */
            <div>
              {/* Green "Verified" Banner */}
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-bold text-sm mb-6 shadow-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Verified Official Certificate</span>
              </div>

              {/* Certificate Details Card */}
              <div className="bg-[#FCF9F2] dark:bg-[#111317] rounded-2xl p-6 sm:p-7 border border-[#E8DEC8] dark:border-[#2E3440] text-left space-y-4">
                
                {/* Student Name */}
                <div className="pb-3 border-b border-[#E8DEC8]/60 dark:border-[#2E3440]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Recipient Student Name</span>
                  <div className="text-xl sm:text-2xl font-bold text-[#1A1A1A] dark:text-white font-serif">
                    {cert.studentName}
                  </div>
                </div>

                {/* Challenge Name & Track */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Challenge Name</span>
                    <div className="font-bold text-sm text-[#1A1A1A] dark:text-white">
                      Technova Code Sprint: 9 Days to Build
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Language Track</span>
                    <div className="font-bold text-sm text-[#B3122B] dark:text-[#ff8a9e]">
                      {cert.language || cert.track || 'Python'}
                    </div>
                  </div>
                </div>

                {/* Score & Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E8DEC8]/50 dark:border-[#2E3440]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Final Total Score</span>
                    <div className="font-black text-lg text-emerald-700 dark:text-emerald-400">
                      {formatScore(cert.score ?? 100)} / 100
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Challenge Dates</span>
                    <div className="font-medium text-xs text-gray-700 dark:text-gray-300">
                      13 Oct 2026 to 21 Oct 2026
                    </div>
                  </div>
                </div>

                {/* Issue Date & Issuer */}
                <div className="pt-2 border-t border-[#E8DEC8]/50 dark:border-[#2E3440] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-500">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Issue Date</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{cert.issuedDate || '22 Oct 2026'}</span>
                  </div>

                  <div className="sm:text-right">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Issuing Authority</span>
                    <span className="font-bold text-[#8B0D20] dark:text-[#ff8a9e]">Technical Skill Development Hub, SVIT Nashik</span>
                  </div>
                </div>

              </div>

              {/* Security Seal */}
              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Tamper-evident verification token: <strong className="font-mono text-[#B3122B]">{cert.certificateId}</strong></span>
              </div>
            </div>
          ) : (
            /* SECTION 4: NOT FOUND VIEW */
            <div className="py-8">
              <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-red-600">
                Certificate not found
              </h2>
              <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto">
                No verified certificate exists matching ID <strong className="font-mono text-gray-800 dark:text-gray-200">{certificateId || "N/A"}</strong>. Please check that the URL or certificate ID was entered accurately.
              </p>
            </div>
          )}

          {/* Institutional Footer */}
          <div className="mt-8 pt-6 border-t border-[#E8DEC8] dark:border-[#2E3440] text-xs text-gray-500">
            Sir Visvesvaraya Institute of Technology, Nashik • Pravara Rural Education Society
          </div>
        </div>

      </div>
    </div>
  );
};
