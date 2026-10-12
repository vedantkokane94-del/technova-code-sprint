import QRCode from 'qrcode';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';

// Canonical Public Base URL for QR verification (NEVER localhost)
export function getPublicBaseUrl() {
  const envUrl = (typeof process !== 'undefined' && process.env?.PUBLIC_BASE_URL) ||
                 (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PUBLIC_BASE_URL) ||
                 (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL);
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1')) {
    return window.location.origin.replace(/\/$/, '');
  }
  // Safe default: official college canonical domain
  return 'https://technova.svit.ac.in';
}

// Generate random non-guessable certificate ID: CERT-2026-XXXXXXXX
export function generateCertificateId() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 8; i++) {
      rand += chars[bytes[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 8; i++) {
      rand += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return `CERT-2026-${rand}`;
}

// Compute certificate type (Winner / Merit / Participation)
export function determineCertificateType(score, rank = null) {
  const numScore = Number(score) || 0;
  if ((rank && Number(rank) <= 3) || numScore >= 90) {
    return 'Winner';
  }
  if (numScore >= 75) {
    return 'Merit';
  }
  return 'Participation';
}

// Safely sanitize strings for standard pdf-lib WinAnsi font encoding
export function sanitizeForPdfFont(text) {
  if (!text) return '';
  return String(text)
    .normalize('NFKD')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

// Default Template Signatories & Assets
export const DEFAULT_TEMPLATE_CONFIG = {
  hubLogoUrl: '/hub-logo.png',
  sealUrl: '/college-seal.png',
  secSigUrl: '/signature-technical-secretary.png',
  princSigUrl: '/signature-principal.png',
  secName: 'Vedant Kokane',
  secTitle: 'Technical Secretary, SVIT Nashik',
  princName: 'Dr. Sarang S. Pande',
  princTitle: 'Principal, SVIT Nashik',
  isApproved: false,
  approvedAt: null,
  approvedBy: null
};

// Helper to fetch binary image bytes in browser or Node
async function fetchImageBytes(urlOrDataUri) {
  if (typeof window !== 'undefined' && urlOrDataUri) {
    if (urlOrDataUri.startsWith('data:')) {
      const base64 = urlOrDataUri.split(',')[1];
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
    const response = await fetch(urlOrDataUri);
    if (!response.ok) throw new Error(`Failed to load asset: ${urlOrDataUri}`);
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
  return null;
}

/**
 * Generate A4 Landscape (841.89 x 595.28 pt) Certificate PDF using pdf-lib
 * Matches certificate-template.pdf pixel-for-pixel with exact layout, fonts, and colors
 */
export async function generateCertificatePdf({
  studentName = 'Student Name',
  eventName = 'Technova Code Sprint: 9 Days to Build',
  language = 'Python',
  score = '75.0',
  rank = null,
  type = 'Participation',
  certificateId = 'CERT-2026-TEST0001',
  issueDate = '22 Oct 2026',
  templateConfig = {}
}) {
  const config = { ...DEFAULT_TEMPLATE_CONFIG, ...templateConfig };
  const verifyDomain = getPublicBaseUrl();
  const verifyUrl = `${verifyDomain}/verify/${certificateId}`;

  // 1. Initialize Document
  const safeName = sanitizeForPdfFont(studentName);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle('Technova Code Sprint Certificate');
  pdfDoc.setAuthor(safeName);
  pdfDoc.setSubject(`Certificate of ${type} - ${eventName}`);
  pdfDoc.setKeywords(['Technova', 'Code Sprint', 'SVIT Nashik', 'Certificate', certificateId, type]);

  // A4 Landscape: 841.89 x 595.28 pt
  const width = 841.89;
  const height = 595.28;
  const page = pdfDoc.addPage([width, height]);

  // Helper for coordinates: top-down measurement
  const fromTop = (yTop) => height - yTop;

  // 2. Embed Standard Fonts (Times Bold, Times Italic, Helvetica, Helvetica Bold)
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 3. Load & Embed PNG Images
  let hubLogoImg, sealImg, secSigImg, princSigImg;
  try {
    const hubLogoBytes = await fetchImageBytes(config.hubLogoUrl);
    if (hubLogoBytes) hubLogoImg = await pdfDoc.embedPng(hubLogoBytes);
  } catch (e) {
    console.warn('Could not embed hub logo PNG:', e);
  }

  try {
    const sealBytes = await fetchImageBytes(config.sealUrl);
    if (sealBytes) sealImg = await pdfDoc.embedPng(sealBytes);
  } catch (e) {
    console.warn('Could not embed college seal PNG:', e);
  }

  try {
    const secSigBytes = await fetchImageBytes(config.secSigUrl);
    if (secSigBytes) secSigImg = await pdfDoc.embedPng(secSigBytes);
  } catch (e) {
    console.warn('Could not embed sec signature PNG:', e);
  }

  try {
    const princSigBytes = await fetchImageBytes(config.princSigUrl);
    if (princSigBytes) princSigImg = await pdfDoc.embedPng(princSigBytes);
  } catch (e) {
    console.warn('Could not embed principal signature PNG:', e);
  }

  // 4. Generate QR Code
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 280,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' }
  });
  const qrBytes = await fetchImageBytes(qrDataUrl);
  const qrImg = await pdfDoc.embedPng(qrBytes);

  // Exact Colors
  const redColor = rgb(179 / 255, 18 / 255, 43 / 255);       // #B3122B
  const creamColor = rgb(247 / 255, 243 / 255, 236 / 255);   // #F7F3EC
  const textColor = rgb(26 / 255, 26 / 255, 26 / 255);       // #1A1A1A
  const greyColor = rgb(85 / 255, 85 / 255, 85 / 255);       // #555555
  const lineUnderline = rgb(207 / 255, 175 / 255, 168 / 255); // #CFAFA8
  const blackColor = rgb(0, 0, 0);

  // A. Cream Full-Page Background
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: creamColor
  });

  // B. Red Frame: 4.5 pt, inset 21 pt
  page.drawRectangle({
    x: 21,
    y: 21,
    width: width - 42,
    height: height - 42,
    borderColor: redColor,
    borderWidth: 4.5
  });

  // C. Thin Red Line: 1.1 pt, inset 30 pt
  page.drawRectangle({
    x: 30,
    y: 30,
    width: width - 60,
    height: height - 60,
    borderColor: redColor,
    borderWidth: 1.1
  });

  // D. Hub Logo (94 x 94 pt, centred, top edge 48 pt from top)
  const logoWidth = 94;
  const logoHeight = 94;
  const logoX = (width - logoWidth) / 2;
  const logoY = fromTop(48 + logoHeight);
  if (hubLogoImg) {
    page.drawImage(hubLogoImg, {
      x: logoX,
      y: logoY,
      width: logoWidth,
      height: logoHeight
    });
  }

  // Centered text with letter-spacing helper
  const drawCenteredTextWithSpacing = (text, yTopBaseline, font, size, color, letterSpacing = 0) => {
    let totalWidth = 0;
    const chars = Array.from(text);
    for (let i = 0; i < chars.length; i++) {
      totalWidth += font.widthOfTextAtSize(chars[i], size);
      if (i < chars.length - 1) totalWidth += letterSpacing;
    }
    let curX = (width - totalWidth) / 2;
    const y = fromTop(yTopBaseline);
    for (let i = 0; i < chars.length; i++) {
      page.drawText(chars[i], {
        x: curX,
        y,
        size,
        font,
        color
      });
      curX += font.widthOfTextAtSize(chars[i], size) + letterSpacing;
    }
  };

  // Multi-style centered line helper
  const drawMixedCenteredLine = (segments, yTopBaseline) => {
    let totalWidth = 0;
    segments.forEach(seg => {
      totalWidth += seg.font.widthOfTextAtSize(seg.text, seg.size);
    });
    let curX = (width - totalWidth) / 2;
    const y = fromTop(yTopBaseline);
    segments.forEach(seg => {
      page.drawText(seg.text, {
        x: curX,
        y,
        size: seg.size,
        font: seg.font,
        color: seg.color
      });
      curX += seg.font.widthOfTextAtSize(seg.text, seg.size);
    });
  };

  // E. "TECHNICAL SKILL DEVELOPMENT HUB • SVIT NASHIK"
  // Helvetica 9.5 pt, grey, letter-spacing 2.2, baseline at 158 pt
  drawCenteredTextWithSpacing(
    'TECHNICAL SKILL DEVELOPMENT HUB  •  SVIT NASHIK',
    158,
    helvetica,
    9.5,
    greyColor,
    2.2
  );

  // F. "CERTIFICATE"
  // Times Bold 44 pt, red, letter-spacing 2.5, baseline at 208 pt
  drawCenteredTextWithSpacing(
    'CERTIFICATE',
    208,
    timesBold,
    44,
    redColor,
    2.5
  );

  // G. "OF COMPLETION" / "OF MERIT" / "OF EXCELLENCE & MERIT"
  const typeSubtitle = type === 'Winner' 
    ? 'OF EXCELLENCE & MERIT' 
    : type === 'Merit' 
    ? 'OF MERIT' 
    : 'OF COMPLETION';
  drawCenteredTextWithSpacing(
    typeSubtitle,
    232,
    helvetica,
    12.5,
    textColor,
    typeSubtitle.length > 15 ? 3.0 : 5.5
  );

  // H. "This is proudly presented to"
  // Helvetica 11.5 pt, grey, baseline at 266 pt
  const proudlyText = 'This is proudly presented to';
  const proudlyWidth = helvetica.widthOfTextAtSize(proudlyText, 11.5);
  page.drawText(proudlyText, {
    x: (width - proudlyWidth) / 2,
    y: fromTop(266),
    size: 11.5,
    font: helvetica,
    color: greyColor
  });

  // I. Student Name: Times Italic 32 pt (shrink down to min 16 pt), #1A1A1A, centred, in box 500 pt wide
  // with a 1 pt line (#CFAFA8), 460 pt wide, under it at about 316 pt
  let nameFontSize = 32;
  while (timesItalic.widthOfTextAtSize(safeName, nameFontSize) > 460 && nameFontSize > 16) {
    nameFontSize -= 0.5;
  }
  const nameWidth = timesItalic.widthOfTextAtSize(safeName, nameFontSize);
  page.drawText(safeName, {
    x: (width - nameWidth) / 2,
    y: fromTop(308),
    size: nameFontSize,
    font: timesItalic,
    color: textColor
  });

  // 1 pt Underline at 316 pt
  const underlineWidth = 460;
  page.drawLine({
    start: { x: (width - underlineWidth) / 2, y: fromTop(316) },
    end: { x: (width + underlineWidth) / 2, y: fromTop(316) },
    thickness: 1,
    color: lineUnderline
  });

  // J. Three Text Lines (baselines at 342, 360, 378 pt)
  // Line 1: "for successfully completing the Technova Code Sprint: 9 Days to Build,"
  drawMixedCenteredLine([
    { text: 'for successfully completing the ', font: helvetica, size: 12.5, color: textColor },
    { text: eventName || 'Technova Code Sprint: 9 Days to Build', font: helveticaBold, size: 12.5, color: textColor },
    { text: ',', font: helvetica, size: 12.5, color: textColor }
  ], 342);

  // Line 2: "a daily coding challenge organised by the Technical Skill Development Hub, SVIT Nashik,"
  drawMixedCenteredLine([
    { text: 'a daily coding challenge organised by the Technical Skill Development Hub, SVIT Nashik,', font: helvetica, size: 12.5, color: textColor }
  ], 360);

  // Line 3: "from 13 Oct 2026 to 21 Oct 2026 , in the [Language] track, with a score of [Score] / 100" (+ Rank if available)
  const formattedScore = typeof score === 'number' ? score.toFixed(1) : String(score);
  const line3Segments = [
    { text: 'from  ', font: helvetica, size: 12.5, color: textColor },
    { text: '13 Oct 2026', font: helveticaBold, size: 12, color: redColor },
    { text: '  to  ', font: helvetica, size: 12.5, color: textColor },
    { text: '21 Oct 2026', font: helveticaBold, size: 12, color: redColor },
    { text: ' , in the ', font: helvetica, size: 12.5, color: textColor },
    { text: `[${language}]`, font: helveticaBold, size: 12, color: redColor },
    { text: ' track, with a score of ', font: helvetica, size: 12.5, color: textColor },
    { text: `[${formattedScore}]`, font: helveticaBold, size: 12, color: redColor },
    { text: ' / 100', font: helvetica, size: 12.5, color: textColor }
  ];
  if (rank) {
    line3Segments.push({ text: ' (', font: helvetica, size: 12.5, color: textColor });
    line3Segments.push({ text: `Rank #${rank}`, font: helveticaBold, size: 12, color: redColor });
    line3Segments.push({ text: ').', font: helvetica, size: 12.5, color: textColor });
  } else {
    line3Segments.push({ text: '.', font: helvetica, size: 12.5, color: textColor });
  }
  drawMixedCenteredLine(line3Segments, 378);

  // K. "Learn | Build | Grow": Times Italic 12.5 pt, red, letter-spacing 2, baseline at 412 pt
  drawCenteredTextWithSpacing(
    'Learn   |   Build   |   Grow',
    412,
    timesItalic,
    12.5,
    redColor,
    2
  );

  // Common Signature Baseline at 503 pt
  const sigLineY = fromTop(503);

  // L. Left Signature Block (Technical Secretary, centred at x = 170 pt)
  const leftCenterX = 170;
  const sigLineWidth = 210;
  page.drawLine({
    start: { x: leftCenterX - sigLineWidth / 2, y: sigLineY },
    end: { x: leftCenterX + sigLineWidth / 2, y: sigLineY },
    thickness: 1,
    color: blackColor
  });

  if (secSigImg) {
    const secSigW = 130;
    const secSigH = (secSigW * 115) / 479;
    page.drawImage(secSigImg, {
      x: leftCenterX - secSigW / 2,
      y: sigLineY + 3,
      width: secSigW,
      height: secSigH
    });
  }

  const secName = config.secName || 'Vedant Kokane';
  const secNameW = helveticaBold.widthOfTextAtSize(secName, 11.5);
  page.drawText(secName, {
    x: leftCenterX - secNameW / 2,
    y: fromTop(518),
    size: 11.5,
    font: helveticaBold,
    color: textColor
  });

  const secTitle = config.secTitle || 'Technical Secretary, SVIT Nashik';
  const secTitleW = helvetica.widthOfTextAtSize(secTitle, 9.5);
  page.drawText(secTitle, {
    x: leftCenterX - secTitleW / 2,
    y: fromTop(530),
    size: 9.5,
    font: helvetica,
    color: greyColor
  });

  // M. Right Signature Block (Principal, centred at x = 672 pt)
  const rightCenterX = 672;
  page.drawLine({
    start: { x: rightCenterX - sigLineWidth / 2, y: sigLineY },
    end: { x: rightCenterX + sigLineWidth / 2, y: sigLineY },
    thickness: 1,
    color: blackColor
  });

  if (princSigImg) {
    const princSigW = 110;
    const princSigH = (princSigW * 108) / 297;
    page.drawImage(princSigImg, {
      x: rightCenterX - princSigW / 2,
      y: sigLineY + 3,
      width: princSigW,
      height: princSigH
    });
  }

  const princName = config.princName || 'Dr. Sarang S. Pande';
  const princNameW = helveticaBold.widthOfTextAtSize(princName, 11.5);
  page.drawText(princName, {
    x: rightCenterX - princNameW / 2,
    y: fromTop(518),
    size: 11.5,
    font: helveticaBold,
    color: textColor
  });

  const princTitle = config.princTitle || 'Principal, SVIT Nashik';
  const princTitleW = helvetica.widthOfTextAtSize(princTitle, 9.5);
  page.drawText(princTitle, {
    x: rightCenterX - princTitleW / 2,
    y: fromTop(530),
    size: 9.5,
    font: helvetica,
    color: greyColor
  });

  // N. College Seal: 82 x 82 pt, centred on page, bottom about 8 pt below signature line level
  const sealW = 82;
  const sealH = 82;
  const sealX = (width - sealW) / 2;
  const sealY = sigLineY - 8;
  if (sealImg) {
    page.drawImage(sealImg, {
      x: sealX,
      y: sealY,
      width: sealW,
      height: sealH
    });
  }

  // Certificate ID and issue date under seal
  const certIdText = `Certificate ID:   ${certificateId}   •   Issue Date:   ${issueDate}`;
  const certIdW = helvetica.widthOfTextAtSize(certIdText, 8.5);
  page.drawText(certIdText, {
    x: (width - certIdW) / 2,
    y: fromTop(530),
    size: 8.5,
    font: helvetica,
    color: greyColor
  });

  // O. Verification QR: 70 x 70 pt, top-right corner.
  // left edge at 722 pt, top edge at 55 pt from top. White quiet zone background
  const qrLeft = 722;
  const qrTop = 55;
  const qrSize = 70;

  page.drawRectangle({
    x: qrLeft - 4,
    y: fromTop(qrTop + qrSize + 4),
    width: qrSize + 8,
    height: qrSize + 8,
    color: rgb(1, 1, 1),
    borderColor: rgb(220 / 255, 200 / 255, 200 / 255),
    borderWidth: 0.5
  });

  page.drawImage(qrImg, {
    x: qrLeft,
    y: fromTop(qrTop + qrSize),
    width: qrSize,
    height: qrSize
  });

  // Under QR: "SCAN TO VERIFY" in Helvetica Bold 7.5 pt, grey, centred
  const scanText = 'SCAN TO VERIFY';
  const scanW = helveticaBold.widthOfTextAtSize(scanText, 7.5);
  page.drawText(scanText, {
    x: qrLeft + (qrSize - scanW) / 2,
    y: fromTop(qrTop + qrSize + 16),
    size: 7.5,
    font: helveticaBold,
    color: greyColor
  });

  // Flat PDF (no interactive form fields)
  return await pdfDoc.save();
}

/**
 * Trigger download of generated PDF certificate in browser: <StudentName>_<CertID>.pdf
 */
export async function downloadCertificatePdf(params) {
  const bytes = await generateCertificatePdf(params);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const sanitizedName = (params.studentName || 'Student').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const certId = (params.certificateId || 'CERT').replace(/[^a-zA-Z0-9_\-]/g, '_');
  link.href = url;
  link.download = `${sanitizedName}_${certId}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Generate a ZIP containing certificates for all eligible students: <StudentName>_<CertID>.pdf
 */
export async function generateCertificatesZip(certificatesList = [], templateConfig = {}) {
  const zip = new JSZip();
  for (const cert of certificatesList) {
    try {
      const pdfBytes = await generateCertificatePdf({
        studentName: cert.studentName,
        eventName: cert.event || 'Technova Code Sprint: 9 Days to Build',
        language: cert.language || cert.track || 'Python',
        score: cert.score ?? 100,
        rank: cert.rank || null,
        type: cert.type || 'Participation',
        certificateId: cert.certificateId,
        issueDate: cert.issueDate || cert.issuedDate || '22 Oct 2026',
        templateConfig
      });
      const sanitizedName = (cert.studentName || 'Student').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const certId = (cert.certificateId || 'CERT').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const filename = `${sanitizedName}_${certId}.pdf`;
      zip.file(filename, pdfBytes);
    } catch (e) {
      console.warn(`Failed to package certificate for ${cert.studentName}:`, e);
    }
  }
  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Trigger browser download of bulk certificates ZIP archive
 */
export async function downloadCertificatesZip(certificatesList = [], templateConfig = {}) {
  const blob = await generateCertificatesZip(certificatesList, templateConfig);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Technova_Certificates_${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

