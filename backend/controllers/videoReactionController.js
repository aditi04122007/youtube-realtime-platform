const { pool } = require('../config/db');
const notificationService = require('../services/notificationService');

/**
 * Validate video access permissions (matches Phase 9 rules)
 */
const checkVideoAccess = async (videoId, user) => {
  const [rows] = await pool.query(
    `SELECT id, user_id, title, visibility, status, like_count, dislike_count
     FROM videos
     WHERE id = ? AND status != 'DELETED'
     LIMIT 1`,
    [videoId]
  );

  if (rows.length === 0) {
    const error = new Error('Video not found');
    error.status = 404;
    throw error;
  }

  const video = rows[0];
  const isOwner = user && (user.id === video.user_id || user.role === 'ADMIN');

  if (video.visibility === 'PRIVATE' && !isOwner) {
    const error = new Error('This video is private');
    error.status = 403;
    throw error;
  }

  if (video.status === 'PROCESSING' && !isOwner) {
    const error = new Error('This video is currently processing');
    error.status = 403;
    throw error;
  }

  return video;
};

/**
 * GET /api/videos/:videoId/reaction
 * Get current authenticated user's reaction on a video and current counts
 */
const getVideoReaction = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const videoId = parseInt(req.params.videoId, 10);

    if (isNaN(videoId) || videoId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid video ID',
      });
    }

    // Verify video exists and is accessible
    const video = await checkVideoAccess(videoId, req.user);

    // Fetch user's reaction
    const [reactionRows] = await pool.query(
      `SELECT reaction_type 
       FROM video_reactions 
       WHERE user_id = ? AND video_id = ? 
       LIMIT 1`,
      [userId, videoId]
    );

    const userReaction = reactionRows.length > 0 ? reactionRows[0].reaction_type : null;

    return res.status(200).json({
      success: true,
      videoId,
      reaction: userReaction,
      likeCount: Number(video.like_count) || 0,
      dislikeCount: Number(video.dislike_count) || 0,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};

/**
 * POST /api/videos/:videoId/reaction
 * Set or toggle video reaction (LIKE / DISLIKE) with transactional count synchronization
 * Body: { reaction: 'LIKE' | 'DISLIKE' }
 */
const setVideoReaction = async (req, res, next) => {
  let connection = null;
  try {
    const userId = req.user.id;
    const videoId = parseInt(req.params.videoId, 10);

    if (isNaN(videoId) || videoId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid video ID',
      });
    }

    const { reaction } = req.body;
    if (reaction !== 'LIKE' && reaction !== 'DISLIKE') {
      return res.status(400).json({
        success: false,
        message: "Reaction must be either 'LIKE' or 'DISLIKE'",
      });
    }

    // Verify video exists and is accessible
    const video = await checkVideoAccess(videoId, req.user);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Lock existing reaction row for atomic state transition
    const [existing] = await connection.query(
      `SELECT id, reaction_type 
       FROM video_reactions 
       WHERE user_id = ? AND video_id = ? 
       FOR UPDATE`,
      [userId, videoId]
    );

    let resultReaction = null;

    if (existing.length > 0) {
      const currentReaction = existing[0].reaction_type;

      if (currentReaction === reaction) {
        // Path A: Clicked same reaction -> Toggle OFF
        await connection.query(
          `DELETE FROM video_reactions 
           WHERE user_id = ? AND video_id = ?`,
          [userId, videoId]
        );

        if (currentReaction === 'LIKE') {
          await connection.query(
            `UPDATE videos 
             SET like_count = GREATEST(like_count - 1, 0) 
             WHERE id = ?`,
            [videoId]
          );
        } else {
          await connection.query(
            `UPDATE videos 
             SET dislike_count = GREATEST(dislike_count - 1, 0) 
             WHERE id = ?`,
            [videoId]
          );
        }
        resultReaction = null;
      } else {
        // Path B: Clicked opposite reaction -> Switch reaction (e.g. LIKE -> DISLIKE or DISLIKE -> LIKE)
        await connection.query(
          `UPDATE video_reactions 
           SET reaction_type = ?, updated_at = NOW() 
           WHERE user_id = ? AND video_id = ?`,
          [reaction, userId, videoId]
        );

        if (reaction === 'LIKE') {
          // Changed from DISLIKE to LIKE
          await connection.query(
            `UPDATE videos 
             SET like_count = like_count + 1, 
                 dislike_count = GREATEST(dislike_count - 1, 0) 
             WHERE id = ?`,
            [videoId]
          );
        } else {
          // Changed from LIKE to DISLIKE
          await connection.query(
            `UPDATE videos 
             SET dislike_count = dislike_count + 1, 
                 like_count = GREATEST(like_count - 1, 0) 
             WHERE id = ?`,
            [videoId]
          );
        }
        resultReaction = reaction;
      }
    } else {
      // Path C: No prior reaction -> Create new reaction
      await connection.query(
        `INSERT INTO video_reactions (user_id, video_id, reaction_type, created_at, updated_at) 
         VALUES (?, ?, ?, NOW(), NOW())`,
        [userId, videoId, reaction]
      );

      if (reaction === 'LIKE') {
        await connection.query(
          `UPDATE videos 
           SET like_count = like_count + 1 
           WHERE id = ?`,
          [videoId]
        );
      } else {
        await connection.query(
          `UPDATE videos 
           SET dislike_count = dislike_count + 1 
           WHERE id = ?`,
          [videoId]
        );
      }
      resultReaction = reaction;
    }

    // Fetch updated synchronized counts
    const [vRows] = await connection.query(
      `SELECT like_count, dislike_count 
       FROM videos 
       WHERE id = ?`,
      [videoId]
    );

    await connection.commit();

    // Send VIDEO_LIKED notification to video owner (with deduplication in notificationService)
    if (resultReaction === 'LIKE' && video.user_id && Number(video.user_id) !== Number(userId)) {
      pool.query(
        `SELECT u.username, up.display_name, COALESCE(ch.avatar_url, up.avatar_url) AS avatar_url
         FROM users u
         LEFT JOIN user_profiles up ON u.id = up.user_id
         LEFT JOIN channels ch ON u.id = ch.user_id
         WHERE u.id = ? LIMIT 1`,
        [userId]
      ).then(([likers]) => {
        const liker = likers[0] || {};
        const likerName = liker.display_name || liker.username || 'Someone';
        notificationService.createNotification({
          userId: video.user_id,
          actorUserId: userId,
          type: notificationService.NOTIFICATION_TYPES.VIDEO_LIKED,
          title: 'Video Liked',
          message: `${likerName} liked your video "${video.title || 'video'}"`,
          entityType: 'video',
          entityId: videoId,
          videoId,
          dataJson: {
            video_id: videoId,
            video_title: video.title || null,
            actor_username: liker.username,
            actor_display_name: liker.display_name,
            actor_avatar_url: liker.avatar_url,
          },
        }).catch((e) => console.error('[Notification] Failed to send video like notification:', e.message));
      }).catch((e) => console.error('[Notification] Failed to query liker user:', e.message));
    }

    return res.status(200).json({
      success: true,
      videoId,
      reaction: resultReaction,
      likeCount: Number(vRows[0]?.like_count) || 0,
      dislikeCount: Number(vRows[0]?.dislike_count) || 0,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * DELETE /api/videos/:videoId/reaction
 * Remove user's reaction on a video (safe & idempotent)
 */
const removeVideoReaction = async (req, res, next) => {
  let connection = null;
  try {
    const userId = req.user.id;
    const videoId = parseInt(req.params.videoId, 10);

    if (isNaN(videoId) || videoId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid video ID',
      });
    }

    // Verify video exists and is accessible
    await checkVideoAccess(videoId, req.user);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existing] = await connection.query(
      `SELECT id, reaction_type 
       FROM video_reactions 
       WHERE user_id = ? AND video_id = ? 
       FOR UPDATE`,
      [userId, videoId]
    );

    if (existing.length > 0) {
      const currentReaction = existing[0].reaction_type;

      await connection.query(
        `DELETE FROM video_reactions 
         WHERE user_id = ? AND video_id = ?`,
        [userId, videoId]
      );

      if (currentReaction === 'LIKE') {
        await connection.query(
          `UPDATE videos 
           SET like_count = GREATEST(like_count - 1, 0) 
           WHERE id = ?`,
          [videoId]
        );
      } else {
        await connection.query(
          `UPDATE videos 
           SET dislike_count = GREATEST(dislike_count - 1, 0) 
           WHERE id = ?`,
          [videoId]
        );
      }
    }

    const [vRows] = await connection.query(
      `SELECT like_count, dislike_count 
       FROM videos 
       WHERE id = ?`,
      [videoId]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      videoId,
      reaction: null,
      likeCount: Number(vRows[0]?.like_count) || 0,
      dislikeCount: Number(vRows[0]?.dislike_count) || 0,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  getVideoReaction,
  setVideoReaction,
  removeVideoReaction,
};
