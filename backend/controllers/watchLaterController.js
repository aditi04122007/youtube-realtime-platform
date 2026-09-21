const watchLaterService = require('../services/watchLaterService');

/**
 * POST /api/watch-later/:videoId
 * Add video to user's Watch Later queue.
 */
const addToWatchLater = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const videoId = req.params.videoId;

    const result = await watchLaterService.addToWatchLater(userId, videoId);

    const statusCode = result.alreadyAdded ? 200 : 201;
    return res.status(statusCode).json({
      success: true,
      alreadyAdded: result.alreadyAdded,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/watch-later/:videoId
 * Remove video from user's Watch Later queue.
 */
const removeFromWatchLater = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const videoId = req.params.videoId;

    const result = await watchLaterService.removeFromWatchLater(userId, videoId);

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/watch-later
 * Get paginated list of user's Watch Later videos.
 */
const getWatchLater = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page, limit } = req.query;

    const result = await watchLaterService.getWatchLater(userId, { page, limit });

    return res.status(200).json({
      success: true,
      data: result.videos,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/watch-later/check/:videoId
 * Check if video is in user's Watch Later queue.
 */
const checkWatchLater = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const videoId = req.params.videoId;

    const result = await watchLaterService.checkWatchLater(userId, videoId);

    return res.status(200).json({
      success: true,
      inWatchLater: result.inWatchLater,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  addToWatchLater,
  removeFromWatchLater,
  getWatchLater,
  checkWatchLater,
};
