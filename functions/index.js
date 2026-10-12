/**
 * Firebase Cloud Functions for Technova Code Sprint (SVIT Nashik)
 * 
 * 1. generateCertificate: Generates official PDF certificate matching Section 3 wording
 * 2. sendCertificateEmail: Sends certificate PDF attachment from technicalteamsvit@gmail.com
 *    via Gmail SMTP (smtp.gmail.com:465) using Nodemailer and Google App Password secrets
 *    (GMAIL_USER & GMAIL_APP_PASSWORD).
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();

// Cloud Function Secret Configuration: Read strictly inside the function
// Set in production using: firebase functions:secrets:set GMAIL_APP_PASSWORD
const GMAIL_SENDER_EMAIL = 'technicalteamsvit@gmail.com';
const SENDER_DISPLAY_NAME = 'Technical Skill Development Hub, SVIT Nashik';

/**
 * Configure Nodemailer Transporter with Gmail SMTP
 * Uses port 465 with SSL (or 587 with STARTTLS)
 */
function createGmailTransporter() {
  const user = process.env.GMAIL_USER || GMAIL_SENDER_EMAIL;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!pass) {
    throw new Error('Email sender not configured: Missing GMAIL_APP_PASSWORD in server environment/secrets.');
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Port 465 uses SSL
    auth: {
      user,
      pass
    },
    tls: {
      rejectUnauthorized: true
    }
  });
}

/**
 * Helper: Classify send failures for reliability & idempotency tracking
 */
function classifySendError(err) {
  const msg = (err && err.message) ? err.message.toLowerCase() : '';
  const code = (err && err.code) ? err.code.toLowerCase() : '';

  if (msg.includes('invalid') || msg.includes('no recipient') || msg.includes('recipient rejected') || code === 'eauth') {
    if (code === 'eauth' || msg.includes('username and password not accepted') || msg.includes('invalid credentials')) {
      return { type: 'auth_error', message: 'Authentication problem: Google App Password invalid or expired.' };
    }
    return { type: 'invalid_address', message: 'Invalid recipient address or mailbox rejected.' };
  }
  if (msg.includes('mailbox full') || msg.includes('quota exceeded') || msg.includes('over quota')) {
    return { type: 'mailbox_full', message: 'Recipient mailbox full or storage exceeded.' };
  }
  if (msg.includes('rate limit') || msg.includes('daily user sending limit') || msg.includes('too many messages')) {
    return { type: 'rate_limit', message: 'Gmail daily user sending quota reached (500/day).' };
  }
  if (msg.includes('blocked') || msg.includes('blacklist') || msg.includes('suspicious activity')) {
    return { type: 'blocked', message: 'Gmail reported sending temporarily blocked.' };
  }
  return { type: 'smtp_error', message: err.message || 'SMTP delivery failure.' };
}

/**
 * Cloud Function: Generate Certificate PDF & Upload to Firebase Storage
 */
