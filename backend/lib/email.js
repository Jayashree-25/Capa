const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return transporter;
};

const sendSetupEmail = async (to, name, token) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const setupLink = frontendUrl + '/setup-account?token=' + token;
  const subject = 'Welcome to CAPA - Set up your account';

  const html = [
    '<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px">',
    '<h1 style="font-size:24px;font-weight:700;color:#111827">CAPA</h1>',
    '<p style="color:#6b7280;font-size:14px">Capacity, clearly managed.</p>',
    '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />',
    '<p style="color:#374151;font-size:15px">Hi ' + name + ',</p>',
    '<p style="color:#374151;font-size:15px">Your CAPA account has been created.</p>',
    '<p style="color:#374151;font-size:15px">Click the link below to set up your password:</p>',
    '<a href="' + setupLink + '" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;margin:16px 0">Set up your account</a>',
    '<p style="color:#6b7280;font-size:13px;margin-top:24px">This link expires in 72 hours.<br/>If you did not expect this email, you can ignore it.</p>',
    '</div>'
  ].join('');

  const text = 'Hi ' + name + ',\n\nYour CAPA account has been created.\n\nSet up your password here: ' + setupLink + '\n\nThis link expires in 72 hours.\nIf you did not expect this email, you can ignore it.';

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'CAPA <noreply@capa.local>',
    to: to,
    subject: subject,
    text: text,
    html: html
  };

  // If SMTP is configured, always send the email
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    var transport = getTransporter();
    await transport.sendMail(mailOptions);
    console.log('Setup email sent to ' + to);
    return { success: true, dev: false };
  }

  // Fallback: log to console (no SMTP configured)
  console.log('\n========================================');
  console.log('  SETUP EMAIL (no SMTP configured)');
  console.log('========================================');
  console.log('To: ' + to);
  console.log('Subject: ' + subject);
  console.log('Setup Link: ' + setupLink);
  console.log('========================================\n');
  return { success: true, dev: true };
};

module.exports = { sendSetupEmail };
