const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getWatchHistory,
  getContinueWatching,
  getVideoWatchHistory,
  saveWatchProgress,
  deleteWatchHistoryItem,
  clearWatchHistory,
} = require('../controllers/watchHistoryController');

// Rate limiter for watch progress updates
const progressLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.nodeEnv === 'production' ? 120 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many watch progress updates, please slow down',
  },
});

// All watch history endpoints require authentication
router.use(authMiddleware);

// 1. Get full paginated watch history
router.get('/', getWatchHistory);

// 2. Clear entire watch history for current user
router.delete('/', clearWatchHistory);

// 3. Get incomplete videos for Continue Watching shelf (MUST be defined before /:videoId)
router.get('/continue-watching', getContinueWatching);

// 4. Get watch progress / resume point for a single video
router.get('/:videoId', getVideoWatchHistory);

// 5. Save or update watch progress (UPSERT)
router.post('/', progressLimiter, saveWatchProgress);

// 6. Delete single video from watch history
router.delete('/:videoId', deleteWatchHistoryItem);

module.exports = router;
