const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { pool } = require('../config/db');
const {
  validateUsername,
  validateEmail,
  validatePassword,
  validateDisplayName,
} = require('../utils/authValidation');
const emailService = require('../services/emailService');
const otpService = require('../services/otpService');
const deviceService = require('../services/deviceService');
const securityEventService = require('../services/securityEventService');

/**
 * Helper to log login attempts into MySQL login_attempts table
 */
const recordLoginAttempt = async (userId, email, ipAddress, userAgent, success) => {
  try {
    const safeIp = String(ipAddress || '127.0.0.1').slice(0, 45);
    const safeUserAgent = userAgent ? String(userAgent).slice(0, 500) : null;
    const safeEmail = String(email || '').slice(0, 255);

    await pool.execute(
      `INSERT INTO login_attempts (user_id, email, ip_address, user_agent, success)
       VALUES (?, ?, ?, ?, ?)`,
      [userId || null, safeEmail, safeIp, safeUserAgent, success ? 1 : 0]
    );
  } catch (err) {
    console.error('[Auth] Failed to record login attempt:', err.message);
  }
};

/**
 * Cookie options helper
 */
const getCookieOptions = () => {
  const isProduction = config.nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  };
};

/**
 * User Registration
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  let connection = null;

  try {
    const { username, email, password, display_name, displayName } = req.body;
    const rawDisplayName = display_name || displayName;

    // 1. Input Validation
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: usernameValidation.error,
      });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: emailValidation.error,
      });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.error,
      });
    }

    const sanitizedUsername = usernameValidation.sanitized;
    const normalizedEmail = emailValidation.normalized;
    const displayNameValidation = validateDisplayName(rawDisplayName, sanitizedUsername);
    const sanitizedDisplayName = displayNameValidation.sanitized;

    // 2. Duplicate Checks
    const [existing] = await pool.execute(
      'SELECT id, username, email FROM users WHERE email = ? OR username = ? LIMIT 1',
      [normalizedEmail, sanitizedUsername]
    );

    if (existing.length > 0) {
      if (existing[0].email.toLowerCase() === normalizedEmail) {
        return res.status(409).json({
          success: false,
          message: 'Email is already registered',
        });
      }
      if (existing[0].username.toLowerCase() === sanitizedUsername.toLowerCase()) {
        return res.status(409).json({
          success: false,
          message: 'Username is already taken',
        });
      }
    }

    // 3. Password Hashing (bcrypt with 12 salt rounds)
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Transactional User & Profile Creation
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [userResult] = await connection.execute(
      `INSERT INTO users (username, email, password_hash, role, status, email_verified, failed_login_attempts)
       VALUES (?, ?, ?, 'USER', 'ACTIVE', FALSE, 0)`,
      [sanitizedUsername, normalizedEmail, passwordHash]
    );

    const userId = userResult.insertId;

    await connection.execute(
      `INSERT INTO user_profiles (user_id, display_name)
       VALUES (?, ?)`,
      [userId, sanitizedDisplayName]
    );

    // 4b. Auto-assign FREE subscription tier (Phase 15)
    const [freePlanRows] = await connection.execute(
      `SELECT id FROM subscription_plans WHERE code = 'FREE' LIMIT 1`
    );
    if (freePlanRows.length > 0) {
      const freePlanId = freePlanRows[0].id;
      await connection.execute(
        `INSERT INTO user_subscriptions 
           (user_id, plan_id, status, start_date, end_date, auto_renew, payment_provider, payment_reference)
         VALUES (?, ?, 'ACTIVE', NOW(), DATE_ADD(NOW(), INTERVAL 3650 DAY), 1, 'SYSTEM', 'AUTO_REGISTRATION')`,
        [userId, freePlanId]
      );
      await connection.execute(
        `INSERT INTO subscription_history 
           (user_id, previous_plan_id, new_plan_id, action, reason, created_at)
         VALUES (?, NULL, ?, 'ASSIGNED', 'Initial free tier assignment upon registration', NOW())`,
        [userId, freePlanId]
      );
    }

    await connection.commit();
    connection.release();
    connection = null;

    // 5. Audit Logging
    await securityEventService.logEvent({
      userId,
      eventType: 'USER_REGISTERED',
      req,
      metadata: { username: sanitizedUsername, email: normalizedEmail },
    });

    // 6. Response
    return res.status(201).json({
      success: true,
      message: 'Registration successful. You can now sign in.',
      user: {
        id: userId,
        username: sanitizedUsername,
        email: normalizedEmail,
        role: 'USER',
        email_verified: false,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error('[Auth] Rollback error:', rollbackErr.message);
      }
      connection.release();
    }
    next(error);
  }
};

/**
 * User Login
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const ipAddress = deviceService.getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // 1. Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // 2. Query user & profile & lockout status
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.email, u.password_hash, u.role, u.status, u.email_verified,
              u.failed_login_attempts, u.locked_until,
              p.display_name, p.avatar_url
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE u.email = ? LIMIT 1`,
      [normalizedEmail]
    );

    // 3. User not found -> Generic error to prevent account enumeration
    if (rows.length === 0) {
      await recordLoginAttempt(null, normalizedEmail, ipAddress, userAgent, false);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const user = rows[0];

    // 4. Account Lockout Protection (Phase 5)
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMs = new Date(user.locked_until).getTime() - Date.now();
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));

      await recordLoginAttempt(user.id, normalizedEmail, ipAddress, userAgent, false);
      await securityEventService.logEvent({
        userId: user.id,
        eventType: 'LOGIN_BLOCKED_LOCKOUT',
        req,
        metadata: { remainingMinutes },
      });

      return res.status(403).json({
        success: false,
        message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'} or reset your password.`,
        isLocked: true,
      });
    }

    // 5. Account status check
    if (user.status !== 'ACTIVE') {
      await recordLoginAttempt(user.id, normalizedEmail, ipAddress, userAgent, false);
      return res.status(403).json({
        success: false,
        message: 'Account is suspended or deactivated',
      });
    }

    // 6. Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      await recordLoginAttempt(user.id, normalizedEmail, ipAddress, userAgent, false);

      const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
      const maxAttempts = config.lockout.maxFailedAttempts || 5;

      // Lock account if failed threshold reached
      if (newFailedAttempts >= maxAttempts) {
        const lockoutMinutes = config.lockout.durationMinutes || 15;
        await pool.execute(
          `UPDATE users
           SET failed_login_attempts = ?,
               locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE)
           WHERE id = ?`,
          [newFailedAttempts, lockoutMinutes, user.id]
        );

        await securityEventService.logEvent({
          userId: user.id,
          eventType: 'ACCOUNT_LOCKED',
          req,
          metadata: { failedAttempts: newFailedAttempts, lockoutMinutes },
        });

        return res.status(403).json({
          success: false,
          message: `Account has been temporarily locked for ${lockoutMinutes} minutes due to ${maxAttempts} consecutive failed login attempts.`,
          isLocked: true,
        });
      } else {
        await pool.execute(
          'UPDATE users SET failed_login_attempts = ? WHERE id = ?',
          [newFailedAttempts, user.id]
        );

        await securityEventService.logEvent({
          userId: user.id,
          eventType: 'LOGIN_FAILED',
          req,
          metadata: { failedAttempts: newFailedAttempts },
        });

        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }
    }

    // 7. Password is valid! Reset failed login counter and lockout
    await pool.execute(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    // 8. Suspicious Login Detection (Phase 5)
    const risk = await deviceService.evaluateLoginRisk({ userId: user.id, req });
    if (risk.isSuspicious) {
      // Step-up verification required via Login OTP
      const { otp, expiresMinutes } = await otpService.generateOTP({
        userId: user.id,
        email: user.email,
        purpose: 'LOGIN',
      });

      const parsedUa = deviceService.parseUserAgent(userAgent);
      await emailService.sendLoginOTP(user.email, otp, parsedUa);

      await securityEventService.logEvent({
        userId: user.id,
        eventType: 'LOGIN_OTP_SENT',
        req,
        metadata: { reason: risk.reason },
      });

      // Temporary token for completing OTP verification
      const tempToken = jwt.sign(
        { tempId: user.id, purpose: 'LOGIN_OTP' },
        config.jwtSecret,
        { expiresIn: '15m' }
      );

      return res.status(200).json({
        success: true,
        requireOtp: true,
        tempToken,
        message: `Security verification required. A 6-digit code has been sent to ${user.email}.`,
      });
    }

    // 9. Standard Login: Register Device & Cryptographic Session (Phase 5)
    const { deviceId, sessionId, isNewDevice } = await deviceService.registerDeviceSession({
      userId: user.id,
      req,
    });

    await recordLoginAttempt(user.id, normalizedEmail, ipAddress, userAgent, true);

    await securityEventService.logEvent({
      userId: user.id,
      eventType: isNewDevice ? 'DEVICE_ADDED' : 'LOGIN_SUCCESS',
      req,
      deviceId,
      metadata: { sessionId },
    });

    // 10. Generate JWT with minimal payload including sessionId
    const token = jwt.sign(
      { id: user.id, role: user.role, sessionId },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn || '7d' }
    );

    // 11. Set HTTP-only Cookie
    res.cookie(config.cookieName, token, getCookieOptions());

    // 12. Return authenticated user data
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        email_verified: Boolean(user.email_verified),
        display_name: user.display_name || user.username,
        avatar_url: user.avatar_url || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Step-Up Login OTP
 * POST /api/auth/verify-login-otp
 */
