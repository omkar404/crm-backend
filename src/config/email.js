const nodemailer = require("nodemailer");

const createTransporter = () => {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    });
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASS) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASS,
      },
    });
  }

  return null;
};

module.exports = async function sendEmail({ from, to, cc, bcc, subject, text, html, attachments = [] }) {
  const transporter = createTransporter();

  if (!transporter) {
    throw new Error("SMTP credentials are not configured");
  }

  return transporter.sendMail({
    from: from || process.env.SMTP_FROM || process.env.GMAIL_USER || process.env.SMTP_USER,
    to,
    cc,
    bcc,
    subject,
    text,
    html,
    attachments,
  });
};
