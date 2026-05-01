const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    // We will use a mock service like Ethereal or standard SMTP, 
    // For local dev, you can use ethereal or user's Gmail if they provide it.
    // Assuming standard environment setup, using simple host
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    auth: {
      user: process.env.SMTP_EMAIL || 'test@ethereal.email',
      pass: process.env.SMTP_PASSWORD || 'test_password',
    },
  });

  const message = {
    from: `${process.env.FROM_NAME || 'LMS'} <${process.env.FROM_EMAIL || 'noreply@lms.com'}>`,
    to: options.email,
    subject: options.subject,
    html: options.html,
  };

  const info = await transporter.sendMail(message);
  console.log('Message sent: %s', info.messageId);
};

module.exports = sendEmail;
