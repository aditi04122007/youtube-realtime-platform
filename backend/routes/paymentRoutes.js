const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const config = require('../config');
const authMiddleware = require('../middleware/authMiddleware');
const {
  createPaymentOrder,
  verifyPayment,
  getPaymentHistory,
  handleWebhook,
} = require('../controllers/paymentController');

// Rate limiter for payment order creations (Phase 30)
const paymentOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.nodeEnv === 'production' ? 30 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many payment requests, please try again later',
  },
});

// Rate limiter for payment verifications
const paymentVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.nodeEnv === 'production' ? 30 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification requests, please try again later',
  },
});

// Rate limiter for webhooks
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.nodeEnv === 'production' ? 120 : 600,
  standardHeaders: true,
  legacyHeaders: false,
});

// 1. Authenticated User Payment Endpoints
router.post('/create-order', authMiddleware, paymentOrderLimiter, createPaymentOrder);
router.post('/verify', authMiddleware, paymentVerifyLimiter, verifyPayment);
router.get('/history', authMiddleware, getPaymentHistory);
router.get('/', authMiddleware, getPaymentHistory);

// 2. Public Webhook Endpoint (Cryptographically verified via X-Razorpay-Signature)
router.post('/webhook', webhookLimiter, handleWebhook);

module.exports = router;
