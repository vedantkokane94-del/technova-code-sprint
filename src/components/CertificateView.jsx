import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Share2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { downloadCertificatePdf, DEFAULT_TEMPLATE_CONFIG, determineCertificateType } from '../utils/certificateGenerator';

export const CertificateView = ({ 
  studentName = "Student Name",
  prn = "SVIT2024CS001",
  track = "Python",
  language = null,
  score = 100,
  certificateId = "TNV-CS-2026-0001-K7Q2",
  showDownloadButton = true,
  onDownload = null,
  templateConfig = {}
}) => {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [downloading, setDownloading] = useState(false);

  const displayLanguage = language || track || 'Python';
  const displayScore = typeof score === 'number' ? score.toFixed(1) : String(score);
  const activeConfig = { ...DEFAULT_TEMPLATE_CONFIG, ...templateConfig };
  const isPremium = activeConfig.templateVersion !== 'v1_classic';

  // Subtitle based on score
  const certType = determineCertificateType(score);
  const typeSubtitle = certType === 'Winner' 
    ? 'OF EXCELLENCE & MERIT' 
    : certType === 'Merit' 
    ? 'OF MERIT' 
    : 'OF COMPLETION';

  // Generate QR code for visual preview
  useEffect(() => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://technova.svit.ac.in';
    const verifyUrl = `${baseUrl}/verify/${certificateId}`;
    QRCode.toDataURL(verifyUrl, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error("QR Code error:", err));
  }, [certificateId]);

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      await downloadCertificatePdf({
        studentName,
        language: displayLanguage,
        score: displayScore,
        certificateId,
        type: certType,
        templateConfig: activeConfig
      });
      if (onDownload) onDownload();
    } catch (err) {
      console.error("PDF generation error:", err);
      alert(`Certificate download error: ${err.message || 'Please try again.'}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      
      {/* Certificate Sheet (A4 Landscape aspect ratio: 842 / 595 ≈ 1.415 : 1) */}
      <div 
        className="w-full max-w-[920px] aspect-[842/595] text-[#1A1A1A] relative overflow-hidden select-none shadow-2xl flex flex-col justify-between rounded-xs"
        style={{
          backgroundColor: isPremium ? '#FBF7EF' : '#F7F3EC',
          boxShadow: '0 15px 40px rgba(0, 0, 0, 0.12)'
        }}
      >
        {isPremium ? (
          <>
            {/* V2 PREMIUM 3-LAYER BORDERS */}
            {/* 1. 7 pt red frame inset 16 pt */}
            <div 
              className="absolute pointer-events-none border-[#B3122B]" 
              style={{ 
                top: '2.7%', 
                left: '1.9%', 
                right: '1.9%', 
                bottom: '2.7%', 
                borderWidth: '5.5px',
                borderStyle: 'solid'
              }}
            />

            {/* 2. 2 pt gold frame inset 25 pt */}
            <div 
              className="absolute pointer-events-none border-[#C9A24B]" 
              style={{ 
                top: '4.2%', 
                left: '3.0%', 
                right: '3.0%', 
                bottom: '4.2%', 
                borderWidth: '1.8px',
                borderStyle: 'solid'
              }}
            />

            {/* 3. 0.9 pt red line inset 31 pt */}
            <div 
              className="absolute pointer-events-none border-[#B3122B]" 
              style={{ 
                top: '5.2%', 
                left: '3.7%', 
                right: '3.7%', 
                bottom: '5.2%', 
                borderWidth: '0.8px',
                borderStyle: 'solid'
              }}
            />

            {/* 4 Corner Ornaments (Gold arcs + dots) */}
            <svg className="absolute top-[4.2%] left-[3.0%] w-8 h-8 sm:w-11 sm:h-11 pointer-events-none" viewBox="0 0 50 50">
              <circle cx="15" cy="15" r="3.2" fill="#C9A24B" />
              <path d="M 15 28 A 13 13 0 0 0 28 15" fill="none" stroke="#C9A24B" strokeWidth="1.3" />
              <path d="M 15 36 A 21 21 0 0 0 36 15" fill="none" stroke="#C9A24B" strokeWidth="1.3" />
              <path d="M 15 44 A 29 29 0 0 0 44 15" fill="none" stroke="#C9A24B" strokeWidth="1.3" />
            </svg>

            <svg className="absolute top-[4.2%] right-[3.0%] w-8 h-8 sm:w-11 sm:h-11 pointer-events-none rotate-90" viewBox="0 0 50 50">
              <circle cx="15" cy="15" r="3.2" fill="#C9A24B" />
              <path d="M 15 28 A 13 13 0 0 0 28 15" fill="none" stroke="#C9A24B" strokeWidth="1.3" />
              <path d="M 15 36 A 21 21 0 0 0 36 15" fill="none" stroke="#C9A24B" strokeWidth="1.3" />
              <path d="M 15 44 A 29 29 0 0 0 44 15" fill="none" stroke="#C9A24B" strokeWidth="1.3" />
            </svg>

            <svg className="absolute bottom-[4.2%] left-[3.0%] w-8 h-8 sm:w-11 sm:h-11 pointer-events-none -rotate-90" viewBox="0 0 50 50">
              <circle cx="15" cy="15" r="3.2" fill="#C9A24B" />
              <path d="M 15 28 A 13 13 0 0 0 28 15" fill="none" stroke="#C9A24B" strokeWidth="1.3" />
              <path d="M 15 36 A 21 21 0 0 0 36 15" fill="none" stroke="#C9A24B" strokeWidth="1.3" />
              <path d="M 15 44 A 29 29 0 0 0 44 15" fill="none" stroke="#C9A24B" strokeWidth="1.3" />
            </svg>

            <svg className="absolute bottom-[4.2%] right-[3.0%] w-8 h-8 sm:w-11 sm:h-11 pointer-events-none rotate-180" viewBox="0 0 50 50">
              <circle cx="15" cy="15" r="3.2" fill="#C9A24B" />
              <path d="M 15 28 A 13 13 0 0 0 28 15" fill="none" stroke="#C9A24B" strokeWidth="1.3" />
              <path d="M 15 36 A 21 21 0 0 0 36 15" fill="none" stroke="#C9A24B" strokeWidth="1.3" />
              <path d="M 15 44 A 29 29 0 0 0 44 15" fill="none" stroke="#C9A24B" strokeWidth="1.3" />
            </svg>

            {/* Left 9-DAYS Emblem */}
            <div 
              className="absolute z-20 flex flex-col items-center justify-center rounded-full bg-[#B3122B] border-2 border-[#C9A24B] shadow-sm"
              style={{
                top: '9.5%',
                left: '10.5%',
                width: '62px',
                height: '62px'
              }}
            >
              <div className="w-[50px] h-[50px] rounded-full border border-white flex flex-col items-center justify-center">
                <span className="text-white font-serif font-black text-xl leading-none">9</span>
                <span className="text-white font-sans font-bold text-[7px] tracking-wider mt-0.5">DAYS</span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* V1 CLASSIC BORDERS */}
            <div 
              className="absolute pointer-events-none border-[#B3122B]" 
              style={{ 
                top: '2.5%', 
                left: '2.5%', 
                right: '2.5%', 
                bottom: '2.5%', 
                borderWidth: '3.5px',
                borderStyle: 'solid'
              }}
            />
            <div 
              className="absolute pointer-events-none border-[#B3122B]" 
              style={{ 
                top: '3.5%', 
                left: '3.5%', 
                right: '3.5%', 
                bottom: '3.5%', 
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
            />
          </>
        )}

        {/* Verification QR Code (Right side) */}
        <div 
          className="absolute z-20 flex flex-col items-center bg-white p-1 rounded shadow-xs"
          style={{ 
            top: isPremium ? '9.5%' : '6.5%', 
            right: isPremium ? '9.5%' : '4.5%' 
          }}
        >
          {qrDataUrl ? (
            <img 
              src={qrDataUrl} 
              alt="Verification QR Code" 
              className="w-12 h-12 sm:w-15 sm:h-15 object-contain" 
            />
          ) : (
            <div className="w-12 h-12 sm:w-15 sm:h-15 bg-gray-100 animate-pulse rounded" />
          )}
          <span className="text-[6px] sm:text-[7.2px] font-bold text-[#5A5A5A] tracking-wider uppercase mt-0.5">
            SCAN TO VERIFY
          </span>
        </div>

        {/* CERTIFICATE HEADER */}
        <div className="relative z-10 pt-4 sm:pt-6 text-center">
          {/* Hub Logo */}
          <div className="flex justify-center mb-1">
            <div className={isPremium ? "w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-white border-2 border-[#C9A24B] p-1 flex items-center justify-center shadow-xs" : ""}>
              <img 
                src={activeConfig.hubLogoUrl || '/hub-logo.png'} 
                alt="Hub Logo" 
                className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
              />
            </div>
          </div>

          {/* Subheading */}
          <div 
            className="text-[7.5px] sm:text-[9.5px] font-sans font-bold tracking-[0.22em] uppercase"
            style={{ color: isPremium ? '#8E0E22' : '#555555' }}
          >
            TECHNICAL SKILL DEVELOPMENT HUB
          </div>
          <div className="text-[6.5px] sm:text-[8.5px] text-[#5A5A5A] font-sans font-normal tracking-[0.05em]">
            Sir Visvesvaraya Institute of Technology, Nashik
          </div>

          {/* CERTIFICATE Heading */}
          <h1 
            className="text-2xl sm:text-4xl md:text-5xl font-serif font-black text-[#B3122B] tracking-[0.12em] mt-1 sm:mt-1.5"
            style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif' }}
          >
            CERTIFICATE
          </h1>

          {/* Gold Divider (Premium) */}
          {isPremium && (
            <div className="flex items-center justify-center gap-2 my-1 max-w-[340px] mx-auto">
              <div className="flex-1 h-[1.4px] bg-[#C9A24B]" />
              <div className="w-3 h-3 bg-[#C9A24B] rotate-45 shrink-0" />
              <div className="flex-1 h-[1.4px] bg-[#C9A24B]" />
            </div>
          )}

          {/* OF COMPLETION */}
          <div className="text-[8.5px] sm:text-[12.5px] font-sans font-bold text-[#1A1A1A] tracking-[0.45em] uppercase mt-0.5">
            {typeSubtitle}
          </div>

          {/* This is proudly presented to */}
          <div className="text-[8px] sm:text-[11.5px] font-sans text-[#5A5A5A] mt-1 sm:mt-1.5">
            This is proudly presented to
          </div>
        </div>

        {/* STUDENT NAME & BODY */}
        <div className="relative z-10 text-center px-6 sm:px-12 my-auto">
          {/* Student Name */}
          <div className="inline-block relative my-0.5">
            <span 
              className="text-lg sm:text-2xl md:text-3xl italic font-serif text-[#1A1A1A] px-6 pb-0.5 inline-block"
              style={{ fontFamily: '"Times New Roman", Times, Georgia, serif' }}
            >
              {studentName}
            </span>
            <div 
              className="w-full h-[1.2px] mx-auto mt-0.5" 
              style={{ 
                backgroundColor: isPremium ? '#C9A24B' : '#CFAFA8',
                maxWidth: '480px' 
              }}
            />
          </div>

          {/* 3 Text Lines */}
          <div className="space-y-0.5 sm:space-y-1 text-[8px] sm:text-[11.5px] md:text-[12.5px] font-sans text-[#1A1A1A] leading-tight sm:leading-snug mt-1.5">
            <div>
              for successfully completing the <strong>Technova Code Sprint: 9 Days to Build</strong>,
            </div>
            <div>
              a daily coding challenge organised by the Technical Skill Development Hub, SVIT Nashik,
            </div>
            <div>
              from <strong className="text-[#B3122B]">14 Oct 2026</strong> to <strong className="text-[#B3122B]">22 Oct 2026</strong> , in the <strong className="text-[#B3122B]">[{displayLanguage}]</strong> track, with a score of <strong className="text-[#B3122B]">[{displayScore}]</strong> / 100.
            </div>
          </div>

          {/* Learn | Build | Grow */}
          <div 
            className="text-[9px] sm:text-[13px] italic font-serif tracking-[0.16em] mt-1.5 sm:mt-2"
            style={{ 
              fontFamily: '"Times New Roman", Times, Georgia, serif',
              color: isPremium ? '#8E0E22' : '#B3122B'
            }}
          >
            Learn &nbsp; | &nbsp; Build &nbsp; | &nbsp; Grow
          </div>
        </div>

        {/* SIGNATURES & SEAL FOOTER */}
        <div className="relative z-10 pb-4 sm:pb-6 px-8 sm:px-14 flex items-end justify-between">
          
          {/* Left: Technical Secretary */}
          <div className="text-center w-32 sm:w-48">
            <div className="h-6 sm:h-9 flex items-end justify-center mb-0.5">
              <img 
                src={activeConfig.secSigUrl || '/signature-technical-secretary.png'} 
                alt="Secretary Signature" 
                className="max-h-6 sm:max-h-9 object-contain"
              />
            </div>
            <div className="w-full h-[1px] bg-black mb-1" />
            <div className="font-bold text-[8.5px] sm:text-[11.5px] text-[#1A1A1A]">
              {activeConfig.secName || 'Vedant Kokane'}
            </div>
            <div className="text-[7px] sm:text-[9px] text-[#5A5A5A]">
              {activeConfig.secTitle || 'Technical Secretary, SVIT Nashik'}
            </div>
          </div>

          {/* Center: College Seal + Certificate ID */}
          <div className="flex flex-col items-center text-center pb-0.5">
            <img 
              src={activeConfig.sealUrl || '/college-seal.png'} 
              alt="College Seal" 
              className="w-12 h-12 sm:w-16 sm:h-16 object-contain mb-1"
            />
            <div className="text-[7px] sm:text-[8.5px] font-sans text-[#5A5A5A]">
              Certificate ID: &nbsp; {certificateId}
            </div>
          </div>

          {/* Right: Principal */}
          <div className="text-center w-32 sm:w-48">
            <div className="h-6 sm:h-9 flex items-end justify-center mb-0.5">
              <img 
                src={activeConfig.princSigUrl || '/signature-principal.png'} 
                alt="Principal Signature" 
                className="max-h-6 sm:max-h-9 object-contain"
              />
            </div>
            <div className="w-full h-[1px] bg-black mb-1" />
            <div className="font-bold text-[8.5px] sm:text-[11.5px] text-[#1A1A1A]">
              {activeConfig.princName || 'Dr. Sarang S. Pande'}
            </div>
            <div className="text-[7px] sm:text-[9px] text-[#5A5A5A]">
              {activeConfig.princTitle || 'Principal, SVIT Nashik'}
            </div>
          </div>

        </div>

      </div>

      {/* Action Buttons */}
      {showDownloadButton && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="px-6 py-3 rounded-xl font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 transition-all flex items-center gap-2 text-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? "Generating PDF..." : "Download Certificate PDF"}</span>
          </button>

          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/verify/${certificateId}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 rounded-xl font-bold bg-[#0A66C2] text-white hover:bg-[#084e96] transition-all flex items-center gap-2 text-sm shadow-md"
          >
            <Share2 className="w-4 h-4" />
            <span>Share on LinkedIn</span>
          </a>

          <a
            href={`/verify/${certificateId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-3 rounded-xl font-semibold bg-white dark:bg-[#181B20] text-gray-700 dark:text-gray-200 border border-[#E8DEC8] dark:border-[#2E3440] hover:text-[#B3122B] text-sm flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Verify Certificate</span>
          </a>
        </div>
      )}

    </div>
  );
};
