const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getQuota,
  getHistory,
  getSummary,
  deleteHistoryItem,
} = require('../controllers/downloadHistoryController');

// Rate limiter for download quota checks
const quotaLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.nodeEnv === 'production' ? 120 : 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many quota check requests, please slow down',
  },
});

// Rate limiter for download history listing
const historyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.nodeEnv === 'production' ? 60 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many history requests, please slow down',
  },
});

// Rate limiter for history deletion
const deleteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.nodeEnv === 'production' ? 60 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many delete requests, please wait a moment',
  },
});

// All download-history routes require authentication
router.use(authMiddleware);

// 1. Quota API: GET /api/download-history/quota
router.get('/quota', quotaLimiter, getQuota);

// 2. Summary API: GET /api/download-history/summary
router.get('/summary', quotaLimiter, getSummary);

// 3. History listing API: GET /api/download-history
router.get('/', historyLimiter, getHistory);

// 4. Delete History API: DELETE /api/download-history/:id
router.delete('/:id', deleteLimiter, deleteHistoryItem);

module.exports = router;
