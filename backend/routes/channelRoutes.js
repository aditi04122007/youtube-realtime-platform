const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const optionalAuth = authMiddleware.optionalAuth || require('../middleware/authMiddleware').optionalAuth;
const {
  uploadChannelAvatar,
  uploadChannelBanner,
} = require('../middleware/uploadMiddleware');
const {
  createChannel,
  getCurrentUserChannel,
  getChannelById,
  getChannelByHandle,
  updateChannel,
  uploadChannelAvatar: handleUploadChannelAvatar,
  uploadChannelBanner: handleUploadChannelBanner,
  subscribeToChannel,
  unsubscribeFromChannel,
  getChannelSubscriptionStatus,
} = require('../controllers/channelController');

// 1. Protected current-user endpoints (must precede /:id)
router.post('/', authMiddleware, createChannel);
router.get('/me', authMiddleware, getCurrentUserChannel);
router.put('/me', authMiddleware, updateChannel);
router.post('/me/avatar', authMiddleware, uploadChannelAvatar, handleUploadChannelAvatar);
router.post('/me/banner', authMiddleware, uploadChannelBanner, handleUploadChannelBanner);

// 2. Channel Subscriptions (Phase 22)
router.post('/:id/subscribe', authMiddleware, subscribeToChannel);
router.delete('/:id/subscribe', authMiddleware, unsubscribeFromChannel);
router.get('/:id/subscription-status', optionalAuth, getChannelSubscriptionStatus);

// 3. Public lookup endpoints
router.get('/handle/:handle', getChannelByHandle);
router.get('/:id', getChannelById);

module.exports = router;
