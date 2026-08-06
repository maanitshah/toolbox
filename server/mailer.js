const nodemailer = require("nodemailer");

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[mailer] SMTP not configured — emails will be logged, not sent. Check your .env file.");
    return null;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

async function sendMail({ to, subject, text }) {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@pearclose.local";
  if (!t) {
    console.log(`[mailer] (not sent, SMTP unset) To: ${to} | Subject: ${subject}\n${text}`);
    return;
  }
  try {
    await t.sendMail({ from: `"Pear Close Toolbox" <${from}>`, to, subject, text });
    console.log(`[mailer] sent to ${to} — "${subject}"`);
  } catch (err) {
    console.error(`[mailer] FAILED sending to ${to}:`, err.message);
  }
}

async function sendBookingNotification({ ownerEmail, ownerName, borrowerName, toolName, start, end }) {
  await sendMail({
    to: ownerEmail,
    subject: `Your ${toolName} is reserved (${start} – ${end})`,
    text: `Hi ${ownerName.split(" ")[0]},\n\n${borrowerName} reserved your ${toolName} on Pear Close Toolbox for ${start} to ${end}.\n\nThey've agreed to return it clean, on time, and to replace it if it's damaged or lost while checked out to them.\n\nQuestions? Reach out on the WhatsApp group.\n\n— Pear Close Toolbox`,
  });
}

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  await sendMail({
    to,
    subject: "Reset your Pear Close Toolbox password",
    text: `Hi ${name.split(" ")[0]},\n\nSomeone (hopefully you) asked to reset the password on your Pear Close Toolbox account.\n\nTo set a new password, open this link within the next hour:\n${resetUrl}\n\nIf you didn't request this, you can ignore this email — your password won't change.\n\n— Pear Close Toolbox`,
  });
}

module.exports = { sendMail, sendBookingNotification, sendPasswordResetEmail };
