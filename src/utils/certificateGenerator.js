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
  templateVersion: 'v2_premium', // 'v2_premium' (New Premium 2026) | 'v1_classic' (Classic 2026)
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
 * Supports both v2_premium (Official 2026 Premium Design) and v1_classic (Classic Design)
 */
export async function generateCertificatePdf({
  studentName = 'Student Name',
  eventName = 'Technova Code Sprint: 9 Days to Build',
  language = 'Python',
  score = '75.0',
  rank = null,
  type = 'Participation',
  certificateId = 'CERT-2026-TEST0001',
  issueDate = '23 Oct 2026',
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

  // Coordinate helper: top-down measurement
  const fromTop = (yTop) => height - yTop;

  // 2. Embed Standard Fonts
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

  // Determine Subtitle by Certificate Type
  const typeSubtitle = type === 'Winner' 
    ? 'OF EXCELLENCE & MERIT' 
    : type === 'Merit' 
    ? 'OF MERIT' 
    : 'OF COMPLETION';

  const formattedScore = typeof score === 'number' ? score.toFixed(1) : String(score);

  // =========================================================================
  // VERSION BRANCH: v1_classic vs v2_premium
  // =========================================================================
  if (config.templateVersion === 'v1_classic') {
    // --- V1 CLASSIC LAYOUT ---
    const redColor = rgb(179 / 255, 18 / 255, 43 / 255);       // #B3122B
    const creamColor = rgb(247 / 255, 243 / 255, 236 / 255);   // #F7F3EC
    const textColor = rgb(26 / 255, 26 / 255, 26 / 255);       // #1A1A1A
    const greyColor = rgb(85 / 255, 85 / 255, 85 / 255);       // #555555
    const lineUnderline = rgb(207 / 255, 175 / 255, 168 / 255); // #CFAFA8
    const blackColor = rgb(0, 0, 0);

    // Cream Full-Page Background
    page.drawRectangle({ x: 0, y: 0, width, height, color: creamColor });

    // Red Frame: 4.5 pt, inset 21 pt
    page.drawRectangle({
      x: 21,
      y: 21,
      width: width - 42,
      height: height - 42,
      borderColor: redColor,
      borderWidth: 4.5
    });

    // Thin Red Line: 1.1 pt, inset 30 pt
    page.drawRectangle({
      x: 30,
      y: 30,
      width: width - 60,
      height: height - 60,
      borderColor: redColor,
      borderWidth: 1.1
    });

    // Hub Logo (94 x 94 pt, centred, top edge 48 pt from top)
    const logoWidth = 94;
    const logoHeight = 94;
    const logoX = (width - logoWidth) / 2;
    const logoY = fromTop(48 + logoHeight);
    if (hubLogoImg) {
      page.drawImage(hubLogoImg, { x: logoX, y: logoY, width: logoWidth, height: logoHeight });
    }

    drawCenteredTextWithSpacing('TECHNICAL SKILL DEVELOPMENT HUB  •  SVIT NASHIK', 158, helvetica, 9.5, greyColor, 2.2);
    drawCenteredTextWithSpacing('CERTIFICATE', 208, timesBold, 44, redColor, 2.5);
    drawCenteredTextWithSpacing(typeSubtitle, 232, helvetica, 12.5, textColor, typeSubtitle.length > 15 ? 3.0 : 5.5);

    const proudlyText = 'This is proudly presented to';
    const proudlyWidth = helvetica.widthOfTextAtSize(proudlyText, 11.5);
    page.drawText(proudlyText, {
      x: (width - proudlyWidth) / 2,
      y: fromTop(266),
      size: 11.5,
      font: helvetica,
      color: greyColor
    });

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

    page.drawLine({
      start: { x: (width - 460) / 2, y: fromTop(316) },
      end: { x: (width + 460) / 2, y: fromTop(316) },
      thickness: 1,
      color: lineUnderline
    });

    drawMixedCenteredLine([
      { text: 'for successfully completing the ', font: helvetica, size: 12.5, color: textColor },
      { text: eventName || 'Technova Code Sprint: 9 Days to Build', font: helveticaBold, size: 12.5, color: textColor },
      { text: ',', font: helvetica, size: 12.5, color: textColor }
    ], 342);

    drawMixedCenteredLine([
      { text: 'a daily coding challenge organised by the Technical Skill Development Hub, SVIT Nashik,', font: helvetica, size: 12.5, color: textColor }
    ], 360);

    const line3SegmentsClassic = [
      { text: 'from  ', font: helvetica, size: 12.5, color: textColor },
      { text: '14 Oct 2026', font: helveticaBold, size: 12, color: redColor },
      { text: '  to  ', font: helvetica, size: 12.5, color: textColor },
      { text: '22 Oct 2026', font: helveticaBold, size: 12, color: redColor },
      { text: ' , in the ', font: helvetica, size: 12.5, color: textColor },
      { text: `[${language}]`, font: helveticaBold, size: 12, color: redColor },
      { text: ' track, with a score of ', font: helvetica, size: 12.5, color: textColor },
      { text: `[${formattedScore}]`, font: helveticaBold, size: 12, color: redColor },
      { text: ' / 100', font: helvetica, size: 12.5, color: textColor }
    ];
    if (rank) {
      line3SegmentsClassic.push({ text: ' (', font: helvetica, size: 12.5, color: textColor });
      line3SegmentsClassic.push({ text: `Rank #${rank}`, font: helveticaBold, size: 12, color: redColor });
      line3SegmentsClassic.push({ text: ').', font: helvetica, size: 12.5, color: textColor });
    } else {
      line3SegmentsClassic.push({ text: '.', font: helvetica, size: 12.5, color: textColor });
    }
    drawMixedCenteredLine(line3SegmentsClassic, 378);

    drawCenteredTextWithSpacing('Learn   |   Build   |   Grow', 412, timesItalic, 12.5, redColor, 2);

    const sigLineY = fromTop(503);
    const leftCenterX = 170;
    const rightCenterX = 672;
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
      page.drawImage(secSigImg, { x: leftCenterX - secSigW / 2, y: sigLineY + 3, width: secSigW, height: secSigH });
    }
    const secName = config.secName || 'Vedant Kokane';
    const secNameW = helveticaBold.widthOfTextAtSize(secName, 11.5);
    page.drawText(secName, { x: leftCenterX - secNameW / 2, y: fromTop(518), size: 11.5, font: helveticaBold, color: textColor });
    const secTitle = config.secTitle || 'Technical Secretary, SVIT Nashik';
    const secTitleW = helvetica.widthOfTextAtSize(secTitle, 9.5);
    page.drawText(secTitle, { x: leftCenterX - secTitleW / 2, y: fromTop(530), size: 9.5, font: helvetica, color: greyColor });

    page.drawLine({
      start: { x: rightCenterX - sigLineWidth / 2, y: sigLineY },
      end: { x: rightCenterX + sigLineWidth / 2, y: sigLineY },
      thickness: 1,
      color: blackColor
    });
    if (princSigImg) {
      const princSigW = 110;
      const princSigH = (princSigW * 108) / 297;
      page.drawImage(princSigImg, { x: rightCenterX - princSigW / 2, y: sigLineY + 3, width: princSigW, height: princSigH });
    }
    const princName = config.princName || 'Dr. Sarang S. Pande';
    const princNameW = helveticaBold.widthOfTextAtSize(princName, 11.5);
    page.drawText(princName, { x: rightCenterX - princNameW / 2, y: fromTop(518), size: 11.5, font: helveticaBold, color: textColor });
    const princTitle = config.princTitle || 'Principal, SVIT Nashik';
    const princTitleW = helvetica.widthOfTextAtSize(princTitle, 9.5);
    page.drawText(princTitle, { x: rightCenterX - princTitleW / 2, y: fromTop(530), size: 9.5, font: helvetica, color: greyColor });

    if (sealImg) {
      page.drawImage(sealImg, { x: (width - 82) / 2, y: sigLineY - 8, width: 82, height: 82 });
    }
    const certIdText = `Certificate ID:   ${certificateId}   •   Issue Date:   ${issueDate}`;
    const certIdW = helvetica.widthOfTextAtSize(certIdText, 8.5);
    page.drawText(certIdText, { x: (width - certIdW) / 2, y: fromTop(530), size: 8.5, font: helvetica, color: greyColor });

    page.drawRectangle({
      x: 718,
      y: fromTop(129),
      width: 78,
      height: 78,
      color: rgb(1, 1, 1),
      borderColor: rgb(220 / 255, 200 / 255, 200 / 255),
      borderWidth: 0.5
    });
    page.drawImage(qrImg, { x: 722, y: fromTop(125), width: 70, height: 70 });
    const scanW = helveticaBold.widthOfTextAtSize('SCAN TO VERIFY', 7.5);
    page.drawText('SCAN TO VERIFY', { x: 722 + (70 - scanW) / 2, y: fromTop(141), size: 7.5, font: helveticaBold, color: greyColor });

    return await pdfDoc.save();
  }

  // =========================================================================
  // V2 PREMIUM LAYOUT (Exact reproduction of Technova_Certificate_Template_Premium.pdf)
  // =========================================================================
  const redColor = rgb(179 / 255, 18 / 255, 43 / 255);       // #B3122B
  const darkRedColor = rgb(142 / 255, 14 / 255, 34 / 255);   // #8E0E22
  const goldColor = rgb(201 / 255, 162 / 255, 75 / 255);     // #C9A24B
  const creamColor = rgb(251 / 255, 247 / 255, 239 / 255);   // #FBF7EF
  const textColor = rgb(26 / 255, 26 / 255, 26 / 255);       // #1A1A1A
  const greyColor = rgb(90 / 255, 90 / 255, 90 / 255);       // #5A5A5A
  const whiteColor = rgb(1, 1, 1);
  const blackColor = rgb(0, 0, 0);

  // A. Background: full-page cream #FBF7EF
  page.drawRectangle({ x: 0, y: 0, width, height, color: creamColor });

  // B. Borders:
  // 1. 7 pt red frame inset 16 pt from the edge
  page.drawRectangle({
    x: 16,
    y: 16,
    width: width - 32,
    height: height - 32,
    borderColor: redColor,
    borderWidth: 7
  });

  // 2. 2 pt gold frame inset 25 pt
  page.drawRectangle({
    x: 25,
    y: 25,
    width: width - 50,
    height: height - 50,
    borderColor: goldColor,
    borderWidth: 2
  });

  // 3. 0.9 pt red line inset 31 pt
  page.drawRectangle({
    x: 31,
    y: 31,
    width: width - 62,
    height: height - 62,
    borderColor: redColor,
    borderWidth: 0.9
  });

  // C. Corner ornaments:
  // At each corner, centred 44 pt in from both edges, three concentric quarter-circle gold arcs
  // (radius 13, 21 and 29 pt, 1.3 pt stroke) curving into the page, plus a gold dot (radius 3.2 pt) at center point.
  function drawQuarterArc(cx, cy, r, startAngle, endAngle) {
    const steps = 24;
    const dTheta = (endAngle - startAngle) / steps;
    let prevX = cx + r * Math.cos(startAngle);
    let prevY = cy + r * Math.sin(startAngle);
    for (let i = 1; i <= steps; i++) {
      const theta = startAngle + i * dTheta;
      const x = cx + r * Math.cos(theta);
      const y = cy + r * Math.sin(theta);
      page.drawLine({
        start: { x: prevX, y: prevY },
        end: { x, y },
        thickness: 1.3,
        color: goldColor
      });
      prevX = x;
      prevY = y;
    }
  }

  const corners = [
    { cx: 44, cy: height - 44, start: -Math.PI / 2, end: 0 },
    { cx: width - 44, cy: height - 44, start: Math.PI, end: 1.5 * Math.PI },
    { cx: 44, cy: 44, start: 0, end: Math.PI / 2 },
    { cx: width - 44, cy: 44, start: Math.PI / 2, end: Math.PI }
  ];

  corners.forEach(c => {
    page.drawCircle({ x: c.cx, y: c.cy, size: 3.2, color: goldColor });
    [13, 21, 29].forEach(r => drawQuarterArc(c.cx, c.cy, r, c.start, c.end));
  });

  // D. Hub logo:
  // 80 pt diameter, centred at 421 pt across and 86 pt down, on a white circle with a gold 2.2 pt ring (radius 44 pt).
  page.drawCircle({
    x: 421,
    y: fromTop(86),
    size: 44,
    color: whiteColor,
    borderColor: goldColor,
    borderWidth: 2.2
  });
  if (hubLogoImg) {
    page.drawImage(hubLogoImg, {
      x: 381,
      y: fromTop(86) - 40,
      width: 80,
      height: 80
    });
  }

  // E. Header under Hub logo:
  // "TECHNICAL SKILL DEVELOPMENT HUB": Helvetica Bold 11, dark red, letter-spacing 3, baseline 146.
  drawCenteredTextWithSpacing('TECHNICAL SKILL DEVELOPMENT HUB', 146, helveticaBold, 11, darkRedColor, 3);

  // Under it, "Sir Visvesvaraya Institute of Technology, Nashik": Helvetica 8.5, grey, letter-spacing 0.6, baseline 159.
  drawCenteredTextWithSpacing('Sir Visvesvaraya Institute of Technology, Nashik', 159, helvetica, 8.5, greyColor, 0.6);

  // F. Left emblem:
  // Red circle (radius 36) centred at 122 pt across and 92 pt down, with a gold 2.2 pt ring and a thin white inner ring (radius 30).
  const leftCy = fromTop(92);
  page.drawCircle({
    x: 122,
    y: leftCy,
    size: 36,
    color: redColor,
    borderColor: goldColor,
    borderWidth: 2.2
  });
  page.drawCircle({
    x: 122,
    y: leftCy,
    size: 30,
    borderColor: whiteColor,
    borderWidth: 1
  });
  // A white "9" in Times Bold 38 and the word "DAYS" in Helvetica Bold 8.5 below it.
  const nineW = timesBold.widthOfTextAtSize('9', 38);
  page.drawText('9', {
    x: 122 - nineW / 2,
    y: leftCy - 6,
    size: 38,
    font: timesBold,
    color: whiteColor
  });
  const daysW = helveticaBold.widthOfTextAtSize('DAYS', 8.5);
  page.drawText('DAYS', {
    x: 122 - daysW / 2,
    y: leftCy - 20,
    size: 8.5,
    font: helveticaBold,
    color: whiteColor
  });

  // G. Verification QR:
  // 70 x 70 pt, centred at 720 pt across and 92 pt down (so its left edge is 685 pt and its top edge 57 pt),
  // white background with a quiet zone. "SCAN TO VERIFY" in Helvetica Bold 7.2, grey, centred 10 pt under it.
  page.drawRectangle({
    x: 683,
    y: fromTop(57 + 70 + 2),
    width: 74,
    height: 74,
    color: whiteColor
  });
  page.drawImage(qrImg, {
    x: 685,
    y: fromTop(57 + 70),
    width: 70,
    height: 70
  });
  const scanW = helveticaBold.widthOfTextAtSize('SCAN TO VERIFY', 7.2);
  page.drawText('SCAN TO VERIFY', {
    x: 720 - scanW / 2,
    y: fromTop(137),
    size: 7.2,
    font: helveticaBold,
    color: greyColor
  });

  // H. "CERTIFICATE":
  // Times Bold 50, red, letter-spacing 4, baseline 206.
  drawCenteredTextWithSpacing('CERTIFICATE', 206, timesBold, 50, redColor, 4);

  // I. Gold divider at 218 pt:
  // 1.4 pt line from 150 pt left of centre to 14 pt left of centre,
  // a gold diamond (14 pt wide, 12 pt tall) at the centre, and the same line on the right side.
  const divY = fromTop(218);
  page.drawLine({
    start: { x: 421 - 150, y: divY },
    end: { x: 421 - 14, y: divY },
    thickness: 1.4,
    color: goldColor
  });
  page.drawLine({
    start: { x: 421 + 14, y: divY },
    end: { x: 421 + 150, y: divY },
    thickness: 1.4,
    color: goldColor
  });
  page.drawSvgPath('M 0 -6 L 7 0 L 0 6 L -7 0 Z', {
    x: 421,
    y: divY,
    color: goldColor
  });

  // J. Subtitle: "OF COMPLETION" (or "OF MERIT" / "OF EXCELLENCE & MERIT"):
  // Helvetica Bold 12.5, letter-spacing 6, baseline 238.
  drawCenteredTextWithSpacing(typeSubtitle, 238, helveticaBold, 12.5, textColor, typeSubtitle.length > 15 ? 3.5 : 6);

  // "This is proudly presented to": Helvetica 11.5, grey, baseline 263.
  const proudlyW = helvetica.widthOfTextAtSize('This is proudly presented to', 11.5);
  page.drawText('This is proudly presented to', {
    x: (width - proudlyW) / 2,
    y: fromTop(263),
    size: 11.5,
    font: helvetica,
    color: greyColor
  });

  // K. Student name:
  // Times Italic 34, #1A1A1A, centred, with a 1.2 pt gold line 480 pt wide under it at 315 pt.
  // If the name is too long, shrink the font down to a minimum of 22 pt so it stays on one line.
  let nameSize = 34;
  while (timesItalic.widthOfTextAtSize(safeName, nameSize) > 480 && nameSize > 22) {
    nameSize -= 0.5;
  }
  const nameW = timesItalic.widthOfTextAtSize(safeName, nameSize);
  page.drawText(safeName, {
    x: (width - nameW) / 2,
    y: fromTop(307),
    size: nameSize,
    font: timesItalic,
    color: textColor
  });
  page.drawLine({
    start: { x: (width - 480) / 2, y: fromTop(315) },
    end: { x: (width + 480) / 2, y: fromTop(315) },
    thickness: 1.2,
    color: goldColor
  });

  // L. Three body lines in Helvetica 12.5:
  // Baselines at 342, 359 and 376 pt.
  // Line 1: "for successfully completing the Technova Code Sprint: 9 Days to Build,"
  drawMixedCenteredLine([
    { text: 'for successfully completing the ', font: helvetica, size: 12.5, color: textColor },
    { text: eventName || 'Technova Code Sprint: 9 Days to Build', font: helveticaBold, size: 12.5, color: textColor },
    { text: ',', font: helvetica, size: 12.5, color: textColor }
  ], 342);

  // Line 2: "a daily coding challenge organised by the Technical Skill Development Hub, SVIT Nashik,"
  drawMixedCenteredLine([
    { text: 'a daily coding challenge organised by the Technical Skill Development Hub, SVIT Nashik,', font: helvetica, size: 12.5, color: textColor }
  ], 359);

  // Line 3: "from 14 Oct 2026 to 22 Oct 2026 , in the [Language] track, with a score of [Score] / 100" (+ Rank if available)
  const line3Segments = [
    { text: 'from  ', font: helvetica, size: 12.5, color: textColor },
    { text: '14 Oct 2026', font: helveticaBold, size: 12, color: redColor },
    { text: '  to  ', font: helvetica, size: 12.5, color: textColor },
    { text: '22 Oct 2026', font: helveticaBold, size: 12, color: redColor },
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
  drawMixedCenteredLine(line3Segments, 376);

  // M. "Learn | Build | Grow":
  // Times Italic 13, dark red, letter-spacing 2.5, baseline 404.
  drawCenteredTextWithSpacing('Learn   |   Build   |   Grow', 404, timesItalic, 13, darkRedColor, 2.5);

  // N. Bottom signatures:
  // Baseline at 498 pt. Line width 200 pt.
  const sigY = fromTop(498);
  const leftCenterX = 165;
  const rightCenterX = 677;

  page.drawLine({
    start: { x: leftCenterX - 100, y: sigY },
    end: { x: leftCenterX + 100, y: sigY },
    thickness: 1,
    color: blackColor
  });
  page.drawLine({
    start: { x: rightCenterX - 100, y: sigY },
    end: { x: rightCenterX + 100, y: sigY },
    thickness: 1,
    color: blackColor
  });

  // Left: Technical Secretary
  if (secSigImg) {
    const secSigW = 130;
    const secSigH = (secSigW * 115) / 479;
    page.drawImage(secSigImg, {
      x: leftCenterX - secSigW / 2,
      y: sigY + 5,
      width: secSigW,
      height: secSigH
    });
  }
  const secName = config.secName || 'Vedant Kokane';
  const secNameW = helveticaBold.widthOfTextAtSize(secName, 11.5);
  page.drawText(secName, {
    x: leftCenterX - secNameW / 2,
    y: fromTop(516),
    size: 11.5,
    font: helveticaBold,
    color: textColor
  });
  const secTitle = config.secTitle || 'Technical Secretary, SVIT Nashik';
  const secTitleW = helvetica.widthOfTextAtSize(secTitle, 9);
  page.drawText(secTitle, {
    x: leftCenterX - secTitleW / 2,
    y: fromTop(529),
    size: 9,
    font: helvetica,
    color: greyColor
  });

  // Right: Principal
  if (princSigImg) {
    const princSigW = 108;
    const princSigH = (princSigW * 108) / 297;
    page.drawImage(princSigImg, {
      x: rightCenterX - princSigW / 2,
      y: sigY + 5,
      width: princSigW,
      height: princSigH
    });
  }
  const princName = config.princName || 'Dr. Sarang S. Pande';
  const princNameW = helveticaBold.widthOfTextAtSize(princName, 11.5);
  page.drawText(princName, {
    x: rightCenterX - princNameW / 2,
    y: fromTop(516),
    size: 11.5,
    font: helveticaBold,
    color: textColor
  });
  const princTitle = config.princTitle || 'Principal, SVIT Nashik';
  const princTitleW = helvetica.widthOfTextAtSize(princTitle, 9);
  page.drawText(princTitle, {
    x: rightCenterX - princTitleW / 2,
    y: fromTop(529),
    size: 9,
    font: helvetica,
    color: greyColor
  });

  // O. Bottom centre emblem:
  // College seal, 84 pt diameter, centred at 421 pt across, bottom of the seal 18 pt below the signature line level
  // (so its top is 416 pt down and bottom 500 pt down).
  if (sealImg) {
    page.drawImage(sealImg, {
      x: 421 - 42,
      y: fromTop(500),
      width: 84,
      height: 84
    });
  }

  // Under it, "Certificate ID: [ID]" in Helvetica 8.5 grey, centred, baseline 516. No second red box or date duplicate under the seal.
  const certIdText = `Certificate ID: ${certificateId}`;
  const certIdW = helvetica.widthOfTextAtSize(certIdText, 8.5);
  page.drawText(certIdText, {
    x: (width - certIdW) / 2,
    y: fromTop(516),
    size: 8.5,
    font: helvetica,
    color: greyColor
  });

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
  link.download = `Technova_Code_Sprint_Certificate_${sanitizedName}.pdf`;
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
        issueDate: cert.issueDate || cert.issuedDate || '23 Oct 2026',
        templateConfig: { ...templateConfig, templateVersion: cert.templateVersion || templateConfig?.templateVersion }
      });
      const sanitizedName = (cert.studentName || 'Student').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const filename = `Technova_Code_Sprint_Certificate_${sanitizedName}.pdf`;
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
