const { pool } = require('../config/db');

/**
 * Helper to calculate percentage safely
 */
const calculatePercentage = (progress, duration) => {
  const p = Number(progress) || 0;
  const d = Number(duration) || 0;
  if (d <= 0) return 0;
  return Math.min(100, Math.max(0, Number(((p / d) * 100).toFixed(2))));
};

/**
 * Format raw watch history row with video and channel metadata
 */
const formatWatchHistoryItem = (row) => {
  const duration = Number(row.videoDurationSeconds || row.durationSeconds) || 0;
  const progress = Number(row.progressSeconds) || 0;
  const percentage = calculatePercentage(progress, duration);

  return {
    historyId: row.historyId,
    videoId: row.videoId,
    title: row.title,
    thumbnailUrl: row.thumbnailUrl || null,
    durationSeconds: duration,
    progressSeconds: progress,
    progressPercentage: percentage,
    completed: Boolean(row.completed),
    lastWatchedAt: row.lastWatchedAt,
    viewCount: Number(row.viewCount) || 0,
    channel: {
      id: row.channelId,
      channelName: row.channelName,
      handle: row.channelHandle,
      avatarUrl: row.channelAvatarUrl || null,
    },
  };
};

/**
 * GET /api/watch-history
 * Get authenticated user's paginated watch history (newest first)
 */
const getWatchHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role || 'USER';

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    // Total count query
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM watch_history wh
       INNER JOIN videos v ON wh.video_id = v.id
       WHERE wh.user_id = ?
         AND v.status != 'DELETED'
         AND (v.visibility != 'PRIVATE' OR v.user_id = ? OR ? = 'ADMIN')`,
      [userId, userId, userRole]
    );
    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Data query
    const [rows] = await pool.query(
      `SELECT 
         wh.id AS historyId,
         wh.video_id AS videoId,
         wh.progress_seconds AS progressSeconds,
         wh.duration_seconds AS durationSeconds,
         wh.completed,
         wh.last_watched_at AS lastWatchedAt,
         v.title,
         v.thumbnail_url AS thumbnailUrl,
         v.duration_seconds AS videoDurationSeconds,
         v.view_count AS viewCount,
         c.id AS channelId,
         c.channel_name AS channelName,
         c.handle AS channelHandle,
         c.avatar_url AS channelAvatarUrl
       FROM watch_history wh
       INNER JOIN videos v ON wh.video_id = v.id
       INNER JOIN channels c ON v.channel_id = c.id
       WHERE wh.user_id = ?
         AND v.status != 'DELETED'
         AND (v.visibility != 'PRIVATE' OR v.user_id = ? OR ? = 'ADMIN')
       ORDER BY wh.last_watched_at DESC, wh.updated_at DESC, wh.id DESC
       LIMIT ? OFFSET ?`,
      [userId, userId, userRole, limit, offset]
    );

    const items = rows.map(formatWatchHistoryItem);

    return res.status(200).json({
      success: true,
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/watch-history/continue-watching
 * Get up to 10 incomplete videos for authenticated user (progress > 0 and completed = false)
 */
const getContinueWatching = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role || 'USER';

    const [rows] = await pool.query(
      `SELECT 
         wh.id AS historyId,
         wh.video_id AS videoId,
         wh.progress_seconds AS progressSeconds,
         wh.duration_seconds AS durationSeconds,
         wh.completed,
         wh.last_watched_at AS lastWatchedAt,
         v.title,
         v.thumbnail_url AS thumbnailUrl,
         v.duration_seconds AS videoDurationSeconds,
         v.view_count AS viewCount,
         c.id AS channelId,
         c.channel_name AS channelName,
         c.handle AS channelHandle,
         c.avatar_url AS channelAvatarUrl
       FROM watch_history wh
       INNER JOIN videos v ON wh.video_id = v.id
       INNER JOIN channels c ON v.channel_id = c.id
       WHERE wh.user_id = ?
         AND wh.completed = FALSE
         AND wh.progress_seconds > 0
         AND v.status != 'DELETED'
         AND (v.visibility != 'PRIVATE' OR v.user_id = ? OR ? = 'ADMIN')
        ORDER BY wh.last_watched_at DESC, wh.updated_at DESC, wh.id DESC
        LIMIT 10`,
      [userId, userId, userRole]
    );

    const items = rows.map(formatWatchHistoryItem);

    return res.status(200).json({
      success: true,
      items,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/watch-history/:videoId
 * Get current user's watch history / resume point for a single video
 * Returns 200 with zero progress if video has not been watched yet
 */
const getVideoWatchHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const videoId = parseInt(req.params.videoId, 10);

    if (isNaN(videoId) || videoId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid video ID',
      });
    }

    const [rows] = await pool.query(
      `SELECT progress_seconds, duration_seconds, completed, last_watched_at
       FROM watch_history
       WHERE user_id = ? AND video_id = ?
       LIMIT 1`,
      [userId, videoId]
    );

    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        videoId,
        progressSeconds: 0,
        durationSeconds: 0,
        progressPercentage: 0,
        completed: false,
        lastWatchedAt: null,
      });
    }

    const row = rows[0];
    const progressSeconds = Number(row.progress_seconds) || 0;
    const durationSeconds = Number(row.duration_seconds) || 0;
    const progressPercentage = calculatePercentage(progressSeconds, durationSeconds);

    return res.status(200).json({
      success: true,
      videoId,
      progressSeconds,
      durationSeconds,
      progressPercentage,
      completed: Boolean(row.completed),
      lastWatchedAt: row.last_watched_at,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/watch-history
 * Save or update video watch progress (UPSERT)
 * Body: { videoId, progressSeconds, durationSeconds, completed }
 */
const saveWatchProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role || 'USER';

    const videoId = parseInt(req.body.videoId, 10);
    if (isNaN(videoId) || videoId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid video ID',
      });
    }

    const rawProgress = Number(req.body.progressSeconds);
    const rawDuration = Number(req.body.durationSeconds);

    if (isNaN(rawProgress) || !isFinite(rawProgress) || rawProgress < 0) {
      return res.status(400).json({
        success: false,
        message: 'progressSeconds must be a non-negative number',
      });
    }

    if (isNaN(rawDuration) || !isFinite(rawDuration) || rawDuration < 0) {
      return res.status(400).json({
        success: false,
        message: 'durationSeconds must be a non-negative number',
      });
    }

    // Progress should not exceed duration by more than a 5s buffer (prevent nonsensical data)
    if (rawDuration > 0 && rawProgress > rawDuration + 5) {
      return res.status(400).json({
        success: false,
        message: 'progressSeconds cannot exceed durationSeconds',
      });
    }

    // Verify video exists and is accessible
    const [videoRows] = await pool.query(
      `SELECT id, user_id, duration_seconds, visibility, status
       FROM videos
       WHERE id = ? AND status != 'DELETED'
       LIMIT 1`,
      [videoId]
    );

    if (videoRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Video not found',
      });
    }

    const video = videoRows[0];
    const isOwner = userId === video.user_id || userRole === 'ADMIN';

    if (video.visibility === 'PRIVATE' && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'This video is private',
      });
    }

    if (video.status === 'PROCESSING' && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'This video is currently processing',
      });
    }

    // Effective duration
    let effectiveDuration = Math.floor(rawDuration);
    if (effectiveDuration === 0 && video.duration_seconds > 0) {
      effectiveDuration = video.duration_seconds;
    }

    let safeProgress = Math.floor(rawProgress);
    if (effectiveDuration > 0 && safeProgress > effectiveDuration) {
      safeProgress = effectiveDuration;
    }

    // Determine completion status
    let isCompleted = false;
    if (req.body.completed === true) {
      isCompleted = true;
    } else if (effectiveDuration > 0 && safeProgress >= Math.floor(effectiveDuration * 0.90)) {
      isCompleted = true;
    } else if (req.body.completed === false || safeProgress < 10) {
      isCompleted = false;
    }

    // If marked completed, normalize progress to full duration
    const finalProgress = isCompleted && effectiveDuration > 0 ? effectiveDuration : safeProgress;

    // UPSERT into watch_history
    await pool.query(
      `INSERT INTO watch_history (
         user_id, video_id, progress_seconds, duration_seconds, completed, last_watched_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, NOW(), NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         progress_seconds = VALUES(progress_seconds),
         duration_seconds = VALUES(duration_seconds),
         completed = VALUES(completed),
         last_watched_at = NOW(),
         updated_at = NOW()`,
      [userId, videoId, finalProgress, effectiveDuration, isCompleted ? 1 : 0]
    );

    const progressPercentage = calculatePercentage(finalProgress, effectiveDuration);

    return res.status(200).json({
      success: true,
      message: 'Watch progress saved successfully',
      data: {
        videoId,
        progressSeconds: finalProgress,
        durationSeconds: effectiveDuration,
        progressPercentage,
        completed: isCompleted,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/watch-history/:videoId
 * Remove a single video from current user's watch history
 */
const deleteWatchHistoryItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const videoId = parseInt(req.params.videoId, 10);

    if (isNaN(videoId) || videoId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid video ID',
      });
    }

    const [result] = await pool.query(
      `DELETE FROM watch_history
       WHERE user_id = ? AND video_id = ?`,
      [userId, videoId]
    );

    return res.status(200).json({
      success: true,
      message: 'Video removed from watch history',
      deleted: result.affectedRows > 0,
      videoId,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/watch-history
 * Clear all watch history for current user
 */
const clearWatchHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [result] = await pool.query(
      `DELETE FROM watch_history
       WHERE user_id = ?`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Watch history cleared successfully',
      affectedRows: result.affectedRows,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getWatchHistory,
  getContinueWatching,
  getVideoWatchHistory,
  saveWatchProgress,
  deleteWatchHistoryItem,
  clearWatchHistory,
};
