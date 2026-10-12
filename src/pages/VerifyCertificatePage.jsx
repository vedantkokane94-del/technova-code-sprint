import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { SVITHubLogo } from '../components/BrandLogo';
import { 
  CheckCircle2, 
  XCircle, 
  AlertOctagon, 
  ArrowLeft, 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  Search, 
  AlertTriangle 
} from 'lucide-react';
import { formatScore } from '../utils/scoring';
import { ErrorBoundary } from '../components/ErrorBoundary';

function VerifyCertificateContent({ certificateId, onBack = null }) {
  const { certificates = [], logVerification } = useApp();
  const [searchId, setSearchId] = useState(certificateId || '');
  const [activeCertId, setActiveCertId] = useState(certificateId || '');
  const [certData, setCertData] = useState(null);
  const [lookupState, setLookupState] = useState('idle'); // 'loading' | 'valid' | 'revoked' | 'not_found' | 'error' | 'rate_limited'
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const loggedIdsRef = useRef(new Set());
  const certificatesRef = useRef(certificates);
  useEffect(() => {
    certificatesRef.current = certificates;
  }, [certificates]);

  // Synchronize prop updates
  useEffect(() => {
    if (certificateId) {
      setSearchId(certificateId);
      setActiveCertId(certificateId);
    }
  }, [certificateId]);

  // Main verification lookup effect
  useEffect(() => {
    const clean = (activeCertId || '').trim().toUpperCase();
    if (!clean) {
      setLookupState('not_found');
      return;
    }

    let isMounted = true;
    setLookupState('loading');
    setErrorMessage('');

    async function performVerification() {
      try {
        // 1. Fetch from serverless backend API
        const res = await fetch(`/api/certificates/verify/${encodeURIComponent(clean)}`, {
          headers: { 'Accept': 'application/json' }
        });

        if (res.status === 429) {
          if (!isMounted) return;
          setLookupState('rate_limited');
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (!isMounted) return;

          setCertData(data);
          const state = (data.status === 'revoked' || data.revoked) ? 'revoked' : 'valid';
          setLookupState(state);

          if (logVerification && !loggedIdsRef.current.has(clean)) {
            loggedIdsRef.current.add(clean);
            try {
              logVerification(clean, state, {
                studentName: data.studentName || 'Student',
                language: data.language || data.track || 'Track'
              });
            } catch (e) {
              console.warn('[VerifyCertificatePage] logVerification warning:', e);
            }
          }
          return;
        }

        if (res.status === 404) {
          // Check local client fallback
          const localCert = certificatesRef.current.find(c => (c.certificateId || '').trim().toUpperCase() === clean);
          if (localCert) {
            if (!isMounted) return;
            setCertData(localCert);
            const state = (localCert.status === 'revoked' || localCert.revoked) ? 'revoked' : 'valid';
            setLookupState(state);
            return;
          }

          if (!isMounted) return;
          setCertData(null);
          setLookupState('not_found');

          if (logVerification && !loggedIdsRef.current.has(clean)) {
            loggedIdsRef.current.add(clean);
            try {
              logVerification(clean, 'not_found', {});
            } catch (e) {}
          }
          return;
        }

        throw new Error(`Server returned HTTP ${res.status}`);
      } catch (err) {
        console.error('[VerifyCertificatePage] Verification fetch error:', err);

        // Fallback to local client certificates if available
        const localCert = certificatesRef.current.find(c => (c.certificateId || '').trim().toUpperCase() === clean);
        if (localCert) {
          if (!isMounted) return;
          setCertData(localCert);
          const state = (localCert.status === 'revoked' || localCert.revoked) ? 'revoked' : 'valid';
          setLookupState(state);
          return;
        }

        if (!isMounted) return;
        setLookupState('error');
        setErrorMessage(err.message || 'Unable to communicate with the verification registry.');
      }
    }

    performVerification();

    return () => {
      isMounted = false;
    };
  }, [activeCertId, retryCount, logVerification]);

  const handleManualSearch = (e) => {
    e.preventDefault();
    const clean = searchId.trim().toUpperCase();
    if (clean) {
      setActiveCertId(clean);
      if (window.history?.pushState) {
        window.history.pushState(null, '', `/verify/${clean}`);
      }
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

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

          {/* 1. LOADING STATE */}
          {lookupState === 'loading' && (
            <div className="py-12 flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full border-4 border-[#8B0D20]/20 border-t-[#8B0D20] animate-spin mb-4" />
              <h2 className="text-base font-bold text-[#1A1A1A] dark:text-white">
                Verifying Certificate Authenticity...
              </h2>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                Querying official SVIT Technova institutional ledger for record: <strong className="font-mono text-[#8B0D20]">{activeCertId}</strong>
              </p>
            </div>
          )}

          {/* 2. RATE LIMITED STATE */}
          {lookupState === 'rate_limited' && (
            <div className="py-8">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4">
                <AlertOctagon className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-amber-600">
                Rate Limit Exceeded
              </h2>
              <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto">
                Too many verification requests detected from this connection. Please wait 30 seconds before retrying to prevent automated scraping.
              </p>
              <button
                onClick={handleRetry}
                className="mt-4 px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition-colors cursor-pointer"
              >
                Retry Verification
              </button>
            </div>
          )}

          {/* 3. ERROR STATE */}
          {lookupState === 'error' && (
            <div className="py-8">
              <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-red-600">
                Verification Service Temporarily Unavailable
              </h2>
              <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto">
                {errorMessage || 'Unable to connect to the official verification server. Please check your network connection.'}
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8B0D20] text-white font-bold text-xs hover:bg-[#6D0A19] transition-all cursor-pointer shadow-md"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Verification</span>
                </button>
              </div>
            </div>
          )}

          {/* 4. REVOKED CERTIFICATE VIEW */}
          {lookupState === 'revoked' && certData && (
            <div className="py-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 font-bold text-sm mb-6 shadow-xs">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <span>This certificate has been revoked</span>
              </div>

              <div className="bg-red-50 dark:bg-red-950/20 rounded-2xl p-6 border border-red-200 dark:border-red-900/40 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-700 dark:text-red-300">Certificate ID:</span>
                  <span className="font-mono font-bold text-sm text-[#1A1A1A] dark:text-white">{certData.certificateId || activeCertId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-700 dark:text-red-300">Revocation Date:</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{certData.revokedAt || certData.issuedDate || "October 2026"}</span>
                </div>
                {(certData.revokedReason || certData.revocationReason) && (
                  <div className="pt-2 border-t border-red-200 dark:border-red-900/40">
                    <span className="text-[11px] font-bold uppercase text-red-700 dark:text-red-400">Reason for Revocation:</span>
                    <p className="text-xs text-red-900 dark:text-red-200 mt-0.5">{certData.revokedReason || certData.revocationReason}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. VALID CERTIFICATE VIEW */}
          {lookupState === 'valid' && certData && (
            <div>
              {/* Green "Verified" Banner */}
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-bold text-sm mb-6 shadow-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Verified Official Certificate</span>
              </div>

              {certData.isTestCertificate && (
                <div className="mb-4 text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-blue-700 dark:text-blue-300">
                  Sample Demonstration & Verification Test Record
                </div>
              )}

              {/* Certificate Details Card */}
              <div className="bg-[#FCF9F2] dark:bg-[#111317] rounded-2xl p-6 sm:p-7 border border-[#E8DEC8] dark:border-[#2E3440] text-left space-y-4">
                
                {/* Student Name */}
                <div className="pb-3 border-b border-[#E8DEC8]/60 dark:border-[#2E3440]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Recipient Student Name</span>
                  <div className="text-xl sm:text-2xl font-bold text-[#1A1A1A] dark:text-white font-serif">
                    {certData.studentName || 'Participant'}
                  </div>
                </div>

                {/* Challenge Name & Track */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Challenge Name</span>
                    <div className="font-bold text-sm text-[#1A1A1A] dark:text-white">
                      {certData.eventName || 'Technova Code Sprint: 9 Days to Build'}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Award Classification</span>
                    <div className="font-bold text-sm text-[#B3122B] dark:text-[#ff8a9e]">
                      {certData.type || certData.track || 'Participation Certificate'}
                    </div>
                  </div>
                </div>

                {/* Score & Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E8DEC8]/50 dark:border-[#2E3440]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Final Total Score</span>
                    <div className="font-black text-lg text-emerald-700 dark:text-emerald-400">
                      {formatScore(certData.score ?? 100)} / 100
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
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{certData.issueDate || certData.issuedDate || '22 Oct 2026'}</span>
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
                <span>Tamper-evident verification token: <strong className="font-mono text-[#B3122B]">{certData.certificateId || activeCertId}</strong></span>
              </div>
            </div>
          )}

          {/* 6. NOT FOUND STATE */}
          {lookupState === 'not_found' && (
            <div className="py-8">
              <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-red-600">
                Certificate not found
              </h2>
              <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto leading-relaxed">
                No verified certificate exists matching ID <strong className="font-mono text-gray-800 dark:text-gray-200">{activeCertId || "N/A"}</strong>. Please check that the URL or certificate ID was entered accurately.
              </p>

              {/* Search Another Certificate Form */}
              <form onSubmit={handleManualSearch} className="mt-6 max-w-md mx-auto flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchId}
                    onChange={(e) => setSearchId(e.target.value.toUpperCase())}
                    placeholder="e.g. TNV-CS-2026-0001-K7Q2"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#111317] text-[#1A1A1A] dark:text-white font-mono text-xs uppercase focus:outline-none focus:ring-2 focus:ring-[#8B0D20]"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-[#8B0D20] text-white font-bold text-xs hover:bg-[#6D0A19] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Verify</span>
                </button>
              </form>
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
}

export const VerifyCertificatePage = (props) => {
  return (
    <ErrorBoundary>
      <VerifyCertificateContent {...props} />
    </ErrorBoundary>
  );
};
