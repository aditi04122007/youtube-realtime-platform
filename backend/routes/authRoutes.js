const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const {
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
} = require('../controllers/authController');

// Dedicated rate limiter for sensitive authentication & OTP endpoints
// Production safe limit: 60/15min; relaxed during development to support automated test runs
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.nodeEnv === 'production' ? 60 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

// Stricter rate limiter for password reset requests
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.nodeEnv === 'production' ? 15 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later',
  },
});


// 1. Core Registration & Login
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/verify-login-otp', authLimiter, verifyLoginOtp);
router.post('/logout', optionalAuth, logout);
router.get('/me', authMiddleware, getCurrentUser);
router.get('/protected', authMiddleware, protectedTest);

// 2. Email Verification (Protected)
router.post('/send-verification-otp', authMiddleware, sendVerificationOtp);
router.post('/verify-email', authMiddleware, verifyEmail);

// 3. Password Reset (Public / Rate-limited)
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/verify-reset-otp', passwordResetLimiter, verifyResetOtp);
router.post('/reset-password', passwordResetLimiter, resetPassword);

// 4. Authenticated Password Change
router.post('/change-password', authMiddleware, changePassword);

module.exports = router;