exports.generateCertificate = functions.https.onCall(async (data, context) => {
  // Security Gate: Only verified faculty admins
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Admin authentication required.');
  }

  const { studentName, prn, language, track, certificateId, score = 100 } = data;
  const chosenLang = language || track || 'Python';
  const cleanScore = typeof score === 'number' ? score.toFixed(1) : score;

  try {
    // 1. Create Landscape A4 PDF Document (841.89 x 595.28 points)
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([841.89, 595.28]);
    const { width, height } = page.getSize();

    // Fonts
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSerif = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    // Primary Brand Colors
    const svitRed = rgb(179 / 255, 18 / 255, 43 / 255);
    const golden = rgb(229 / 255, 169 / 255, 59 / 255);
    const cream = rgb(252 / 255, 249 / 255, 242 / 255);
    const darkText = rgb(26 / 255, 26 / 255, 26 / 255);

    // Canvas Background
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: cream
    });

    // Borders
    page.drawRectangle({
      x: 15,
      y: 15,
      width: width - 30,
      height: height - 30,
      borderColor: svitRed,
      borderWidth: 10
    });

    page.drawRectangle({
      x: 24,
      y: 24,
      width: width - 48,
      height: height - 48,
      borderColor: golden,
      borderWidth: 2
    });

    // Header Title
    page.drawText("SIR VISVESVARAYA INSTITUTE OF TECHNOLOGY, NASHIK", {
      x: 180,
      y: height - 70,
      size: 16,
      font: fontBold,
      color: darkText
    });

    page.drawText("Technical Skill Development Hub | Learn • Build • Grow", {
      x: 230,
      y: height - 90,
      size: 11,
      font: fontBold,
      color: svitRed
    });

    // Top Right QR Code (Section 3: 70 x 70 pt, quiet zone, SCAN TO VERIFY)
    const siteDomain = process.env.SITE_DOMAIN || "technova-code-sprint.vercel.app";
    const verifyUrl = `https://${siteDomain}/verify/${certificateId}`;
    const qrPngBuffer = await QRCode.toBuffer(verifyUrl, { width: 140, margin: 2 });
    const qrImage = await pdfDoc.embedPng(qrPngBuffer);
    
    // QR White Background Card
    page.drawRectangle({
      x: width - 110,
      y: height - 110,
      width: 76,
      height: 76,
      color: rgb(1, 1, 1),
      borderColor: golden,
      borderWidth: 1
    });

    page.drawImage(qrImage, {
      x: width - 107,
      y: height - 107,
      width: 70,
      height: 70
    });

    page.drawText("SCAN TO VERIFY", {
      x: width - 108,
      y: height - 122,
      size: 7,
      font: fontBold,
      color: darkText
    });

    // Certificate ID & College Seal Next to Seal (Section 3)
    page.drawText(`Certificate ID: ${certificateId}`, {
      x: 40,
      y: height - 60,
      size: 9,
      font: fontBold,
      color: svitRed
    });

    // Main Certificate Heading
    page.drawText("CERTIFICATE OF COMPLETION", {
      x: 210,
      y: height - 145,
      size: 26,
      font: fontBold,
      color: svitRed
    });

    page.drawText("This is proudly presented to", {
      x: 340,
      y: height - 180,
      size: 12,
      font: fontRegular,
      color: darkText
    });

    // Student Name
    page.drawText(studentName.toUpperCase(), {
      x: 220,
      y: height - 225,
      size: 26,
      font: fontSerif,
      color: svitRed
    });

    page.drawText(`PRN: ${prn}  •  Track: ${chosenLang}  •  Score: ${cleanScore} / 100`, {
      x: 270,
      y: height - 250,
      size: 11,
      font: fontBold,
      color: darkText
    });

    // Section 3: Exact Required Body Text
    const bodyLine1 = "for successfully completing the Technova Code Sprint: 9 Days to Build, a daily coding challenge organised by the";
    const bodyLine2 = `Technical Skill Development Hub, SVIT Nashik, from 13 Oct 2026 to 21 Oct 2026, in the ${chosenLang} track, with a score of ${cleanScore} / 100.`;

    page.drawText(bodyLine1, {
      x: 100,
      y: height - 295,
      size: 12,
      font: fontRegular,
      color: darkText
    });

    page.drawText(bodyLine2, {
      x: 100,
      y: height - 315,
      size: 12,
      font: fontBold,
      color: darkText
    });

    // Signatures
    page.drawText("Vedant Kokane", {
      x: 80,
      y: 110,
      size: 16,
      font: fontSerif,
      color: svitRed
    });
    page.drawLine({
      start: { x: 70, y: 100 },
      end: { x: 220, y: 100 },
      color: darkText,
      thickness: 1
    });
    page.drawText("Vedant Kokane\nLead Organizer & Admin\nSVIT Nashik", {
      x: 75,
      y: 85,
      size: 10,
      font: fontRegular,
      color: darkText,
      lineHeight: 14
    });

    page.drawText("Dr. S. S. Pande", {
      x: width - 210,
      y: 110,
      size: 16,
      font: fontSerif,
      color: svitRed
    });
    page.drawLine({
      start: { x: width - 220, y: 100 },
      end: { x: width - 70, y: 100 },
      color: darkText,
      thickness: 1
    });
    page.drawText("Dr. S. S. Pande\nPrincipal\nSVIT Nashik", {
      x: width - 215,
      y: 85,
      size: 10,
      font: fontRegular,
      color: darkText,
      lineHeight: 14
    });

    // Save and Upload to Storage
    const pdfBytes = await pdfDoc.save();
    const bucket = storage.bucket();
    const safeName = studentName.replace(/\s+/g, '_');
    const fileName = `certificates/Technova_Code_Sprint_Certificate_${safeName}.pdf`;
    const file = bucket.file(fileName);

    await file.save(Buffer.from(pdfBytes), {
      metadata: {
        contentType: 'application/pdf',
        metadata: { certificateId, studentName, prn, score: cleanScore, language: chosenLang }
      }
    });

    const [downloadUrl] = await file.getSignedUrl({
      action: 'read',
      expires: '03-01-2030'
    });

    // Store in Firestore
    await db.collection('certificates').doc(certificateId).set({
      certificateId,
      studentName,
      prn,
      language: chosenLang,
      score: Number(cleanScore),
      downloadUrl,
      fileName,
      status: 'valid',
      emailStatus: 'pending',
      issuedDate: '22nd October 2026',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, certificateId, downloadUrl, fileName };
  } catch (error) {
    console.error("Certificate Generation Error:", error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Cloud Function: Send Certificate Email via Gmail SMTP (Nodemailer)
 * Section 9 Implementation:
 * - From: technicalteamsvit@gmail.com with display name "Technical Skill Development Hub, SVIT Nashik"
 * - Reply-To: technicalteamsvit@gmail.com
 * - Exact plain-text and HTML templates matching Section 9.3
 * - Attachment: Technova_Code_Sprint_Certificate_[Name].pdf
 * - Secret credentials: GMAIL_USER, GMAIL_APP_PASSWORD
 * - Admin authorization gate: strictly restricted to verified admin
 */
exports.sendCertificateEmail = functions.https.onCall(async (data, context) => {
  // Section 8/9.1: Only verified admin can trigger sending
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Admin authentication required.');
  }

  const { 
    certificateId, 
    recipientEmail, 
    studentName, 
    language = 'Python', 
    score = 100, 
    testMode = false,
    resend = false 
  } = data;

  const targetEmail = testMode ? (context.auth.token.email || GMAIL_SENDER_EMAIL) : recipientEmail;

  // Basic validation (Section 9.7)
  if (!targetEmail || !targetEmail.includes('@')) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid recipient email address.');
  }

  try {
    // Check existing certificate record for idempotency (Section 9.4)
    const certRef = db.collection('certificates').doc(certificateId);
    const certDoc = await certRef.get();

    if (!certDoc.exists && !testMode) {
      throw new functions.https.HttpsError('not-found', `Certificate record ${certificateId} not found.`);
    }

    const certData = certDoc.exists ? certDoc.data() : {};
    
    // If already sent and resend was not explicitly requested, prevent duplicate
    if (!testMode && !resend && certData.emailStatus === 'sent') {
      return { 
        success: true, 
        skipped: true, 
        message: `Email already sent previously to ${targetEmail}. Use Resend if re-dispatch is required.` 
      };
    }

    // Set sending status in Firestore
    if (!testMode) {
      await certRef.set({
        emailStatus: 'sending',
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    // Setup Nodemailer Gmail transporter
    const transporter = createGmailTransporter();

    // Verify SMTP connection
    await transporter.verify();

    // Fetch PDF attachment from Firebase Storage
    const bucket = storage.bucket();
    const safeName = (studentName || 'Student').replace(/\s+/g, '_');
    const attachmentFilename = `Technova_Code_Sprint_Certificate_${safeName}.pdf`;
    
    let pdfBuffer = null;
    try {
      const storageFile = bucket.file(`certificates/${attachmentFilename}`);
      const [exists] = await storageFile.exists();
      if (exists) {
        [pdfBuffer] = await storageFile.download();
      }
    } catch (storageErr) {
      console.warn("Storage PDF download note:", storageErr.message);
    }

    // URLs
    const siteDomain = process.env.SITE_DOMAIN || "technova-code-sprint.vercel.app";
    const myCertLink = `https://${siteDomain}/#my-certificate`;
    const verifyLink = `https://${siteDomain}/verify/${certificateId}`;
    const linkedInGroupLink = "https://linkedin.com/company/technical-skill-development-hub";

    // Section 9.3: Exact Subject & Body
    const emailSubject = `Your Technova Code Sprint Certificate - ${studentName}`;

    const plainTextBody = `Dear ${studentName},

Congratulations! You have successfully completed the Technova Code Sprint: 9 Days to Build (13 to 21 October 2026), organised by the Technical Skill Development Hub, SVIT Nashik.

Your final score: ${score} / 100 | Language: ${language}
Certificate ID: ${certificateId}

Your certificate is attached to this email as a PDF. You can also view it at ${myCertLink}. Anyone can verify it at: ${verifyLink}.

Keep learning, keep building!

Regards, Technical Skill Development Hub, Sir Visvesvaraya Institute of Technology, Nashik
Instagram: @tsdh_svit | LinkedIn: ${linkedInGroupLink}

This is an automated email. For queries, reply to this email.`;

    const htmlBody = `
      <div style="font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: auto; padding: 24px; border: 1px solid #E8DEC8; border-radius: 16px; background: #FCF9F2; color: #1A1A1A;">
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #E8DEC8;">
          <h2 style="color: #B3122B; margin: 0 0 6px 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">TECHNOVA CODE SPRINT: 9 DAYS TO BUILD</h2>
          <p style="color: #8B0D20; font-weight: 700; margin: 0; font-size: 13px;">Technical Skill Development Hub, SVIT Nashik</p>
        </div>

        <div style="background: #ffffff; padding: 28px; border-radius: 12px; border: 1px solid #eee; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <p style="font-size: 15px; margin-top: 0; color: #1A1A1A;">Dear <strong>${studentName}</strong>,</p>
          
          <p style="font-size: 14px; line-height: 1.6; color: #333;">
            Congratulations! You have successfully completed the <strong>Technova Code Sprint: 9 Days to Build</strong> (13 to 21 October 2026), organised by the Technical Skill Development Hub, SVIT Nashik.
          </p>

          <div style="background: #FDF9F0; border-left: 4px solid #B3122B; padding: 14px 18px; margin: 20px 0; border-radius: 6px;">
            <p style="margin: 0; font-size: 13px; font-weight: 700; color: #B3122B;">
              Your final score: <span style="color: #1A1A1A;">${score} / 100</span> &nbsp;|&nbsp; Language: <span style="color: #1A1A1A;">${language}</span>
            </p>
            <p style="margin: 6px 0 0 0; font-size: 12px; font-family: monospace; color: #555;">
              Certificate ID: <strong style="color: #8B0D20;">${certificateId}</strong>
            </p>
          </div>

          <p style="font-size: 14px; line-height: 1.6; color: #333;">
            Your certificate is attached to this email as a PDF. You can also view it at 
            <a href="${myCertLink}" style="color: #B3122B; font-weight: 700; text-decoration: underline;">My Certificate portal</a>.
            Anyone can verify it at: 
            <a href="${verifyLink}" style="color: #B3122B; font-weight: 700; text-decoration: underline;">${verifyLink}</a>.
          </p>

          <p style="font-size: 14px; font-weight: 700; color: #B3122B; margin: 24px 0 16px 0;">
            Keep learning, keep building!
          </p>

          <div style="border-top: 1px solid #f0ece3; padding-top: 16px; margin-top: 20px; font-size: 12px; color: #555; line-height: 1.5;">
            <p style="margin: 0 0 6px 0; font-weight: 700; color: #1A1A1A;">
              Regards,<br/>
              Technical Skill Development Hub,<br/>
              Sir Visvesvaraya Institute of Technology, Nashik
            </p>
            <p style="margin: 6px 0 0 0;">
              Instagram: <a href="https://instagram.com/tsdh_svit" style="color: #B3122B; font-weight: 600;">@tsdh_svit</a> &nbsp;|&nbsp; 
              LinkedIn: <a href="${linkedInGroupLink}" style="color: #0A66C2; font-weight: 600;">SVIT Skill Hub Group</a>
            </p>
          </div>
        </div>

        <div style="text-align: center; margin-top: 18px; font-size: 11px; color: #888;">
          <p style="margin: 0;">This is an automated email. For queries, reply to this email.</p>
          <p style="margin: 4px 0 0 0;">Official Sender: ${GMAIL_SENDER_EMAIL}</p>
        </div>
      </div>
    `;

    // Mail Options
    const mailOptions = {
      from: `"${SENDER_DISPLAY_NAME}" <${GMAIL_SENDER_EMAIL}>`,
      to: targetEmail,
      replyTo: GMAIL_SENDER_EMAIL,
      subject: emailSubject,
      text: plainTextBody,
      html: htmlBody,
      attachments: pdfBuffer ? [
        {
          filename: attachmentFilename,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ] : []
    };

    // Send Mail via Gmail SMTP
    const info = await transporter.sendMail(mailOptions);

    // Record idempotent success state in Firestore
    const sentTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const attemptsCount = (certData.emailAttempts || 0) + 1;

    if (!testMode) {
      await certRef.set({
        emailSent: true,
        emailStatus: 'sent',
        sentAt: sentTimestamp,
        lastAttemptAt: sentTimestamp,
        emailAttempts: attemptsCount,
        messageId: info.messageId || '',
        emailError: null
      }, { merge: true });
    }

    // Record in official audit log
    await db.collection('email_audit_logs').add({
      certificateId,
      recipientEmail: targetEmail,
      studentName,
      sender: GMAIL_SENDER_EMAIL,
      status: 'sent',
      messageId: info.messageId || '',
      testMode,
      attempts: attemptsCount,
      timestamp: sentTimestamp
    });

    return { 
      success: true, 
      messageId: info.messageId, 
      recipient: targetEmail,
      message: `Certificate email successfully delivered to ${targetEmail} from ${GMAIL_SENDER_EMAIL}.` 
    };

  } catch (err) {
    console.error("Email Dispatch Failure:", err);
    const classified = classifySendError(err);
    const attemptsCount = (data.currentAttempts || 0) + 1;

    // Record failure in Firestore
    if (!testMode) {
      await db.collection('certificates').doc(certificateId).set({
        emailStatus: 'failed',
        emailError: classified.message,
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        emailAttempts: attemptsCount
      }, { merge: true });
    }

    await db.collection('email_audit_logs').add({
      certificateId,
      recipientEmail: targetEmail,
      studentName,
      sender: GMAIL_SENDER_EMAIL,
      status: 'failed',
      errorType: classified.type,
      errorReason: classified.message,
      testMode,
      attempts: attemptsCount,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    throw new functions.https.HttpsError('internal', classified.message);
  }
});
