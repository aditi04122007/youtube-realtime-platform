const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
const { optionalAuth } = require('../middleware/authMiddleware');
const playlistController = require('../controllers/playlistController');

// Rate limiter for playlist mutations (creation, updates, deletions, reorder)
const playlistMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many playlist modification requests. Please slow down and try again.',
  },
});

// 1. Create a new playlist (authenticated, rate-limited)
router.post('/', authMiddleware, playlistMutationLimiter, playlistController.createPlaylist);

// 2. Get playlists of authenticated user
router.get('/', authMiddleware, playlistController.getUserPlaylists);

// 3. Check which playlists contain a specific video
router.get('/check-video/:videoId', authMiddleware, playlistController.checkVideoInPlaylists);

// 4. Get single playlist details (supports guest viewing for PUBLIC/UNLISTED playlists)
router.get('/:id', optionalAuth, playlistController.getPlaylistById);

// 5. Update playlist details (owner only, rate-limited)
router.put('/:id', authMiddleware, playlistMutationLimiter, playlistController.updatePlaylist);

// 6. Delete playlist (owner only, rate-limited)
router.delete('/:id', authMiddleware, playlistMutationLimiter, playlistController.deletePlaylist);

// 7. Add video to playlist (owner only, rate-limited)
router.post('/:id/videos', authMiddleware, playlistMutationLimiter, playlistController.addVideo);

// 8. Remove video from playlist (owner only, rate-limited)
router.delete('/:id/videos/:videoId', authMiddleware, playlistMutationLimiter, playlistController.removeVideo);

// 9. Reorder videos in playlist (owner only, rate-limited)
router.put('/:id/reorder', authMiddleware, playlistMutationLimiter, playlistController.reorderVideos);

module.exports = router;
