/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

const functions = require("firebase-functions");
const nodemailer = require("nodemailer");

// Gmail credentials from Firebase config
const gmailEmail = functions.config().gmail.email;
const gmailPassword = functions.config().gmail.password;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailEmail,
    pass: gmailPassword,
  },
});

// Cloud Function: send SOS email
exports.sendSosEmail = functions.https.onCall(async (data, context) => {
  const { to, subject, message } = data;

  const mailOptions = {
    from: gmailEmail,
    to: to,
    subject: subject,
    html: `
      <h2>🚨 Emergency Alert 🚨</h2>
      <p><strong>${context.auth?.token.email || "A user"}</strong> has triggered an SOS alert.</p>
      <p>📍 Location: <a href="${message}" target="_blank">${message}</a></p>
      <p>Please respond immediately.</p>
      <hr/>
      <small>This is an automated emergency alert from SafeRoute.</small>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Email sending error:", error);
    throw new functions.https.HttpsError("internal", "Failed to send email");
  }
});


// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
