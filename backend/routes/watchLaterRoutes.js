const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
const watchLaterController = require('../controllers/watchLaterController');

const watchLaterMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many Watch Later requests. Please slow down and try again.',
  },
});

// 1. Get user's Watch Later queue
router.get('/', authMiddleware, watchLaterController.getWatchLater);

// 2. Check if a video is in user's Watch Later queue
router.get('/check/:videoId', authMiddleware, watchLaterController.checkWatchLater);

// 3. Add video to Watch Later
router.post('/:videoId', authMiddleware, watchLaterMutationLimiter, watchLaterController.addToWatchLater);

// 4. Remove video from Watch Later
router.delete('/:videoId', authMiddleware, watchLaterMutationLimiter, watchLaterController.removeFromWatchLater);

module.exports = router;
