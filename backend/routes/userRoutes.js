const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  uploadUserAvatar,
  uploadUserBanner,
} = require('../middleware/uploadMiddleware');
const {
  getPublicProfile,
  getCurrentUserProfile,
  updateProfile,
  uploadAvatar,
  uploadBanner,
} = require('../controllers/userController');

// 1. Protected current-user endpoints (must precede /:id)
router.get('/me', authMiddleware, getCurrentUserProfile);
router.put('/me', authMiddleware, updateProfile);
router.post('/me/avatar', authMiddleware, uploadUserAvatar, uploadAvatar);
router.post('/me/banner', authMiddleware, uploadUserBanner, uploadBanner);

// 2. Public profile endpoint
router.get('/:id', getPublicProfile);

module.exports = router;
