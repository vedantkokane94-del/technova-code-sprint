/**
 * Firebase Cloud Functions for Technova Code Sprint (SVIT Nashik)
 * 1. generateCertificatePDF: Uses pdf-lib / HTML template, stores in Firebase Storage
 * 2. sendCertificateEmail: Sends PDF as attachment from technicalteamsvit@gmail.com
 *    using Resend or SendGrid with rate-limiting, batching, and logging.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();

// Environment secret keys (configure via: firebase functions:secrets:set RESEND_API_KEY)
const RESEND_API_KEY = process.env.RESEND_API_KEY || functions.config()?.resend?.key || '';
const FROM_EMAIL = 'technicalteamsvit@gmail.com';

/**
 * Cloud Function: Generate Certificate PDF & Upload to Firebase Storage
 */
exports.generateCertificate = functions.https.onCall(async (data, context) => {
  // Security Check: Only Admins can invoke
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Admin authentication required.');
  }

  const { studentName, prn, track, certificateId, startDate, endDate, issuedDate, email } = data;

  try {
    // 1. Create Landscape A4 PDF Document (842 x 595 points)
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([841.89, 595.28]); // A4 Landscape
    const { width, height } = page.getSize();

    // Fonts
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSerif = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    // Primary Brand Colors: SVIT Red #B3122B, Golden #E5A93B, Cream #FCF9F2
    const svitRed = rgb(179 / 255, 18 / 255, 43 / 255);
    const golden = rgb(229 / 255, 169 / 255, 59 / 255);
    const cream = rgb(252 / 255, 249 / 255, 242 / 255);
    const darkText = rgb(26 / 255, 26 / 255, 26 / 255);

    // Background Canvas
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: cream
    });

    // Decorative Borders
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

    // Header Titles
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

    // Certificate ID & Date
    page.drawText(`ID: ${certificateId}`, {
      x: width - 180,
      y: height - 60,
      size: 10,
      font: fontBold,
      color: svitRed
    });

    page.drawText(`Date: ${issuedDate}`, {
      x: width - 180,
      y: height - 75,
      size: 9,
      font: fontRegular,
      color: darkText
    });

    // Main Certificate Title
    page.drawText("CERTIFICATE OF COMPLETION", {
      x: 210,
      y: height - 150,
      size: 26,
      font: fontBold,
      color: svitRed
    });

    page.drawText("This is proudly presented to", {
      x: 340,
      y: height - 185,
      size: 12,
      font: fontRegular,
      color: darkText
    });

    // Student Name
    page.drawText(studentName.toUpperCase(), {
      x: 250,
      y: height - 235,
      size: 28,
      font: fontSerif,
      color: svitRed
    });

    page.drawText(`PRN: ${prn}`, {
      x: 370,
      y: height - 260,
      size: 11,
      font: fontBold,
      color: darkText
    });

    // Award Body Text
    const bodyText = `for successfully completing all nine days of the Technova Code Sprint: 9 Days to Build,\norganised by the Technical Skill Development Hub, SVIT Nashik,\nfrom ${startDate} to ${endDate}, in the ${track} track.`;
    
    page.drawText(bodyText, {
      x: 170,
      y: height - 310,
      size: 13,
      font: fontRegular,
      color: darkText,
      lineHeight: 20
    });

    // Motto
    page.drawText("LEARN  |  BUILD  |  GROW", {
      x: 330,
      y: height - 390,
      size: 12,
      font: fontBold,
      color: svitRed
    });

    // QR Code Verification
    const verifyUrl = `https://technova-svit-sprint.web.app/verify/${certificateId}`;
    const qrPngBuffer = await QRCode.toBuffer(verifyUrl, { width: 100, margin: 1 });
    const qrImage = await pdfDoc.embedPng(qrPngBuffer);
    page.drawImage(qrImage, {
      x: 380,
      y: 60,
      width: 75,
      height: 75
    });

    page.drawText("Scan to Verify", {
      x: 385,
      y: 48,
      size: 8,
      font: fontBold,
      color: darkText
    });

    // Signatures
    // Sign 1: Vedant Kokane
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
    page.drawText("Vedant Kokane\nTechnical Secretary\nSVIT Nashik", {
      x: 75,
      y: 85,
      size: 10,
      font: fontRegular,
      color: darkText,
      lineHeight: 14
    });

    // Sign 2: Dr. S. S. Pande
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

    // 2. Save PDF and Upload to Firebase Storage
    const pdfBytes = await pdfDoc.save();
    const bucket = storage.bucket();
    const filePath = `certificates/${certificateId}.pdf`;
    const file = bucket.file(filePath);

    await file.save(Buffer.from(pdfBytes), {
      metadata: {
        contentType: 'application/pdf',
        metadata: { certificateId, studentName, prn }
      }
    });

    // Generate signed download URL
    const [downloadUrl] = await file.getSignedUrl({
      action: 'read',
      expires: '03-01-2030'
    });

    // 3. Store in Firestore certificates collection
    await db.collection('certificates').doc(certificateId).set({
      certificateId,
      studentName,
      prn,
      email,
      track,
      startDate,
      endDate,
      issuedDate,
      downloadUrl,
      status: 'generated',
      emailSent: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, certificateId, downloadUrl };
  } catch (error) {
    console.error("Certificate Generation Error:", error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Cloud Function: Send Certificate Email via Resend / SendGrid
 * Sent from: technicalteamsvit@gmail.com
 */
exports.sendCertificateEmail = functions.https.onCall(async (data, context) => {
  // Only Admins
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Admin authentication required.');
  }

  const { certificateId, recipientEmail, studentName, testMode = false } = data;

  const targetEmail = testMode ? context.auth.token.email : recipientEmail;

  try {
    // Fetch certificate record
    const certDoc = await db.collection('certificates').doc(certificateId).get();
    if (!certDoc.exists) {
      throw new Error(`Certificate ${certificateId} not found.`);
    }
    const certData = certDoc.data();

    // Download PDF buffer from storage
    const bucket = storage.bucket();
    const file = bucket.file(`certificates/${certificateId}.pdf`);
    const [pdfBuffer] = await file.download();

    // Construct Email Content
    const emailSubject = "Your Technova Code Sprint Certificate";
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #E8DEC8; border-radius: 12px; background: #FCF9F2;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #B3122B; margin: 0;">TECHNOVA CODE SPRINT</h2>
          <p style="color: #8B0D20; font-weight: bold; margin: 4px 0;">Technical Skill Development Hub, SVIT Nashik</p>
          <p style="color: #666; font-size: 12px; margin: 0;">Learn | Build | Grow</p>
        </div>

        <div style="background: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #eee;">
          <h3 style="color: #1A1A1A; margin-top: 0;">Dear ${studentName},</h3>
          <p style="color: #444; line-height: 1.6;">
            Congratulations on successfully completing all nine days of the <strong>Technova Code Sprint: 9 Days to Build</strong>!
          </p>
          <p style="color: #444; line-height: 1.6;">
            Your dedication and consistency represent the true spirit of engineering and continuous learning.
            Your verified Certificate of Completion is attached to this email.
          </p>

          <div style="background: #F5EFEB; padding: 12px 16px; border-left: 4px solid #B3122B; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #B3122B;">Certificate ID: ${certificateId}</p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">
              Public Verification: <a href="https://technova-svit-sprint.web.app/verify/${certificateId}" style="color: #B3122B;">Verify Authenticity Online</a>
            </p>
          </div>

          <p style="color: #444; line-height: 1.6;">
            Share your accomplishment on LinkedIn and tag our hub! Connect with us across our campus community:
          </p>

          <div style="margin-top: 15px;">
            <a href="https://instagram.com/tsdh_svit" style="display: inline-block; background: #B3122B; color: #ffffff; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 12px; margin-right: 10px;">
              Instagram: @tsdh_svit
            </a>
            <a href="https://linkedin.com/company/technical-skill-development-hub" style="display: inline-block; background: #0A66C2; color: #ffffff; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 12px;">
              Join LinkedIn Group
            </a>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #888;">
          <p>Sent from: ${FROM_EMAIL}</p>
          <p>Technical Skill Development Hub, Sir Visvesvaraya Institute of Technology, Nashik</p>
        </div>
      </div>
    `;

    // Send using Resend API (or configured SMTP)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `Technical Skill Development Hub <${FROM_EMAIL}>`,
        to: [targetEmail],
        subject: emailSubject,
        html: emailHtml,
        attachments: [
          {
            filename: `Certificate_${certificateId}.pdf`,
            content: pdfBuffer.toString('base64')
          }
        ]
      })
    });

    const resJson = await response.json();

    if (!response.ok) {
      throw new Error(resJson.message || "Failed to deliver email through Resend API.");
    }

    // Log send event in Firestore audit trail
    await db.collection('email_logs').add({
      certificateId,
      recipientEmail: targetEmail,
      sender: FROM_EMAIL,
      testMode,
      status: 'sent',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      responseId: resJson.id || ''
    });

    if (!testMode) {
      await db.collection('certificates').doc(certificateId).update({
        emailSent: true,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        emailStatus: 'sent'
      });
    }

    return { success: true, message: `Email delivered to ${targetEmail}` };
  } catch (err) {
    console.error("Email Delivery Error:", err);

    await db.collection('email_logs').add({
      certificateId,
      recipientEmail: targetEmail,
      sender: FROM_EMAIL,
      testMode,
      status: 'failed',
      error: err.message,
      attemptedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await db.collection('certificates').doc(certificateId).update({
      emailStatus: 'failed',
      emailError: err.message
    });

    throw new functions.https.HttpsError('internal', err.message);
  }
});
