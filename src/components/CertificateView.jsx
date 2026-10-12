import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Share2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { downloadCertificatePdf, DEFAULT_TEMPLATE_CONFIG } from '../utils/certificateGenerator';

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

  // Generate QR code for visual preview
  useEffect(() => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://technova-sprint.svit.ac.in';
    const verifyUrl = `${baseUrl}/verify/${certificateId}`;
    QRCode.toDataURL(verifyUrl, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error("QR Code error:", err));
  }, [certificateId]);

  // High-precision vector PDF generation with pdf-lib matching certificate-template.pdf
  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      await downloadCertificatePdf({
        studentName,
        language: displayLanguage,
        score: displayScore,
        certificateId,
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
        className="w-full max-w-[920px] aspect-[842/595] bg-[#F7F3EC] text-[#1A1A1A] relative overflow-hidden select-none shadow-2xl flex flex-col justify-between rounded-xs"
        style={{
          boxShadow: '0 15px 40px rgba(0, 0, 0, 0.12)'
        }}
      >
        {/* Outer Red Frame: 4.5 pt inset 21 pt */}
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

        {/* Inner Thin Red Line: 1.1 pt inset 30 pt */}
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

        {/* Verification QR Code: top-right corner */}
        <div 
          className="absolute z-20 flex flex-col items-center bg-white p-1 rounded border border-[#CFAFA8]/40 shadow-xs"
          style={{ top: '6.5%', right: '4.5%' }}
        >
          {qrDataUrl ? (
            <img 
              src={qrDataUrl} 
              alt="Verification QR Code" 
              className="w-12 h-12 sm:w-16 sm:h-16 object-contain" 
            />
          ) : (
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 animate-pulse rounded" />
          )}
          <span className="text-[6px] sm:text-[7.5px] font-black text-[#555555] tracking-wider uppercase mt-0.5">
            SCAN TO VERIFY
          </span>
        </div>

        {/* CERTIFICATE HEADER */}
        <div className="relative z-10 pt-5 sm:pt-7 text-center">
          {/* Hub Logo: 94 x 94 pt, centered */}
          <div className="flex justify-center mb-1">
            <img 
              src={activeConfig.hubLogoUrl || '/hub-logo.png'} 
              alt="Hub Logo" 
              className="w-14 h-14 sm:w-20 sm:h-20 object-contain drop-shadow-xs"
            />
          </div>

          {/* Subheading */}
          <div className="text-[7.5px] sm:text-[9.5px] text-[#555555] font-sans font-medium tracking-[0.22em] uppercase">
            TECHNICAL SKILL DEVELOPMENT HUB  •  SVIT NASHIK
          </div>

          {/* CERTIFICATE */}
          <h1 
            className="text-2xl sm:text-4xl md:text-5xl font-serif font-black text-[#B3122B] tracking-[0.1em] mt-1 sm:mt-2"
            style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif' }}
          >
            CERTIFICATE
          </h1>

          {/* OF COMPLETION */}
          <div className="text-[8.5px] sm:text-[12.5px] font-sans font-medium text-[#1A1A1A] tracking-[0.45em] uppercase mt-0.5">
            OF COMPLETION
          </div>

          {/* This is proudly presented to */}
          <div className="text-[8px] sm:text-[11.5px] font-sans text-[#555555] mt-1 sm:mt-2">
            This is proudly presented to
          </div>
        </div>

        {/* STUDENT NAME & BODY */}
        <div className="relative z-10 text-center px-6 sm:px-12 my-auto">
          {/* Student Name (Times Italic with 1 pt line #CFAFA8 under it) */}
          <div className="inline-block relative my-1">
            <span 
              className="text-lg sm:text-2xl md:text-3xl italic font-serif text-[#1A1A1A] px-6 pb-1 inline-block"
              style={{ fontFamily: '"Times New Roman", Times, Georgia, serif' }}
            >
              {studentName}
            </span>
            <div 
              className="w-full h-[1px] bg-[#CFAFA8] mx-auto mt-0.5" 
              style={{ maxWidth: '460px' }}
            />
          </div>

          {/* 3 Text Lines */}
          <div className="space-y-0.5 sm:space-y-1 text-[8px] sm:text-[11.5px] md:text-[12.5px] font-sans text-[#1A1A1A] leading-tight sm:leading-snug mt-2">
            <div>
              for successfully completing the <strong>Technova Code Sprint: 9 Days to Build</strong>,
            </div>
            <div>
              a daily coding challenge organised by the Technical Skill Development Hub, SVIT Nashik,
            </div>
            <div>
              from <strong className="text-[#B3122B]">13 Oct 2026</strong> to <strong className="text-[#B3122B]">21 Oct 2026</strong> , in the <strong className="text-[#B3122B]">[{displayLanguage}]</strong> track, with a score of <strong className="text-[#B3122B]">[{displayScore}]</strong> / 100.
            </div>
          </div>

          {/* Learn | Build | Grow */}
          <div 
            className="text-[9px] sm:text-[12.5px] italic font-serif text-[#B3122B] tracking-[0.16em] mt-2 sm:mt-3"
            style={{ fontFamily: '"Times New Roman", Times, Georgia, serif' }}
          >
            Learn &nbsp; | &nbsp; Build &nbsp; | &nbsp; Grow
          </div>
        </div>

        {/* SIGNATURES & SEAL FOOTER */}
        <div className="relative z-10 pb-5 sm:pb-7 px-8 sm:px-14 flex items-end justify-between">
          
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
            <div className="text-[7px] sm:text-[9.5px] text-[#555555]">
              {activeConfig.secTitle || 'Technical Secretary, SVIT Nashik'}
            </div>
          </div>

          {/* Center: College Seal + Certificate ID */}
          <div className="flex flex-col items-center text-center pb-0.5">
            <img 
              src={activeConfig.sealUrl || '/college-seal.png'} 
              alt="College Seal" 
              className="w-12 h-12 sm:w-18 sm:h-18 object-contain mb-1"
            />
            <div className="text-[7px] sm:text-[9px] font-sans text-[#555555]">
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
            <div className="text-[7px] sm:text-[9.5px] text-[#555555]">
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
