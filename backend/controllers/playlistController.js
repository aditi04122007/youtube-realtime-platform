const playlistService = require('../services/playlistService');

/**
 * POST /api/playlists
 * Create a new playlist for the authenticated user.
 */
const createPlaylist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, description, visibility } = req.body || {};

    const playlist = await playlistService.createPlaylist(userId, {
      name,
      description,
      visibility,
    });

    return res.status(201).json({
      success: true,
      message: 'Playlist created successfully',
      playlist,
    });
  } catch (err) {
    if (err.code === 'PLAYLIST_LIMIT_REACHED') {
      return res.status(403).json({
        success: false,
        code: 'PLAYLIST_LIMIT_REACHED',
        message: err.message,
        limit: err.limit,
        used: err.used,
      });
    }
    next(err);
  }
};

/**
 * GET /api/playlists
 * Return playlists belonging to the authenticated user.
 */
const getUserPlaylists = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page, limit } = req.query;

    const result = await playlistService.getUserPlaylists(userId, { page, limit });

    return res.status(200).json({
      success: true,
      data: result.playlists,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/playlists/:id
 * Return single playlist details with ordered videos.
 * Public and unlisted playlists can be viewed by anyone; private only by owner/admin.
 */
const getPlaylistById = async (req, res, next) => {
  try {
    const playlistId = req.params.id;
    const viewer = req.user || null;

    const playlist = await playlistService.getPlaylistDetails(playlistId, viewer);

    return res.status(200).json({
      success: true,
      playlist,
    });
  } catch (err) {
    if (err.code === 'PRIVATE_PLAYLIST') {
      return res.status(403).json({
        success: false,
        code: 'PRIVATE_PLAYLIST',
        message: err.message,
      });
    }
    next(err);
  }
};

/**
 * PUT /api/playlists/:id
 * Update playlist metadata.
 */
const updatePlaylist = async (req, res, next) => {
  try {
    const playlistId = req.params.id;
    const userId = req.user.id;
    const { name, description, visibility } = req.body || {};

    const playlist = await playlistService.updatePlaylist(playlistId, userId, {
      name,
      description,
      visibility,
    });

    return res.status(200).json({
      success: true,
      message: 'Playlist updated successfully',
      playlist,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/playlists/:id
 * Delete playlist.
 */
const deletePlaylist = async (req, res, next) => {
  try {
    const playlistId = req.params.id;
    const userId = req.user.id;

    const result = await playlistService.deletePlaylist(playlistId, userId);

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/playlists/:id/videos
 * Add a video to a playlist.
 */
const addVideo = async (req, res, next) => {
  try {
    const playlistId = req.params.id;
    const userId = req.user.id;
    const { videoId } = req.body || {};

    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: 'videoId is required',
      });
    }

    const result = await playlistService.addVideoToPlaylist(playlistId, userId, videoId);

    return res.status(200).json({
      success: true,
      alreadyInPlaylist: result.alreadyInPlaylist,
      message: result.message,
      position: result.position,
      videoCount: result.videoCount,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/playlists/:id/videos/:videoId
 * Remove a video from a playlist.
 */
const removeVideo = async (req, res, next) => {
  try {
    const playlistId = req.params.id;
    const videoId = req.params.videoId;
    const userId = req.user.id;

    const result = await playlistService.removeVideoFromPlaylist(playlistId, userId, videoId);

    return res.status(200).json({
      success: true,
      message: result.message,
      videoCount: result.videoCount,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/playlists/:id/reorder
 * Reorder videos in playlist.
 */
const reorderVideos = async (req, res, next) => {
  try {
    const playlistId = req.params.id;
    const userId = req.user.id;
    const { videoIds } = req.body || {};

    const result = await playlistService.reorderPlaylist(playlistId, userId, videoIds);

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/playlists/check-video/:videoId
 * Check which of the user's playlists contain this video.
 */
const checkVideoInPlaylists = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const videoId = req.params.videoId;

    const playlists = await playlistService.getUserPlaylistsWithVideoStatus(userId, videoId);

    return res.status(200).json({
      success: true,
      playlists,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  addVideo,
  removeVideo,
  reorderVideos,
  checkVideoInPlaylists,
};
