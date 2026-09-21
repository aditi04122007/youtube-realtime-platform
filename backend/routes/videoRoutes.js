const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const { uploadVideoAndThumbnail, uploadOptionalThumbnail } = require('../middleware/uploadMiddleware');
const {
  uploadVideo,
  getMyVideos,
  getVideoById,
  updateVideo,
  deleteVideo,
  getChannelVideos,
  getCategories,
  searchVideosHandler,
  getSuggestionsHandler,
  getRelatedVideosHandler,
  streamVideoHandler,
  getVideoAccessHandler,
  getVideoDownloadAccessHandler,
  downloadVideoHandler,
} = require('../controllers/videoController');
const {
  getVideoReaction,
  setVideoReaction,
  removeVideoReaction,
} = require('../controllers/videoReactionController');
const {
  getVideoComments,
  createComment,
} = require('../controllers/commentController');

// Rate limiter for reactions (Phase 11)
const reactionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.nodeEnv === 'production' ? 60 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many reaction requests, please slow down',
  },
});

// Rate limiter for video uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.nodeEnv === 'production' ? 50 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Upload limit reached, please try again in a few minutes',
  },
});

// Rate limiter for catalog searches
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.nodeEnv === 'production' ? 120 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many search requests, please slow down',
  },
});

// Rate limiter for search suggestions
const suggestionsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.nodeEnv === 'production' ? 300 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many suggestion requests, please slow down',
  },
});

// 1. Taxonomy & metadata
router.get('/categories', getCategories);

// 2. Catalog Search & Suggestions (Phase 8)
router.get('/search', searchLimiter, searchVideosHandler);
router.get('/suggestions', suggestionsLimiter, getSuggestionsHandler);
router.get('/related/:videoId', getRelatedVideosHandler);

// 3. Creator studio - My Videos
router.get('/my', authMiddleware, getMyVideos);

// 4. Channel published public videos
router.get('/channel/:channelId', getChannelVideos);

// 5. Video upload endpoint
router.post('/upload', authMiddleware, uploadLimiter, uploadVideoAndThumbnail, uploadVideo);

// 6. Video streaming endpoint with HTTP Range requests
router.get('/:id/stream', optionalAuth, streamVideoHandler);

// 6.1. Video access details endpoint
router.get('/:id/access', optionalAuth, getVideoAccessHandler);

// Rate limiters for downloads (Phase 19)
const downloadAccessLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.nodeEnv === 'production' ? 120 : 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many download access check requests, please slow down',
  },
});

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.nodeEnv === 'production' ? 30 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many download requests, please wait a moment',
  },
});

// 6.2. Video download access check endpoint (supports both /:videoId/download-access and /:id/download-access)
router.get('/:videoId/download-access', optionalAuth, downloadAccessLimiter, getVideoDownloadAccessHandler);
router.get('/:id/download-access', optionalAuth, downloadAccessLimiter, getVideoDownloadAccessHandler);

// 6.3. Video download streaming endpoint (supports both /:videoId/download and /:id/download)
router.get('/:videoId/download', authMiddleware, downloadLimiter, downloadVideoHandler);
router.get('/:id/download', authMiddleware, downloadLimiter, downloadVideoHandler);

// Rate limiter for comments (Phase 12)
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

// 7. Video Reactions (Phase 11) - placed before /:id single video route
router.get('/:videoId/reaction', authMiddleware, getVideoReaction);
router.post('/:videoId/reaction', authMiddleware, reactionLimiter, setVideoReaction);
router.delete('/:videoId/reaction', authMiddleware, reactionLimiter, removeVideoReaction);

// 8. Video Comments (Phase 12) - placed before /:id single video route
router.get('/:videoId/comments', optionalAuth, getVideoComments);
router.post('/:videoId/comments', authMiddleware, commentLimiter, createComment);

// 9. Single video endpoint (public or owner if private/processing)
router.get('/:id', optionalAuth, getVideoById);

// 6. Update video metadata & optional thumbnail
router.put('/:id', authMiddleware, uploadOptionalThumbnail, updateVideo);

// 7. Delete video
router.delete('/:id', authMiddleware, deleteVideo);

module.exports = router;

