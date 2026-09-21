const { pool } = require('../config/db');
const videoAccessService = require('./videoAccessService');

class WatchLaterService {
  /**
   * Add a video to user's Watch Later queue.
   * Prevents duplicates safely.
   */
  async addToWatchLater(userId, videoId) {
    const vid = parseInt(videoId, 10);
    if (isNaN(vid)) {
      const error = new Error('Invalid video ID');
      error.status = 400;
      throw error;
    }

    // Verify video exists
    const [vRows] = await pool.query(
      "SELECT id FROM videos WHERE id = ? AND status != 'DELETED' LIMIT 1",
      [vid]
    );
    if (vRows.length === 0) {
      const error = new Error('Video not found or is unavailable');
      error.status = 404;
      throw error;
    }

    // Check duplicate
    const [dup] = await pool.query(
      'SELECT id FROM watch_later WHERE user_id = ? AND video_id = ? LIMIT 1',
      [userId, vid]
    );

    if (dup.length > 0) {
      return {
        success: true,
        alreadyAdded: true,
        message: 'Video is already in Watch Later',
      };
    }

    await pool.query(
      'INSERT INTO watch_later (user_id, video_id, added_at) VALUES (?, ?, NOW())',
      [userId, vid]
    );

    return {
      success: true,
      alreadyAdded: false,
      message: 'Added to Watch Later',
    };
  }

  /**
   * Remove a video from user's Watch Later queue.
   */
  async removeFromWatchLater(userId, videoId) {
    const vid = parseInt(videoId, 10);
    if (isNaN(vid)) {
      const error = new Error('Invalid video ID');
      error.status = 400;
      throw error;
    }

    await pool.query('DELETE FROM watch_later WHERE user_id = ? AND video_id = ?', [
      userId,
      vid,
    ]);

    return {
      success: true,
      message: 'Removed from Watch Later',
    };
  }

  /**
   * Get paginated Watch Later videos for user (newest added first).
   * Includes channel info and Phase 10 watch progress.
   */
  async getWatchLater(userId, { page = 1, limit = 20 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM watch_later wl
       JOIN videos v ON wl.video_id = v.id
       WHERE wl.user_id = ? AND v.status != 'DELETED'`,
      [userId]
    );
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limitNum) || 1;

    const [rows] = await pool.query(
      `SELECT 
         wl.id AS watchLaterId,
         wl.added_at AS addedAt,
         v.id AS videoId,
         v.title,
         v.description,
         v.thumbnail_url AS thumbnailUrl,
         v.duration_seconds AS durationSeconds,
         v.view_count AS viewCount,
         v.visibility,
         c.id AS channelId,
         c.channel_name AS channelName,
         c.handle AS channelHandle,
         c.avatar_url AS channelAvatarUrl,
         wh.progress_seconds AS progressSeconds,
         wh.completed AS watchCompleted
       FROM watch_later wl
       JOIN videos v ON wl.video_id = v.id
       LEFT JOIN channels c ON v.channel_id = c.id
       LEFT JOIN watch_history wh ON wh.video_id = v.id AND wh.user_id = ?
       WHERE wl.user_id = ? AND v.status != 'DELETED'
       ORDER BY wl.added_at DESC, wl.id DESC
       LIMIT ? OFFSET ?`,
      [userId, userId, limitNum, offset]
    );

    // Format items with watch progress and access metadata
    const userPayload = { id: userId };
    const videos = [];

    for (const r of rows) {
      let accessDetails = { canWatch: true, isPremium: false };
      try {
        accessDetails = await videoAccessService.getVideoAccessDetails(r.videoId, userPayload);
      } catch (err) {
        accessDetails = { canWatch: false, isPremium: false };
      }

      const dur = Number(r.durationSeconds || 0);
      const prog = Number(r.progressSeconds || 0);
      const progressPercent = dur > 0 ? Math.min(100, Math.round((prog / dur) * 100)) : 0;

      videos.push({
        id: r.videoId,
        watchLaterId: r.watchLaterId,
        title: r.title,
        description: r.description,
        thumbnailUrl: r.thumbnailUrl,
        durationSeconds: dur,
        viewCount: Number(r.viewCount || 0),
        addedAt: r.addedAt,
        channel: r.channelId
          ? {
              id: r.channelId,
              name: r.channelName,
              handle: r.channelHandle,
              avatarUrl: r.channelAvatarUrl,
            }
          : null,
        watchProgress: {
          progressSeconds: prog,
          progressPercent,
          completed: Boolean(r.watchCompleted),
        },
        access: {
          canWatch: Boolean(accessDetails.canWatch),
          isPremium: Boolean(accessDetails.isPremium),
          minimumPlanCode: accessDetails.minimumPlanCode || null,
          requiresSubscription: Boolean(accessDetails.requiresSubscription),
        },
      });
    }

    return {
      videos,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    };
  }

  /**
   * Check if a video is in user's Watch Later queue.
   */
  async checkWatchLater(userId, videoId) {
    const vid = parseInt(videoId, 10);
    if (isNaN(vid)) {
      return { inWatchLater: false };
    }

    const [rows] = await pool.query(
      'SELECT 1 FROM watch_later WHERE user_id = ? AND video_id = ? LIMIT 1',
      [userId, vid]
    );

    return { inWatchLater: rows.length > 0 };
  }
}

module.exports = new WatchLaterService();
