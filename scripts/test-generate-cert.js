import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

async function generateTestCertificate() {
  const studentName = "Vedant Kokane";
  const language = "Python";
  const score = "78.5";
  const certId = "TNV-CS-2026-0001-K7Q2";
  const verifyUrl = `https://technova-sprint.svit.ac.in/verify/${certId}`;

  // Create document: A4 Landscape (841.89 x 595.28 pt)
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle("Technova Code Sprint Certificate");
  pdfDoc.setAuthor(studentName);
  pdfDoc.setSubject("Certificate of Completion");
  pdfDoc.setKeywords(["Technova", "Code Sprint", "SVIT", "Certificate", certId]);

  const page = pdfDoc.addPage([841.89, 595.28]);
  const { width, height } = page.getSize(); // 841.89, 595.28

  // Embed Fonts
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Load transparent PNG assets
  const hubLogoBytes = fs.readFileSync('public/hub-logo.png');
  const sealBytes = fs.readFileSync('public/college-seal.png');
  const secSigBytes = fs.readFileSync('public/signature-technical-secretary.png');
  const princSigBytes = fs.readFileSync('public/signature-principal.png');

  const hubLogoImg = await pdfDoc.embedPng(hubLogoBytes);
  const sealImg = await pdfDoc.embedPng(sealBytes);
  const secSigImg = await pdfDoc.embedPng(secSigBytes);
  const princSigImg = await pdfDoc.embedPng(princSigBytes);

  // Generate QR Code PNG
  const qrPngDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 280,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' }
  });
  const qrPngBytes = Buffer.from(qrPngDataUrl.split(',')[1], 'base64');
  const qrImg = await pdfDoc.embedPng(qrPngBytes);

  // Colors
  const redColor = rgb(179 / 255, 18 / 255, 43 / 255);       // #B3122B
  const creamColor = rgb(247 / 255, 243 / 255, 236 / 255);   // #F7F3EC
  const textColor = rgb(26 / 255, 26 / 255, 26 / 255);       // #1A1A1A
  const greyColor = rgb(85 / 255, 85 / 255, 85 / 255);       // #555555
  const lineUnderline = rgb(207 / 255, 175 / 255, 168 / 255); // #CFAFA8

  // Helper for coordinates: top-down measurement
  // Y in PDF is from bottom: yPdf = height - yTop
  const fromTop = (yTop) => height - yTop;

  // 1. Cream Background
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: creamColor
  });

  // 2. Borders
  // Red frame 4.5 pt, inset 21 pt
  page.drawRectangle({
    x: 21,
    y: 21,
    width: width - 42,
    height: height - 42,
    borderColor: redColor,
    borderWidth: 4.5
  });

  // Thin red line 1.1 pt, inset 30 pt
  page.drawRectangle({
    x: 30,
    y: 30,
    width: width - 60,
    height: height - 60,
    borderColor: redColor,
    borderWidth: 1.1
  });

  // 3. Hub Logo (94 x 94 pt, centred, top edge 48 pt from top)
  const logoWidth = 94;
  const logoHeight = 94;
  const logoX = (width - logoWidth) / 2;
  const logoY = fromTop(48 + logoHeight);
  page.drawImage(hubLogoImg, {
    x: logoX,
    y: logoY,
    width: logoWidth,
    height: logoHeight
  });

  // Helper: Draw spaced centered text
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

  // 4. Line "TECHNICAL SKILL DEVELOPMENT HUB • SVIT NASHIK"
  // Helvetica 9.5 pt, grey, letter-spacing 2.2, baseline at 158 pt
  drawCenteredTextWithSpacing(
    "TECHNICAL SKILL DEVELOPMENT HUB  •  SVIT NASHIK",
    158,
    helvetica,
    9.5,
    greyColor,
    2.2
  );

  // 5. "CERTIFICATE"
  // Times Bold 44 pt, red, letter-spacing 2.5, baseline at 208 pt
  drawCenteredTextWithSpacing(
    "CERTIFICATE",
    208,
    timesBold,
    44,
    redColor,
    2.5
  );

  // 6. "OF COMPLETION"
  // Helvetica 12.5 pt, letter-spacing 5.5, baseline at 232 pt
  drawCenteredTextWithSpacing(
    "OF COMPLETION",
    232,
    helvetica,
    12.5,
    textColor,
    5.5
  );

  // 7. "This is proudly presented to"
  // Helvetica 11.5 pt, grey, baseline at 266 pt
  const proudlyText = "This is proudly presented to";
  const proudlyWidth = helvetica.widthOfTextAtSize(proudlyText, 11.5);
  page.drawText(proudlyText, {
    x: (width - proudlyWidth) / 2,
    y: fromTop(266),
    size: 11.5,
    font: helvetica,
    color: greyColor
  });

  // 8. Student Name
  // Times Italic 32 pt (shrink down to min 20 pt if long), #1A1A1A, centred, in box 500 pt wide
  // with a 1 pt line (#CFAFA8), 460 pt wide, under it at about 316 pt
  let nameFontSize = 32;
  while (timesItalic.widthOfTextAtSize(studentName, nameFontSize) > 460 && nameFontSize > 20) {
    nameFontSize -= 0.5;
  }
  const nameWidth = timesItalic.widthOfTextAtSize(studentName, nameFontSize);
  page.drawText(studentName, {
    x: (width - nameWidth) / 2,
    y: fromTop(308), // baseline sits just above 316 line
    size: nameFontSize,
    font: timesItalic,
    color: textColor
  });

  // Underline at 316 pt
  const underlineWidth = 460;
  page.drawLine({
    start: { x: (width - underlineWidth) / 2, y: fromTop(316) },
    end: { x: (width + underlineWidth) / 2, y: fromTop(316) },
    thickness: 1,
    color: lineUnderline
  });

  // Helper for multi-style centered line
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

  // 9. Three text lines, baselines at 342, 360, 378 pt:
  // Line 1: "for successfully completing the Technova Code Sprint: 9 Days to Build,"
  drawMixedCenteredLine([
    { text: "for successfully completing the ", font: helvetica, size: 12.5, color: textColor },
    { text: "Technova Code Sprint: 9 Days to Build", font: helveticaBold, size: 12.5, color: textColor },
    { text: ",", font: helvetica, size: 12.5, color: textColor }
  ], 342);

  // Line 2: "a daily coding challenge organised by the Technical Skill Development Hub, SVIT Nashik,"
  drawMixedCenteredLine([
    { text: "a daily coding challenge organised by the Technical Skill Development Hub, SVIT Nashik,", font: helvetica, size: 12.5, color: textColor }
  ], 360);

  // Line 3: "from 13 Oct 2026 to 21 Oct 2026 , in the [Language] track, with a score of [Score] / 100."
  // Note: the bold values are Helvetica Bold 12 pt in red
  drawMixedCenteredLine([
    { text: "from  ", font: helvetica, size: 12.5, color: textColor },
    { text: "13 Oct 2026", font: helveticaBold, size: 12, color: redColor },
    { text: "  to  ", font: helvetica, size: 12.5, color: textColor },
    { text: "21 Oct 2026", font: helveticaBold, size: 12, color: redColor },
    { text: " , in the ", font: helvetica, size: 12.5, color: textColor },
    { text: `[${language}]`, font: helveticaBold, size: 12, color: redColor },
    { text: " track, with a score of ", font: helvetica, size: 12.5, color: textColor },
    { text: `[${score}]`, font: helveticaBold, size: 12, color: redColor },
    { text: " / 100.", font: helvetica, size: 12.5, color: textColor }
  ], 378);

  // 10. "Learn | Build | Grow": Times Italic 12.5 pt, red, letter-spacing 2, baseline at 412 pt
  drawCenteredTextWithSpacing(
    "Learn   |   Build   |   Grow",
    412,
    timesItalic,
    12.5,
    redColor,
    2
  );

  // 11. Left Signature Block (Technical Secretary)
  // centred at x = 170 pt. signature image (130 pt wide, ratio preserved), above 1 pt black line 210 pt wide, baseline at 503 pt
  const sigLineY = fromTop(503);
  const leftCenterX = 170;
  const leftLineWidth = 210;
  page.drawLine({
    start: { x: leftCenterX - leftLineWidth / 2, y: sigLineY },
    end: { x: leftCenterX + leftLineWidth / 2, y: sigLineY },
    thickness: 1,
    color: rgb(0, 0, 0)
  });

  const secSigW = 130;
  const secSigH = (secSigW * 115) / 479; // ~31.2 pt
  page.drawImage(secSigImg, {
    x: leftCenterX - secSigW / 2,
    y: sigLineY + 3,
    width: secSigW,
    height: secSigH
  });

  // Vedant Kokane (Helvetica Bold 11.5)
  const secName = "Vedant Kokane";
  const secNameW = helveticaBold.widthOfTextAtSize(secName, 11.5);
  page.drawText(secName, {
    x: leftCenterX - secNameW / 2,
    y: fromTop(518),
    size: 11.5,
    font: helveticaBold,
    color: textColor
  });

  // Technical Secretary, SVIT Nashik (Helvetica 9.5, grey)
  const secTitle = "Technical Secretary, SVIT Nashik";
  const secTitleW = helvetica.widthOfTextAtSize(secTitle, 9.5);
  page.drawText(secTitle, {
    x: leftCenterX - secTitleW / 2,
    y: fromTop(530),
    size: 9.5,
    font: helvetica,
    color: greyColor
  });

  // 12. Right Signature Block (Principal)
  // centred at x = 672 pt. signature image (110 pt wide), 1 pt black line 210 pt wide, baseline at 503 pt
  const rightCenterX = 672;
  const rightLineWidth = 210;
  page.drawLine({
    start: { x: rightCenterX - rightLineWidth / 2, y: sigLineY },
    end: { x: rightCenterX + rightLineWidth / 2, y: sigLineY },
    thickness: 1,
    color: rgb(0, 0, 0)
  });

  const princSigW = 110;
  const princSigH = (princSigW * 108) / 297; // 40 pt
  page.drawImage(princSigImg, {
    x: rightCenterX - princSigW / 2,
    y: sigLineY + 3,
    width: princSigW,
    height: princSigH
  });

  // Dr. Sarang S. Pande (Helvetica Bold 11.5)
  const princName = "Dr. Sarang S. Pande";
  const princNameW = helveticaBold.widthOfTextAtSize(princName, 11.5);
  page.drawText(princName, {
    x: rightCenterX - princNameW / 2,
    y: fromTop(518),
    size: 11.5,
    font: helveticaBold,
    color: textColor
  });

  // Principal, SVIT Nashik (Helvetica 9.5, grey)
  const princTitle = "Principal, SVIT Nashik";
  const princTitleW = helvetica.widthOfTextAtSize(princTitle, 9.5);
  page.drawText(princTitle, {
    x: rightCenterX - princTitleW / 2,
    y: fromTop(530),
    size: 9.5,
    font: helvetica,
    color: greyColor
  });

  // 13. College Seal: 82 x 82 pt, centred on page, bottom about 8 pt below signature line level
  // sigLineY is at fromTop(503) = 92.28 pt. Bottom at 92.28 - 8 = 84.28 pt!
  const sealW = 82;
  const sealH = 82;
  const sealX = (width - sealW) / 2;
  const sealY = sigLineY - 8;
  page.drawImage(sealImg, {
    x: sealX,
    y: sealY,
    width: sealW,
    height: sealH
  });

  // Certificate ID under seal: "Certificate ID: [ID]" in Helvetica 9 pt, grey, centred
  const certIdText = `Certificate ID:   ${certId}`;
  const certIdW = helvetica.widthOfTextAtSize(certIdText, 9);
  page.drawText(certIdText, {
    x: (width - certIdW) / 2,
    y: fromTop(530),
    size: 9,
    font: helvetica,
    color: greyColor
  });

  // 14. Verification QR: 70 x 70 pt, top-right corner.
  // left edge at 722 pt, top edge at 55 pt from top. White background and quiet zone around it.
  const qrLeft = 722;
  const qrTop = 55;
  const qrSize = 70;
  // White quiet zone background
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
  const scanText = "SCAN TO VERIFY";
  const scanW = helveticaBold.widthOfTextAtSize(scanText, 7.5);
  page.drawText(scanText, {
    x: qrLeft + (qrSize - scanW) / 2,
    y: fromTop(qrTop + qrSize + 16),
    size: 7.5,
    font: helveticaBold,
    color: greyColor
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('public/test-certificate-generated.pdf', pdfBytes);
  console.log('Successfully generated test certificate PDF! Size:', pdfBytes.length);
}

generateTestCertificate().catch(console.error);
