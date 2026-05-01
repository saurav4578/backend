const getOTPVerificationEmailTemplate = (otpCode, userName = 'Student') => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7f6; }
      .email-container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
      .email-header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 30px 20px; text-align: center; }
      .email-header h1 { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 1px; }
      .email-body { padding: 40px 30px; color: #333333; line-height: 1.6; }
      .otp-container { margin: 30px 0; text-align: center; }
      .otp-code { display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4F46E5; background-color: #EEF2FF; padding: 15px 30px; border-radius: 8px; border: 2px dashed #4F46E5; }
      .email-footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="email-header">
        <h1>LMS Authentication</h1>
      </div>
      <div class="email-body">
        <h2>Hello ${userName},</h2>
        <p>To securely complete your verification, please use the One-Time Password (OTP) below.</p>
        <div class="otp-container"><div class="otp-code">${otpCode}</div></div>
        <p>This code is valid for 5 minutes.</p>
        <p>Best Regards,<br><strong>The LMS Team</strong></p>
      </div>
      <div class="email-footer">
        <p>&copy; ${new Date().getFullYear()} LMS Platform. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};

const getTestResultEmailTemplate = (data) => {
  const { studentName, testName, score, total, percentage, rank, totalAttempts, status } = data;
  const statusColor = status === 'Pass' ? '#059669' : '#DC2626';
  const statusBg = status === 'Pass' ? '#ECFDF5' : '#FEF2F2';

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Result</title>
  </head>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; color: #1f2937;">
    <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 40px 20px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">Test Result Published</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">LMS Academic Notification</p>
      </div>

      <!-- Body -->
      <div style="padding: 40px 30px;">
        <p style="font-size: 18px; margin-bottom: 10px; color: #111827;">Hello <strong>${studentName}</strong>,</p>
        <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">Great news! Your instructor has just published the final results for <strong>${testName}</strong>. You can now view your performance and ranking below.</p>
        
        <!-- Result Card -->
        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 16px; padding: 30px; margin: 30px 0; text-align: center;">
          <p style="font-size: 13px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Your Final Score</p>
          <p style="font-size: 54px; font-weight: 900; color: #4f46e5; margin: 0; line-height: 1;">${score}<span style="font-size: 24px; color: #9ca3af; font-weight: 400;"> / ${total}</span></p>
          
          <div style="display: inline-block; padding: 8px 20px; border-radius: 9999px; font-weight: 800; font-size: 14px; color: ${statusColor}; background-color: ${statusBg}; margin-top: 20px; text-transform: uppercase;">
            ${status}ed
          </div>

          <table width="100%" style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            <tr>
              <td align="center" style="border-right: 1px solid #e5e7eb;">
                <p style="font-size: 11px; color: #9ca3af; text-transform: uppercase; margin: 0;">Rank</p>
                <p style="font-size: 20px; font-weight: 800; color: #1f2937; margin: 5px 0 0 0;">#${rank} <span style="font-size: 12px; color: #6b7280; font-weight: 400;">/ ${totalAttempts}</span></p>
              </td>
              <td align="center">
                <p style="font-size: 11px; color: #9ca3af; text-transform: uppercase; margin: 0;">Percentage</p>
                <p style="font-size: 20px; font-weight: 800; color: #1f2937; margin: 5px 0 0 0;">${percentage}%</p>
              </td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin-top: 35px;">
          <a href="http://localhost:5173/dashboard" style="background-color: #4f46e5; color: white; text-decoration: none; padding: 18px 40px; border-radius: 14px; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 10px 20px rgba(79, 70, 229, 0.25);">View Full Report</a>
        </div>
        
        <p style="margin-top: 45px; font-size: 14px; color: #9ca3af; text-align: center; font-style: italic;">"Education is the most powerful weapon which you can use to change the world."</p>
      </div>

      <!-- Footer -->
      <div style="background-color: #f9fafb; padding: 25px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0 0 10px 0; font-weight: 600;">LMS Learning Platform</p>
        <p style="margin: 0;">This is an automated message. Please do not reply directly to this email.</p>
        <p style="margin: 10px 0 0 0;">&copy; ${new Date().getFullYear()} LMS Team. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};

module.exports = {
  getOTPVerificationEmailTemplate,
  getTestResultEmailTemplate
};