const verifyLoginOtp = async (req, res, next) => {
  try {
    const { tempToken, otp } = req.body;

    if (!tempToken || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Temporary token and verification code are required',
      });
    }

    // 1. Verify temporary token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, config.jwtSecret);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Verification session expired. Please sign in again.',
      });
    }

    if (decoded.purpose !== 'LOGIN_OTP' || !decoded.tempId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid verification session',
      });
    }

    // 2. Fetch user
    const [users] = await pool.execute(
      `SELECT u.id, u.username, u.email, u.role, u.status, u.email_verified,
              p.display_name, p.avatar_url
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE u.id = ? LIMIT 1`,
      [decoded.tempId]
    );

    if (users.length === 0 || users[0].status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'User account invalid or suspended',
      });
    }

    const user = users[0];

    // 3. Verify OTP
    const otpResult = await otpService.verifyOTP({
      email: user.email,
      otp,
      purpose: 'LOGIN',
    });

    if (!otpResult.success) {
      await securityEventService.logEvent({
        userId: user.id,
        eventType: 'LOGIN_OTP_FAILED',
        req,
      });

      return res.status(400).json({
        success: false,
        message: otpResult.message,
      });
    }

    // 4. Register Device & Cryptographic Session
    const { deviceId, sessionId, isNewDevice } = await deviceService.registerDeviceSession({
      userId: user.id,
      req,
    });

    await securityEventService.logEvent({
      userId: user.id,
      eventType: 'LOGIN_OTP_SUCCESS',
      req,
      deviceId,
      metadata: { isNewDevice, sessionId },
    });

    // 5. Generate authenticated JWT
    const token = jwt.sign(
      { id: user.id, role: user.role, sessionId },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn || '7d' }
    );

    res.cookie(config.cookieName, token, getCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Login verified successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        email_verified: Boolean(user.email_verified),
        display_name: user.display_name || user.username,
        avatar_url: user.avatar_url || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send Email Verification OTP
 * POST /api/auth/send-verification-otp (Protected)
 */
const sendVerificationOtp = async (req, res, next) => {
  try {
    // Check if already verified
    const [rows] = await pool.execute('SELECT email_verified FROM users WHERE id = ?', [req.user.id]);
    if (rows.length > 0 && rows[0].email_verified) {
      return res.status(200).json({
        success: true,
        message: 'Your email is already verified.',
        alreadyVerified: true,
      });
    }

    const { otp, expiresMinutes } = await otpService.generateOTP({
      userId: req.user.id,
      email: req.user.email,
      purpose: 'EMAIL_VERIFICATION',
    });

    await emailService.sendVerificationOTP(req.user.email, otp);

    await securityEventService.logEvent({
      userId: req.user.id,
      eventType: 'EMAIL_VERIFICATION_OTP_SENT',
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${req.user.email}. Code expires in ${expiresMinutes} minutes.`,
    });
  } catch (error) {
    if (error.statusCode === 429) {
      return res.status(429).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * Verify Email with OTP
 * POST /api/auth/verify-email (Protected)
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'Verification code is required',
      });
    }

    const otpResult = await otpService.verifyOTP({
      email: req.user.email,
      otp,
      purpose: 'EMAIL_VERIFICATION',
    });

    if (!otpResult.success) {
      return res.status(400).json({
        success: false,
        message: otpResult.message,
      });
    }

    // Mark email verified
    await pool.execute('UPDATE users SET email_verified = TRUE WHERE id = ?', [req.user.id]);

    await securityEventService.logEvent({
      userId: req.user.id,
      eventType: 'EMAIL_VERIFIED',
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Request Password Reset (Forgot Password)
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Query user without revealing account existence
    const [users] = await pool.execute('SELECT id, email, status FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);

    if (users.length > 0 && users[0].status === 'ACTIVE') {
      try {
        const { otp } = await otpService.generateOTP({
          userId: users[0].id,
          email: normalizedEmail,
          purpose: 'PASSWORD_RESET',
        });

        await emailService.sendPasswordResetOTP(normalizedEmail, otp);

        await securityEventService.logEvent({
          userId: users[0].id,
          eventType: 'PASSWORD_RESET_REQUESTED',
          req,
        });
      } catch (otpErr) {
        if (otpErr.statusCode === 429) {
          return res.status(429).json({ success: false, message: otpErr.message });
        }
        console.error('[Auth] Password reset OTP generation error:', otpErr);
      }
    }

    // Generic response to prevent user enumeration
    return res.status(200).json({
      success: true,
      message: 'If the account exists, a password reset code has been sent.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Password Reset OTP
 * POST /api/auth/verify-reset-otp
 */
const verifyResetOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const result = await otpService.verifyOTP({
      email: normalizedEmail,
      otp,
      purpose: 'PASSWORD_RESET',
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    // Issue short-lived reset authorization token (15 mins)
    const resetToken = jwt.sign(
      { resetEmail: normalizedEmail, purpose: 'PASSWORD_RESET_AUTH' },
      config.jwtSecret,
      { expiresIn: '15m' }
    );

    return res.status(200).json({
      success: true,
      resetToken,
      message: 'Code verified. You can now choose a new password.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset Password with Authorization Token
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Reset token and new password are required',
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    // 1. Verify reset authorization token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, config.jwtSecret);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Password reset authorization has expired. Please restart the reset process.',
      });
    }

    if (decoded.purpose !== 'PASSWORD_RESET_AUTH' || !decoded.resetEmail) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password reset authorization',
      });
    }

    // 2. Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.error,
      });
    }

    // 3. Find user
    const [users] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [decoded.resetEmail]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User account not found',
      });
    }

    const userId = users[0].id;

    // 4. Hash new password with bcryptjs
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // 5. Update password, clear lockouts, and revoke ALL active device sessions
    await pool.execute(
      `UPDATE users
       SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL
       WHERE id = ?`,
      [passwordHash, userId]
    );

    // Revoke all active devices/sessions
    await pool.execute(
      'UPDATE devices SET is_revoked = TRUE, revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [userId]
    );

    // Invalidate any remaining password reset OTPs
    await pool.execute(
      "UPDATE otp_codes SET expires_at = NOW() WHERE email = ? AND purpose = 'PASSWORD_RESET'",
      [decoded.resetEmail]
    );

    await securityEventService.logEvent({
      userId,
      eventType: 'PASSWORD_RESET',
      req,
      metadata: { reason: 'successful_otp_reset' },
    });

    return res.status(200).json({
      success: true,
      message: 'Password has been successfully reset. Please sign in with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change Password (Authenticated)
 * POST /api/auth/change-password (Protected)
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match',
      });
    }

    // 1. Fetch current password hash
    const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 2. Verify current password
    const isCurrentValid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!isCurrentValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // 3. Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.error,
      });
    }

    // 4. Hash new password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // 5. Update in database
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);

    // 6. Revoke other device sessions to protect user, while keeping current session active
    if (req.user.sessionId) {
      await pool.execute(
        'UPDATE devices SET is_revoked = TRUE, revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND session_id != ?',
        [req.user.id, req.user.sessionId]
      );
    }

    await securityEventService.logEvent({
      userId: req.user.id,
      eventType: 'PASSWORD_CHANGED',
      req,
      deviceId: req.user.deviceId,
      metadata: { otherSessionsRevoked: true },
    });

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully. Other sessions have been logged out for security.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Current User
 * GET /api/auth/me (Protected)
 */
const getCurrentUser = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.email, u.role, u.status, u.email_verified,
              p.display_name, p.avatar_url
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE u.id = ? LIMIT 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = rows[0];

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        email_verified: Boolean(user.email_verified),
        display_name: user.display_name || user.username,
        avatar_url: user.avatar_url || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout Current User
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    // If authenticated session, revoke device session
    if (req.user?.sessionId) {
      await pool.execute(
        'UPDATE devices SET is_revoked = TRUE, revoked_at = CURRENT_TIMESTAMP WHERE session_id = ?',
        [req.user.sessionId]
      );
      await securityEventService.logEvent({
        userId: req.user.id,
        eventType: 'LOGOUT_SUCCESS',
        req,
      });
    }
  } catch (err) {
    console.error('[Auth] Session logout cleanup error:', err.message);
  }

  const isProduction = config.nodeEnv === 'production';
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  });

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

/**
 * Protected Test Endpoint
 * GET /api/auth/protected (Protected)
 */
const protectedTest = (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'You are authenticated',
    user: {
      id: req.user.id,
      role: req.user.role,
      email_verified: req.user.email_verified,
    },
  });
};

module.exports = {
  register,
  login,
  verifyLoginOtp,
  sendVerificationOtp,
  verifyEmail,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  changePassword,
  getCurrentUser,
  logout,
  protectedTest,
};
