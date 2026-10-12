import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { SVITHubLogo, DurgaMataSketch } from './BrandLogo';
import { Download, Share2, ShieldCheck, Award } from 'lucide-react';

export const CertificateView = ({ 
  studentName = "Student Name",
  prn = "SVIT2024CS001",
  track = "Python",
  language = null,
  score = 100,
  certificateId = "TNV-CS-2026-0001-K7Q2",
  startDate = "13 Oct 2026",
  endDate = "21 Oct 2026",
  issueDate = "22 Oct 2026",
  showDownloadButton = true,
  onDownload = null
}) => {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const certRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  const displayLanguage = language || track || 'Python';
  const displayScore = typeof score === 'number' ? (Math.floor(score * 10) / 10).toFixed(1) : score;

  // Generate verification URL QR Code (Section 4)
  useEffect(() => {
    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const verifyUrl = `${baseUrl}/verify/${certificateId}`;
    QRCode.toDataURL(verifyUrl, {
      width: 140,
      margin: 2, // quiet zone
      color: {
        dark: '#8B0D20',
        light: '#FFFFFF'
      }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error("QR Code error:", err));
  }, [certificateId]);

  // Export as high quality Landscape A4 PDF matching exact on-screen certificate layout
  const handleDownloadPDF = async () => {
    if (!certRef.current) return;
    setDownloading(true);
    try {
      const images = certRef.current.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      );

      await new Promise(r => setTimeout(r, 100));

      const targetEl = certRef.current;
      const originalWidth = targetEl.offsetWidth;
      const originalHeight = targetEl.offsetHeight;

      const canvas = await html2canvas(targetEl, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#FCF9F2',
        onclone: (clonedDoc, clonedElement) => {
          clonedElement.style.width = `${originalWidth}px`;
          clonedElement.style.height = `${originalHeight}px`;
          clonedElement.style.maxWidth = 'none';

          const colorCanvas = clonedDoc.createElement('canvas');
          colorCanvas.width = 1;
          colorCanvas.height = 1;
          const ctx = colorCanvas.getContext('2d', { willReadFrequently: true });

          const toRgba = (colorStr) => {
            if (!colorStr) return colorStr;
            const s = String(colorStr).trim();
            if (!s.includes('okl') && !s.includes('color-mix') && !s.includes('color(')) {
              return s;
            }
            try {
              ctx.clearRect(0, 0, 1, 1);
              ctx.fillStyle = '#000000';
              ctx.fillStyle = s;
              const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
              return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
            } catch (e) {
              return s;
            }
          };

          const colorProps = [
            'color', 'backgroundColor', 'borderColor',
            'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
            'outlineColor', 'textDecorationColor', 'fill', 'stroke'
          ];

          const allNodes = [clonedElement, ...clonedElement.querySelectorAll('*')];
          for (const node of allNodes) {
            const comp = clonedDoc.defaultView.getComputedStyle(node);
            for (const prop of colorProps) {
              const val = comp[prop];
              if (val && (val.includes('okl') || val.includes('color-mix') || val.includes('color('))) {
                node.style.setProperty(prop, toRgba(val), 'important');
              }
            }
            if (comp.boxShadow && (comp.boxShadow.includes('okl') || comp.boxShadow.includes('color-mix'))) {
              node.style.boxShadow = 'none';
            }
          }
        }
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const pdfWidth = 297;
      const pdfHeight = (canvasHeight * pdfWidth) / canvasWidth;
      const offsetY = Math.max(0, (210 - pdfHeight) / 2);

      pdf.addImage(imgData, 'PNG', 0, offsetY, pdfWidth, Math.min(pdfHeight, 210));
      
      const safeName = (studentName || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeCertId = (certificateId || 'TNV-CS-2026-0001').replace(/[^a-zA-Z0-9_-]/g, '_');
      pdf.save(`Certificate_${safeCertId}_${safeName}.pdf`);
      
      if (onDownload) onDownload();
    } catch (err) {
      console.error("PDF generation error:", err);
      alert(`Certificate download failed: ${err.message || 'Error capturing canvas'}. Please try printing or taking a screenshot.`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      
      {/* Certificate Sheet (A4 Landscape aspect ratio: ~1.414 : 1) */}
      <div 
        ref={certRef}
        className="w-full max-w-[1000px] aspect-[1.414/1] bg-[#FCF9F2] text-[#1A1A1A] p-6 sm:p-10 relative overflow-hidden select-none border-[12px] border-[#B3122B] shadow-2xl flex flex-col justify-between"
        style={{
          boxShadow: '0 20px 50px rgba(179, 18, 43, 0.15)'
        }}
      >
        {/* Decorative Golden & Crimson Inset Border */}
        <div className="absolute inset-2 border-2 border-[#E5A93B] pointer-events-none"></div>
        <div className="absolute inset-3 border pointer-events-none" style={{ borderColor: 'rgba(179, 18, 43, 0.3)' }}></div>

        {/* Corner Accents */}
        <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-[#B3122B] pointer-events-none"></div>
        <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-[#B3122B] pointer-events-none"></div>
        <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-[#B3122B] pointer-events-none"></div>
        <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-[#B3122B] pointer-events-none"></div>

        {/* Center Shakti Vidya Sacred Background Watermark */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.06] w-[460px] h-[460px] text-[#8B0D20] flex flex-col items-center justify-center">
          <DurgaMataSketch className="w-[340px] h-[340px] text-[#8B0D20]" color="#8B0D20" />
          <div className="text-center mt-2 tracking-[0.3em] font-serif font-black uppercase text-xl text-[#8B0D20]">
            शक्ति • विद्या
          </div>
          <div className="text-[12px] font-mono font-black tracking-[0.35em] text-[#8B0D20] mt-0.5">
            SHAKTI • VIDYA
          </div>
        </div>

        {/* HEADER SECTION */}
        <div className="relative z-10 flex items-start justify-between pb-3" style={{ borderBottom: '2px solid rgba(179, 18, 43, 0.2)' }}>
          <div className="flex items-center gap-3.5">
            <SVITHubLogo className="w-14 h-14 sm:w-18 sm:h-18 shadow-md ring-2 ring-[#B3122B]" />
            <div className="text-left">
              <span className="text-[9px] sm:text-[11px] font-bold tracking-widest text-[#B3122B] uppercase block">
                Pravara Rural Education Society's
              </span>
              <h1 className="text-xs sm:text-base md:text-lg font-black text-[#1A1A1A] tracking-tight leading-tight">
                SIR VISVESVARAYA INSTITUTE OF TECHNOLOGY, NASHIK
              </h1>
              <p className="text-[10px] sm:text-xs font-bold text-[#8B0D20]">
                Technical Skill Development Hub • Learn • Build • Grow
              </p>
            </div>
          </div>

          {/* Section 3 & 4: VERIFICATION QR IN TOP-RIGHT CORNER (70x70 pt with SCAN TO VERIFY) */}
          <div className="flex flex-col items-center text-center bg-white p-1.5 rounded-lg border border-[#E8DEC8] shadow-xs">
            {qrDataUrl ? (
              <img 
                src={qrDataUrl} 
                alt="Verification QR Code" 
                className="w-[70px] h-[70px] sm:w-[80px] sm:h-[80px] object-contain bg-white" 
              />
            ) : (
              <div className="w-[70px] h-[70px] sm:w-[80px] sm:h-[80px] bg-gray-100 animate-pulse rounded"></div>
            )}
            <span className="text-[7.5px] sm:text-[8px] font-black text-[#8B0D20] tracking-wider uppercase mt-1">
              SCAN TO VERIFY
            </span>
          </div>
        </div>

        {/* MAIN BODY CONTENT */}
        <div className="relative z-10 text-center my-auto py-2">
          
          <div className="inline-block relative">
            <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-[#B3122B] tracking-widest uppercase mb-1">
              CERTIFICATE OF COMPLETION
            </h2>
            <div className="w-32 h-1 bg-[#E5A93B] mx-auto rounded-full"></div>
          </div>

          <p className="text-xs sm:text-sm text-[#4B5563] font-medium mt-2 italic">
            This is proudly presented to
          </p>

          {/* Student Name */}
          <div className="my-1.5 sm:my-2">
            <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#1A1A1A] font-serif border-b-2 border-dashed border-[#B3122B] pb-1 px-8 inline-block tracking-wide">
              {studentName}
            </span>
            <span className="block text-[11px] sm:text-xs font-mono font-bold text-[#6B7280] mt-1">
              Roll No / PRN: {prn}
            </span>
          </div>

          {/* Section 3: Exact Wording Requirement */}
          <p className="text-xs sm:text-sm text-[#374151] max-w-2xl mx-auto leading-relaxed font-serif px-4">
            for successfully completing the{' '}
            <strong className="text-[#B3122B] font-sans font-bold">
              Technova Code Sprint: 9 Days to Build
            </strong>, a daily coding challenge organised by the{' '}
            <strong>Technical Skill Development Hub, SVIT Nashik</strong>, from{' '}
            <span className="font-semibold text-[#1A1A1A]">{startDate}</span> to{' '}
            <span className="font-semibold text-[#1A1A1A]">{endDate}</span>, in the{' '}
            <strong className="text-[#B3122B] font-bold underline decoration-[#B3122B]">{displayLanguage}</strong> track, with a score of{' '}
            <strong className="text-[#8B0D20] font-black text-sm sm:text-base underline decoration-[#E5A93B]">{displayScore} / 100</strong>.
          </p>

          {/* Tagline */}
          <div className="mt-2.5 flex items-center justify-center gap-3 text-xs font-black text-[#8B0D20] tracking-wider uppercase">
            <span>Learn</span>
            <span className="text-[#E5A93B]">•</span>
            <span>Build</span>
            <span className="text-[#E5A93B]">•</span>
            <span>Grow</span>
          </div>
        </div>

        {/* FOOTER: SIGNATURES & COLLEGE SEAL WITH CERTIFICATE ID */}
        <div className="relative z-10 pt-3 flex items-end justify-between px-2" style={{ borderTop: '1px solid rgba(179, 18, 43, 0.2)' }}>
          
          {/* Signature 1: Technical Secretary */}
          <div className="text-center w-40 sm:w-52">
            <div className="h-8 flex items-center justify-center font-serif italic text-sm sm:text-base text-[#8B0D20] font-bold">
              Vedant Kokane
            </div>
            <div className="w-full border-t border-[#9CA3AF] mt-1 pt-1">
              <div className="font-bold text-xs sm:text-sm text-[#1A1A1A]">Vedant Kokane</div>
              <div className="text-[10px] sm:text-xs text-[#4B5563] font-medium">Technical Secretary</div>
              <div className="text-[9px] text-[#9CA3AF]">SVIT Nashik</div>
            </div>
          </div>

          {/* Central Official Golden Seal + Certificate ID printed next to seal */}
          <div className="text-center px-2 flex flex-col items-center">
            <div 
              className="w-14 h-14 sm:w-18 sm:h-18 rounded-full border-2 border-double border-[#E5A93B] flex flex-col items-center justify-center text-[#8B0D20] shadow-xs relative mx-auto"
              style={{ background: 'radial-gradient(circle, #FFFDF8 0%, #FEF3C7 100%)' }}
            >
              <Award className="w-4 h-4 sm:w-5 sm:h-5 text-[#E5A93B]" />
              <span className="text-[6.5px] sm:text-[7.5px] font-black uppercase tracking-tighter text-[#B3122B]">
                OFFICIAL SEAL
              </span>
              <span className="text-[5.5px] sm:text-[6.5px] text-[#6B7280] font-bold">
                TSDH • SVIT
              </span>
            </div>
            {/* Section 3: Certificate ID format printed next to the college seal */}
            <div className="mt-1 font-mono font-black text-[9px] sm:text-[10.5px] text-[#B3122B] tracking-wider px-2 py-0.5 rounded bg-white border border-[#E8DEC8]">
              {certificateId}
            </div>
          </div>

          {/* Signature 2: Principal */}
          <div className="text-center w-40 sm:w-52">
            <div className="h-8 flex items-center justify-center font-serif italic text-sm sm:text-base text-[#8B0D20] font-bold">
              Dr. S. S. Pande
            </div>
            <div className="w-full border-t border-[#9CA3AF] mt-1 pt-1">
              <div className="font-bold text-xs sm:text-sm text-[#1A1A1A]">Dr. S. S. Pande</div>
              <div className="text-[10px] sm:text-xs text-[#4B5563] font-medium">Principal</div>
              <div className="text-[9px] text-[#9CA3AF]">SVIT Nashik</div>
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
            <span>{downloading ? "Generating High-Res PDF..." : "Download PDF Certificate"}</span>
          </button>

          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${import.meta.env.VITE_APP_URL || window.location.origin}/verify/${certificateId}`)}`}
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
            <span>Public Verification URL</span>
          </a>
        </div>
      )}
    </div>
  );
};
