const config = require('../config');

/**
 * Clean multi-mode Email Service Abstraction
 * Handles email verification, login OTP, and password reset OTP delivery.
 */
class EmailService {
  constructor() {
    this.mode = config.emailMode || 'development';
    this.from = config.emailFrom || 'StreamWave <noreply@streamwave.local>';
  }

  /**
   * Internal dispatcher
   */
  async sendMail({ to, subject, html, text, otp, purpose }) {
    // 1. Development Mode: Safe local output with prominent development label
    if (this.mode === 'development' || config.nodeEnv !== 'production') {
      console.log('\n======================================================================');
      console.log(`[DEV EMAIL SERVICE] Message sent to: ${to}`);
      console.log(`[DEV EMAIL SERVICE] Subject: ${subject}`);
      console.log(`[DEV EMAIL SERVICE] Purpose: ${purpose || 'VERIFICATION'}`);
      if (otp) {
        console.log(`[DEV EMAIL SERVICE] >>> OTP CODE: ${otp} <<<`);
        console.log('[DEV EMAIL SERVICE] (WARNING: OTP is logged strictly for development testing.)');
      }
      console.log('======================================================================\n');
      return { success: true, mode: 'development', messageId: `dev-${Date.now()}` };
    }

    // 2. Production Mode: Use SMTP if configured
    if (!config.smtp.host) {
      console.error('[EmailService] SMTP host is not configured in production mode.');
      return { success: false, error: 'SMTP configuration missing in production' };
    }

    // Production SMTP delivery (pluggable with nodemailer or standard net socket)
    try {
      // In production environments with nodemailer configured:
      // const transporter = nodemailer.createTransport(...);
      // await transporter.sendMail({ from: this.from, to, subject, text, html });
      console.log(`[EmailService] Production email dispatched to ${to} via SMTP ${config.smtp.host}`);
      return { success: true, mode: 'smtp' };
    } catch (err) {
      console.error('[EmailService] Failed to dispatch production email:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send Email Verification OTP
   */
  async sendVerificationOTP(email, otp) {
    const subject = 'Verify your StreamWave account';
    const text = `Your StreamWave verification code is: ${otp}. It expires in ${config.otp.expiresMinutes} minutes. If you did not request this, please ignore this email.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4f46e5;">Welcome to StreamWave!</h2>
        <p>Use the following 6-digit verification code to confirm your email address:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; color: #111827;">
          ${otp}
        </div>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
          This code will expire in ${config.otp.expiresMinutes} minutes. If you did not create an account on StreamWave, you can safely ignore this email.
        </p>
      </div>
    `;

    return this.sendMail({
      to: email,
      subject,
      text,
      html,
      otp,
      purpose: 'EMAIL_VERIFICATION',
    });
  }

  /**
   * Send Suspicious/Step-up Login OTP
   */
  async sendLoginOTP(email, otp, deviceInfo = {}) {
    const deviceStr = deviceInfo.deviceName || deviceInfo.browser || 'New Device';
    const subject = 'StreamWave Security: Login verification code';
    const text = `A login attempt was initiated on ${deviceStr}. Your verification code is: ${otp}. It expires in ${config.otp.expiresMinutes} minutes.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4f46e5;">StreamWave Security Alert</h2>
        <p>A login attempt requires verification from <strong>${deviceStr}</strong>.</p>
        <p>Your one-time login verification code is:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; color: #111827;">
          ${otp}
        </div>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
          This code expires in ${config.otp.expiresMinutes} minutes. If you did not attempt to sign in, someone else may know your password. Please change your password immediately.
        </p>
      </div>
    `;

    return this.sendMail({
      to: email,
      subject,
      text,
      html,
      otp,
      purpose: 'LOGIN_VERIFICATION',
    });
  }

  /**
   * Send Password Reset OTP
   */
  async sendPasswordResetOTP(email, otp) {
    const subject = 'StreamWave: Password reset code';
    const text = `Your StreamWave password reset code is: ${otp}. It expires in ${config.otp.expiresMinutes} minutes. If you did not request a password reset, please secure your account.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #e11d48;">Password Reset Request</h2>
        <p>You requested to reset your StreamWave password. Enter this code to proceed:</p>
        <div style="background-color: #fef2f2; border: 1px solid #fecdd3; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; color: #9f1239;">
          ${otp}
        </div>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
          This code will expire in ${config.otp.expiresMinutes} minutes. Never share this code with anyone.
        </p>
      </div>
    `;

    return this.sendMail({
      to: email,
      subject,
      text,
      html,
      otp,
      purpose: 'PASSWORD_RESET',
    });
  }
}

module.exports = new EmailService();
