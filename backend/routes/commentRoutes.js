const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const {
  getCommentReplies,
  updateComment,
  deleteComment,
  getCommentLike,
  likeComment,
  unlikeComment,
} = require('../controllers/commentController');
const {
  translateComment,
  getCachedTranslation,
} = require('../controllers/translationController');
const {
  submitCommentReport,
} = require('../controllers/reportController');

// Rate limiter for comment mutations (editing, deletion)
const commentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.nodeEnv === 'production' ? 60 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many comment actions, please slow down',
  },
});

// Rate limiter for comment likes
const commentLikeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.nodeEnv === 'production' ? 120 : 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many reaction requests, please slow down',
  },
});

// Rate limiter for comment translation mutations
const translationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: config.nodeEnv === 'production' ? 20 : 120, // 20 per 10 min in prod
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many translation requests, please try again later',
  },
});

// Rate limiter for comment reporting (Phase 14)
const reportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: config.nodeEnv === 'production' ? 10 : 60, // 10 per 10 min in prod
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many report submissions, please try again later',
  },
});

// 1. Comment Replies
router.get('/:commentId/replies', optionalAuth, getCommentReplies);

// 2. Update & Delete Comment
router.put('/:commentId', authMiddleware, commentLimiter, updateComment);
router.delete('/:commentId', authMiddleware, commentLimiter, deleteComment);

// 3. Comment Likes
router.get('/:commentId/like', optionalAuth, getCommentLike);
router.post('/:commentId/like', authMiddleware, commentLikeLimiter, likeComment);
router.delete('/:commentId/like', authMiddleware, commentLikeLimiter, unlikeComment);

// 4. Multilingual Comment Translations (Phase 13)
router.post('/:commentId/translate', optionalAuth, translationLimiter, translateComment);
router.get('/:commentId/translation', optionalAuth, getCachedTranslation);

// 5. Comment Reporting & Moderation (Phase 14)
router.post('/:commentId/reports', authMiddleware, reportLimiter, submitCommentReport);

module.exports = router;
