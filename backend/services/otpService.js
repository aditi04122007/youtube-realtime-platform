const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const config = require('../config');

/**
 * OTP Engine for StreamWave
 * Manages generation, cryptographic hashing, attempt limiting, and expiration verification.
 */
class OTPService {
  /**
   * Generates a 6-digit numeric OTP, hashes it, and stores it in otp_codes
   */
  async generateOTP({ userId = null, email, purpose }) {
    if (!email || !purpose) {
      throw new Error('Email and purpose are required to generate an OTP');
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // 1. Resend cooldown protection: check if an active OTP was issued recently
    const cooldownSeconds = config.otp.resendCooldownSeconds || 60;
    const [recent] = await pool.execute(
      `SELECT id, created_at, TIMESTAMPDIFF(SECOND, created_at, NOW()) AS elapsed_seconds
       FROM otp_codes
       WHERE email = ? AND purpose = ? AND verified_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail, purpose]
    );

    if (recent.length > 0 && recent[0].elapsed_seconds !== null && recent[0].elapsed_seconds < cooldownSeconds) {
      const waitTime = cooldownSeconds - recent[0].elapsed_seconds;
      const error = new Error(`Please wait ${waitTime} second${waitTime === 1 ? '' : 's'} before requesting a new code.`);
      error.statusCode = 429;
      throw error;
    }

    // 2. Invalidate any existing active OTPs for this email and purpose
    await pool.execute(
      `UPDATE otp_codes
       SET expires_at = NOW()
       WHERE email = ? AND purpose = ? AND verified_at IS NULL AND expires_at > NOW()`,
      [normalizedEmail, purpose]
    );

    // 3. Generate 6-digit secure numeric OTP
    const rawOtp = crypto.randomInt(100000, 999999).toString();

    // 4. Hash the OTP with bcryptjs before saving
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(rawOtp, salt);

    // 5. Calculate expiration
    const expiresMinutes = config.otp.expiresMinutes || 10;

    // 6. Insert record into otp_codes
    await pool.execute(
      `INSERT INTO otp_codes (user_id, email, otp_hash, purpose, expires_at, attempts)
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 0)`,
      [userId || null, normalizedEmail, otpHash, purpose, expiresMinutes]
    );

    // Run safe cleanup occasionally
    this.cleanupOldOTPs().catch((err) => {
      console.warn('[OTPService] Cleanup error:', err.message);
    });

    return {
      otp: rawOtp,
      expiresMinutes,
    };
  }

  /**
   * Verifies an OTP submitted by the user
   */
  async verifyOTP({ email, otp, purpose }) {
    if (!email || !otp || !purpose) {
      return { success: false, message: 'Email, OTP, and purpose are required.' };
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    // 1. Fetch latest active unverified OTP for this email and purpose
    const [rows] = await pool.execute(
      `SELECT id, user_id, email, otp_hash, purpose, expires_at, attempts
       FROM otp_codes
       WHERE email = ? AND purpose = ? AND verified_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail, purpose]
    );

    if (rows.length === 0) {
      return {
        success: false,
        message: 'Invalid or expired verification code. Please request a new one.',
      };
    }

    const record = rows[0];
    const maxAttempts = config.otp.maxAttempts || 5;

    // 2. Check if max attempts reached
    if (record.attempts >= maxAttempts) {
      await pool.execute('UPDATE otp_codes SET expires_at = NOW() WHERE id = ?', [record.id]);
      return {
        success: false,
        message: 'Too many incorrect attempts. This code has been invalidated. Please request a new one.',
      };
    }

    // 3. Compare OTP hash
    const isMatch = await bcrypt.compare(cleanOtp, record.otp_hash);

    if (!isMatch) {
      const newAttempts = record.attempts + 1;
      if (newAttempts >= maxAttempts) {
        await pool.execute(
          'UPDATE otp_codes SET attempts = ?, expires_at = NOW() WHERE id = ?',
          [newAttempts, record.id]
        );
        return {
          success: false,
          message: 'Too many incorrect attempts. This code has been invalidated. Please request a new one.',
        };
      }

      await pool.execute('UPDATE otp_codes SET attempts = ? WHERE id = ?', [newAttempts, record.id]);
      const remaining = maxAttempts - newAttempts;
      return {
        success: false,
        message: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      };
    }

    // 4. Success: Mark verified
    await pool.execute(
      'UPDATE otp_codes SET verified_at = CURRENT_TIMESTAMP WHERE id = ?',
      [record.id]
    );

    return {
      success: true,
      userId: record.user_id,
      email: record.email,
    };
  }

  /**
   * Cleans up expired/verified OTPs older than 24 hours
   */
  async cleanupOldOTPs() {
    try {
      await pool.execute(
        'DELETE FROM otp_codes WHERE created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)'
      );
    } catch (err) {
      console.error('[OTPService] Failed to clean up old OTPs:', err.message);
    }
  }
}

module.exports = new OTPService();
