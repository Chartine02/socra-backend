const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_ADDRESS = process.env.SMTP_FROM || "SOCRA <noreply@socra.app>";

function buildPerformanceHtml({ name, type, title, message, data }) {
  const suggestions = data?.suggestions || [];
  const weakTopics = data?.weakTopics || [];
  const encouragement = data?.encouragement || "";
  const scorePercent = data?.scorePercent;

  const typeLabel = type === "QUIZ_PERFORMANCE" ? "Quiz" : "Assignment";
  const scoreDisplay = scorePercent != null ? `${Math.round(scorePercent)}%` : "N/A";

  const suggestionsHtml = suggestions
    .map(
      (s) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;"><strong>${s.topic}</strong></td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.suggestion}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-transform:capitalize;">${s.priority}</td>
        </tr>`
    )
    .join("");

  const weakTopicsHtml = weakTopics.length
    ? `<p style="color:#d97706;"><strong>Areas to improve:</strong> ${weakTopics.join(", ")}</p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;border-radius:12px 12px 0 0;">
    <h1 style="color:white;margin:0;font-size:22px;">SOCRA</h1>
    <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;">Your ${typeLabel} Performance Report</p>
  </div>
  
  <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
    <p>Hi ${name},</p>
    
    <div style="background:white;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb;">
      <h2 style="margin:0 0 8px;font-size:18px;">${title}</h2>
      <p style="font-size:28px;font-weight:bold;color:#6366f1;margin:8px 0;">Score: ${scoreDisplay}</p>
      <p style="margin:8px 0;color:#555;">${message}</p>
    </div>

    ${weakTopicsHtml}

    ${encouragement ? `<p style="background:#ecfdf5;border-left:4px solid #10b981;padding:12px;border-radius:4px;color:#065f46;">${encouragement}</p>` : ""}

    ${
      suggestions.length
        ? `<h3 style="margin:20px 0 8px;">Study Suggestions</h3>
           <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
             <thead>
               <tr style="background:#f3f4f6;">
                 <th style="padding:8px 12px;text-align:left;">Topic</th>
                 <th style="padding:8px 12px;text-align:left;">Suggestion</th>
                 <th style="padding:8px 12px;text-align:left;">Priority</th>
               </tr>
             </thead>
             <tbody>${suggestionsHtml}</tbody>
           </table>`
        : ""
    }

    <div style="margin-top:24px;text-align:center;">
      <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;">Open SOCRA</a>
    </div>
    
    <p style="margin-top:24px;font-size:12px;color:#9ca3af;">You're receiving this because you have email notifications enabled. You can disable them in your SOCRA settings.</p>
  </div>
</body>
</html>`;
}

async function sendPerformanceEmail({ to, name, type, title, message, data }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    logger.warn("Email not configured (SMTP_HOST/SMTP_USER missing), skipping email notification");
    return;
  }

  const html = buildPerformanceHtml({ name, type, title, message, data });
  const typeLabel = type === "QUIZ_PERFORMANCE" ? "Quiz" : "Assignment";

  try {
    await transporter.sendMail({
      from: FROM_ADDRESS,
      to,
      subject: `[SOCRA] ${typeLabel} Report: ${title}`,
      html,
    });
    logger.info(`Performance email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send email", { error: err.message, to });
    throw err;
  }
}

module.exports = {
  sendPerformanceEmail,
};
