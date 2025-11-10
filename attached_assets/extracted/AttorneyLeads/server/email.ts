
type MailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendMail(msg: MailInput): Promise<void> {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM || "no-reply@example.com";

  if (host) {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: !!process.env.SMTP_SECURE, // set any value to force true
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
          : undefined,
      });
      await transporter.sendMail({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text });
      return;
    } catch (e) {
      // fall through to console
      console.warn("nodemailer not available or failed, falling back to console log:", (e as Error).message);
    }
  }

  // Dev fallback
  console.log("==== DEV MAIL (no SMTP configured) ====");
  console.log("TO:", msg.to);
  console.log("SUBJECT:", msg.subject);
  console.log("HTML:", msg.html);
}
