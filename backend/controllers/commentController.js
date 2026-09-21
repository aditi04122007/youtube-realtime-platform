const { pool } = require('../config/db');
const notificationService = require('../services/notificationService');
const { sanitizeText } = require('../utils/sanitizer');

/**
 * Validate video access permissions (matching Phase 9 and Phase 11 rules)
 */
const checkVideoAccess = async (videoId, user) => {
  const [rows] = await pool.query(
    `SELECT id, user_id, title, visibility, status
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
 * Format a comment row with safe user author details
 */
const formatComment = (c, requestingUser = null) => {
  const isDeleted = c.status === 'DELETED';
  const isRemoved = c.status === 'REMOVED';
  const isHidden = c.status === 'HIDDEN';

  const isOwner = requestingUser && Number(requestingUser.id) === Number(c.userId);
  const isAdmin = requestingUser && requestingUser.role === 'ADMIN';

  let displayContent = c.content;
  if (isDeleted) {
    displayContent = '[deleted]';
  } else if (isRemoved) {
    displayContent = 'This comment has been removed by a moderator.';
  } else if (isHidden) {
    displayContent = (isOwner || isAdmin) ? c.content : 'This comment is currently unavailable.';
  }

  const hideAuthor = isDeleted || isRemoved;

  return {
    id: c.id,
    videoId: c.videoId,
    userId: hideAuthor ? null : c.userId,
    parentId: c.parentId || null,
    content: displayContent,
    status: c.status,
    likeCount: Number(c.likeCount) || 0,
    likedByCurrentUser: Boolean(c.likedByCurrentUser),
    replyCount: Number(c.replyCount) || 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    user: {
      id: hideAuthor ? null : c.userId,
      username: isDeleted ? '[deleted]' : (isRemoved ? '[removed]' : c.username),
      displayName: isDeleted ? '[deleted]' : (isRemoved ? '[removed]' : (c.displayName || c.username)),
      avatarUrl: hideAuthor ? null : (c.avatarUrl || null),
      channelHandle: hideAuthor ? null : (c.channelHandle || null),
    },
  };
};

/**
 * Allowed sort keys and SQL orderings
 */
const ALLOWED_SORTS = {
  top: 'c.like_count DESC, c.created_at DESC, c.id DESC',
  newest: 'c.created_at DESC, c.id DESC',
  oldest: 'c.created_at ASC, c.id ASC',
};

/**
 * GET /api/videos/:videoId/comments
 * List top-level comments for a video with pagination and sorting
 */
const getVideoComments = async (req, res, next) => {
  try {
    const videoId = parseInt(req.params.videoId, 10);
    if (isNaN(videoId) || videoId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid video ID' });
    }

    // Check video access
    await checkVideoAccess(videoId, req.user);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const sortParam = (req.query.sort || 'top').toLowerCase();
    const sortClause = ALLOWED_SORTS[sortParam] || ALLOWED_SORTS.top;

    const currentUserId = req.user?.id || 0;
    const currentUserRole = req.user?.role || '';

    // Total top-level comments count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM comments c
       WHERE c.video_id = ? 
         AND c.parent_comment_id IS NULL 
         AND (
           c.status = 'VISIBLE'
           OR (c.status = 'DELETED' AND c.reply_count > 0)
           OR (c.status = 'REMOVED' AND c.reply_count > 0)
           OR (c.status = 'HIDDEN' AND (c.reply_count > 0 OR c.user_id = ? OR ? = 'ADMIN'))
           OR (? = 'ADMIN')
         )`,
      [videoId, currentUserId, currentUserRole, currentUserRole]
    );
    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Fetch comments with author profile and current user's like state in a single query
    const queryParams = [];
    if (req.user?.id) queryParams.push(req.user.id);
    queryParams.push(videoId, currentUserId, currentUserRole, currentUserRole, limit, offset);

    const sql = `
      SELECT 
        c.id,
        c.video_id AS videoId,
        c.user_id AS userId,
        c.parent_comment_id AS parentId,
        c.content,
        c.status,
        c.like_count AS likeCount,
        c.reply_count AS replyCount,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt,
        u.username,
        up.display_name AS displayName,
        COALESCE(ch.avatar_url, up.avatar_url) AS avatarUrl,
        ch.handle AS channelHandle,
        ${req.user?.id ? 'CASE WHEN cl.id IS NOT NULL THEN TRUE ELSE FALSE END' : 'FALSE'} AS likedByCurrentUser
      FROM comments c
      INNER JOIN users u ON c.user_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN channels ch ON u.id = ch.user_id
      ${req.user?.id ? 'LEFT JOIN comment_likes cl ON c.id = cl.comment_id AND cl.user_id = ?' : ''}
      WHERE c.video_id = ? 
        AND c.parent_comment_id IS NULL 
        AND (
          c.status = 'VISIBLE'
          OR (c.status = 'DELETED' AND c.reply_count > 0)
          OR (c.status = 'REMOVED' AND c.reply_count > 0)
          OR (c.status = 'HIDDEN' AND (c.reply_count > 0 OR c.user_id = ? OR ? = 'ADMIN'))
          OR (? = 'ADMIN')
        )
      ORDER BY ${sortClause}
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(sql, queryParams);
    const comments = rows.map((r) => formatComment(r, req.user));

    return res.status(200).json({
      success: true,
      comments,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * POST /api/videos/:videoId/comments
 * Create a new top-level comment or reply
 */
const createComment = async (req, res, next) => {
  let connection = null;
  try {
    const videoId = parseInt(req.params.videoId, 10);
    if (isNaN(videoId) || videoId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid video ID' });
    }

    const userId = req.user.id;
    const { content, parentId } = req.body;

    // Validate content
    if (typeof content !== 'string') {
      return res.status(400).json({ success: false, message: 'Comment content must be text' });
    }
    const trimmed = content.trim();
    const sanitized = sanitizeText(trimmed, 5000);
    if (sanitized.length === 0) {
      return res.status(400).json({ success: false, message: 'Comment cannot be empty' });
    }
    if (trimmed.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Comment exceeds maximum allowed length of 5000 characters',
      });
    }

    // Verify video access
    const video = await checkVideoAccess(videoId, req.user);

    let parsedParentId = null;
    if (parentId !== undefined && parentId !== null && parentId !== '') {
      parsedParentId = parseInt(parentId, 10);
      if (isNaN(parsedParentId) || parsedParentId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid parent comment ID' });
      }
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    if (parsedParentId) {
      // Validate parent comment
      const [parentRows] = await connection.query(
        `SELECT id, user_id, video_id, status 
         FROM comments 
         WHERE id = ? 
         FOR UPDATE`,
        [parsedParentId]
      );

      if (parentRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Parent comment not found' });
      }

      const parent = parentRows[0];
      if (Number(parent.video_id) !== videoId) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Parent comment does not belong to this video',
        });
      }

      if (parent.status === 'HIDDEN' || parent.status === 'REMOVED' || parent.status === 'DELETED') {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Cannot reply to this comment',
        });
      }

      // Insert reply
      const [insertResult] = await connection.query(
        `INSERT INTO comments (video_id, user_id, parent_comment_id, content, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'VISIBLE', NOW(), NOW())`,
        [videoId, userId, parsedParentId, sanitized]
      );
      const newCommentId = insertResult.insertId;

      // Increment parent's reply count
      await connection.query(
        `UPDATE comments 
         SET reply_count = reply_count + 1 
         WHERE id = ?`,
        [parsedParentId]
      );

      await connection.commit();

      // Fetch created reply with user details
      const [newRows] = await pool.query(
        `SELECT 
           c.id,
           c.video_id AS videoId,
           c.user_id AS userId,
           c.parent_comment_id AS parentId,
           c.content,
           c.status,
           c.like_count AS likeCount,
           c.reply_count AS replyCount,
           c.created_at AS createdAt,
           c.updated_at AS updatedAt,
           u.username,
           up.display_name AS displayName,
           COALESCE(ch.avatar_url, up.avatar_url) AS avatarUrl,
           ch.handle AS channelHandle,
           FALSE AS likedByCurrentUser
         FROM comments c
         INNER JOIN users u ON c.user_id = u.id
         LEFT JOIN user_profiles up ON u.id = up.user_id
         LEFT JOIN channels ch ON u.id = ch.user_id
         WHERE c.id = ?`,
        [newCommentId]
      );

      // Send REPLY_TO_COMMENT notification to parent comment author
      if (parent.user_id && Number(parent.user_id) !== Number(userId)) {
        const actorName = newRows[0]?.displayName || newRows[0]?.username || 'Someone';
        notificationService.createNotification({
          userId: parent.user_id,
          actorUserId: userId,
          type: notificationService.NOTIFICATION_TYPES.REPLY_TO_COMMENT,
          title: 'New Reply',
          message: `${actorName} replied to your comment: "${sanitized.substring(0, 60)}${sanitized.length > 60 ? '...' : ''}"`,
          entityType: 'comment',
          entityId: newCommentId,
          videoId,
          commentId: newCommentId,
          dataJson: {
            video_id: videoId,
            parent_comment_id: parsedParentId,
            comment_id: newCommentId,
            actor_username: newRows[0]?.username,
            actor_display_name: newRows[0]?.displayName,
            actor_avatar_url: newRows[0]?.avatarUrl,
          },
        }).catch((e) => console.error('[Notification] Failed to send reply notification:', e.message));
      }

      return res.status(201).json({
        success: true,
        message: 'Reply posted successfully',
        comment: formatComment(newRows[0]),
      });
    } else {
      // Top-level comment
      const [insertResult] = await connection.query(
        `INSERT INTO comments (video_id, user_id, parent_comment_id, content, status, created_at, updated_at)
         VALUES (?, ?, NULL, ?, 'VISIBLE', NOW(), NOW())`,
        [videoId, userId, sanitized]
      );
      const newCommentId = insertResult.insertId;

      // Increment video's comment count
      await connection.query(
        `UPDATE videos 
         SET comment_count = comment_count + 1 
         WHERE id = ?`,
        [videoId]
      );

      await connection.commit();

      // Fetch created comment with user details
      const [newRows] = await pool.query(
        `SELECT 
           c.id,
           c.video_id AS videoId,
           c.user_id AS userId,
           c.parent_comment_id AS parentId,
           c.content,
           c.status,
           c.like_count AS likeCount,
           c.reply_count AS replyCount,
           c.created_at AS createdAt,
           c.updated_at AS updatedAt,
           u.username,
           up.display_name AS displayName,
           COALESCE(ch.avatar_url, up.avatar_url) AS avatarUrl,
           ch.handle AS channelHandle,
           FALSE AS likedByCurrentUser
         FROM comments c
         INNER JOIN users u ON c.user_id = u.id
         LEFT JOIN user_profiles up ON u.id = up.user_id
         LEFT JOIN channels ch ON u.id = ch.user_id
         WHERE c.id = ?`,
        [newCommentId]
      );

      // Send COMMENT_ON_VIDEO notification to video owner
      if (video.user_id && Number(video.user_id) !== Number(userId)) {
        const actorName = newRows[0]?.displayName || newRows[0]?.username || 'Someone';
        notificationService.createNotification({
          userId: video.user_id,
          actorUserId: userId,
          type: notificationService.NOTIFICATION_TYPES.COMMENT_ON_VIDEO,
          title: 'New Comment',
          message: `${actorName} commented on your video "${video.title || 'video'}": "${sanitized.substring(0, 60)}${sanitized.length > 60 ? '...' : ''}"`,
          entityType: 'comment',
          entityId: newCommentId,
          videoId,
          commentId: newCommentId,
          dataJson: {
            video_id: videoId,
            comment_id: newCommentId,
            video_title: video.title || null,
            actor_username: newRows[0]?.username,
            actor_display_name: newRows[0]?.displayName,
            actor_avatar_url: newRows[0]?.avatarUrl,
          },
        }).catch((e) => console.error('[Notification] Failed to send comment notification:', e.message));
      }

      return res.status(201).json({
        success: true,
        message: 'Comment posted successfully',
        comment: formatComment(newRows[0]),
      });
    }
  } catch (err) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * GET /api/comments/:commentId/replies
 * Get paginated replies for a specific comment
 */
const getCommentReplies = async (req, res, next) => {
  try {
    const commentId = parseInt(req.params.commentId, 10);
    if (isNaN(commentId) || commentId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID' });
    }

    // Verify parent comment exists and get its videoId
    const [parentRows] = await pool.query(
      `SELECT id, video_id, status FROM comments WHERE id = ? LIMIT 1`,
      [commentId]
    );

    if (parentRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    // Check video access for the video this comment belongs to
    await checkVideoAccess(parentRows[0].video_id, req.user);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const currentUserId = req.user?.id || 0;
    const currentUserRole = req.user?.role || '';

    // Total replies count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM comments c
       WHERE c.parent_comment_id = ? 
         AND (
           c.status = 'VISIBLE'
           OR (c.status = 'DELETED' AND c.reply_count > 0)
           OR (c.status = 'REMOVED' AND c.reply_count > 0)
           OR (c.status = 'HIDDEN' AND (c.reply_count > 0 OR c.user_id = ? OR ? = 'ADMIN'))
           OR (? = 'ADMIN')
         )`,
      [commentId, currentUserId, currentUserRole, currentUserRole]
    );
    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const queryParams = [];
    if (req.user?.id) queryParams.push(req.user.id);
    queryParams.push(commentId, currentUserId, currentUserRole, currentUserRole, limit, offset);

    const sql = `
      SELECT 
        c.id,
        c.video_id AS videoId,
        c.user_id AS userId,
        c.parent_comment_id AS parentId,
        c.content,
        c.status,
        c.like_count AS likeCount,
        c.reply_count AS replyCount,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt,
        u.username,
        up.display_name AS displayName,
        COALESCE(ch.avatar_url, up.avatar_url) AS avatarUrl,
        ch.handle AS channelHandle,
        ${req.user?.id ? 'CASE WHEN cl.id IS NOT NULL THEN TRUE ELSE FALSE END' : 'FALSE'} AS likedByCurrentUser
      FROM comments c
      INNER JOIN users u ON c.user_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN channels ch ON u.id = ch.user_id
      ${req.user?.id ? 'LEFT JOIN comment_likes cl ON c.id = cl.comment_id AND cl.user_id = ?' : ''}
      WHERE c.parent_comment_id = ? 
        AND (
          c.status = 'VISIBLE'
          OR (c.status = 'DELETED' AND c.reply_count > 0)
          OR (c.status = 'REMOVED' AND c.reply_count > 0)
          OR (c.status = 'HIDDEN' AND (c.reply_count > 0 OR c.user_id = ? OR ? = 'ADMIN'))
          OR (? = 'ADMIN')
        )
      ORDER BY c.created_at ASC, c.id ASC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(sql, queryParams);
    const replies = rows.map((r) => formatComment(r, req.user));

    return res.status(200).json({
      success: true,
      replies,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * PUT /api/comments/:commentId
 * Update an existing comment (owner only)
 */
const updateComment = async (req, res, next) => {
  try {
    const commentId = parseInt(req.params.commentId, 10);
    if (isNaN(commentId) || commentId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID' });
    }

    const userId = req.user.id;
    const { content } = req.body;

    if (typeof content !== 'string') {
      return res.status(400).json({ success: false, message: 'Comment content must be text' });
    }
    const trimmed = content.trim();
    const sanitized = sanitizeText(trimmed, 5000);
    if (sanitized.length === 0) {
      return res.status(400).json({ success: false, message: 'Comment cannot be empty' });
    }
    if (trimmed.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Comment exceeds maximum allowed length of 5000 characters',
      });
    }

    const [rows] = await pool.query(
      `SELECT id, user_id, status, video_id 
       FROM comments 
       WHERE id = ? 
       LIMIT 1`,
      [commentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const comment = rows[0];

    // Ownership check
    if (Number(comment.user_id) !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own comments',
      });
    }

    if (comment.status === 'DELETED' || comment.status === 'REMOVED' || comment.status === 'HIDDEN') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a moderated or deleted comment',
      });
    }

    // Update comment content and updated_at
    await pool.query(
      `UPDATE comments 
       SET content = ?, updated_at = NOW() 
       WHERE id = ?`,
      [sanitized, commentId]
    );

    // Invalidate cached translations since comment text changed
    await pool.query('DELETE FROM comment_translations WHERE comment_id = ?', [commentId]);

    // Fetch updated record with author details
    const [updatedRows] = await pool.query(
      `SELECT 
         c.id,
         c.video_id AS videoId,
         c.user_id AS userId,
         c.parent_comment_id AS parentId,
         c.content,
         c.status,
         c.like_count AS likeCount,
         c.reply_count AS replyCount,
         c.created_at AS createdAt,
         c.updated_at AS updatedAt,
         u.username,
         up.display_name AS displayName,
         COALESCE(ch.avatar_url, up.avatar_url) AS avatarUrl,
         ch.handle AS channelHandle,
         CASE WHEN cl.id IS NOT NULL THEN TRUE ELSE FALSE END AS likedByCurrentUser
       FROM comments c
       INNER JOIN users u ON c.user_id = u.id
       LEFT JOIN user_profiles up ON u.id = up.user_id
       LEFT JOIN channels ch ON u.id = ch.user_id
       LEFT JOIN comment_likes cl ON c.id = cl.comment_id AND cl.user_id = ?
       WHERE c.id = ?`,
      [userId, commentId]
    );

    return res.status(200).json({
      success: true,
      message: 'Comment updated successfully',
      comment: formatComment(updatedRows[0]),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/comments/:commentId
 * Delete comment (owner only)
 * If replies exist: soft-delete to preserve thread.
 * If 0 replies: hard-delete row and decrement parent's reply_count or video's comment_count.
 */
const deleteComment = async (req, res, next) => {
  let connection = null;
  try {
    const commentId = parseInt(req.params.commentId, 10);
    if (isNaN(commentId) || commentId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID' });
    }

    const userId = req.user.id;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, video_id, user_id, status, parent_comment_id, reply_count 
       FROM comments 
       WHERE id = ? 
       FOR UPDATE`,
      [commentId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const comment = rows[0];

    // Ownership check
    if (Number(comment.user_id) !== userId && req.user.role !== 'ADMIN') {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own comments',
      });
    }

    // If already deleted, safe idempotent return
    if (comment.status === 'DELETED') {
      await connection.commit();
      return res.status(200).json({
        success: true,
        message: 'Comment is already deleted',
        commentId,
        isSoftDeleted: true,
      });
    }

    const isTopLevel = comment.parent_comment_id === null;
    const hasReplies = Number(comment.reply_count) > 0;

    if (hasReplies) {
      // Soft delete to preserve conversation tree
      await connection.query(
        `UPDATE comments 
         SET status = 'DELETED', content = '[deleted]', updated_at = NOW() 
         WHERE id = ?`,
        [commentId]
      );

      // Clean up cached translations for the deleted comment
      await connection.query('DELETE FROM comment_translations WHERE comment_id = ?', [commentId]);

      // Decrement video comment_count if top-level
      if (isTopLevel) {
        await connection.query(
          `UPDATE videos 
           SET comment_count = GREATEST(comment_count - 1, 0) 
           WHERE id = ?`,
          [comment.video_id]
        );
      }

      await connection.commit();

      return res.status(200).json({
        success: true,
        message: 'Comment deleted successfully',
        commentId,
        isSoftDeleted: true,
      });
    } else {
      // Leaf comment: permanent hard delete
      await connection.query(
        `DELETE FROM comments WHERE id = ?`,
        [commentId]
      );

      if (isTopLevel) {
        await connection.query(
          `UPDATE videos 
           SET comment_count = GREATEST(comment_count - 1, 0) 
           WHERE id = ?`,
          [comment.video_id]
        );
      } else {
        // Decrement parent's reply_count
        await connection.query(
          `UPDATE comments 
           SET reply_count = GREATEST(reply_count - 1, 0) 
           WHERE id = ?`,
          [comment.parent_comment_id]
        );
      }

      await connection.commit();

      return res.status(200).json({
        success: true,
        message: 'Comment permanently deleted',
        commentId,
        isSoftDeleted: false,
      });
    }
  } catch (err) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    next(err);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * GET /api/comments/:commentId/like
 * Get like status and count for a comment
 */
const getCommentLike = async (req, res, next) => {
  try {
    const commentId = parseInt(req.params.commentId, 10);
    if (isNaN(commentId) || commentId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID' });
    }

    const [cRows] = await pool.query(
      `SELECT id, like_count FROM comments WHERE id = ? LIMIT 1`,
      [commentId]
    );

    if (cRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    let liked = false;
    if (req.user?.id) {
      const [lRows] = await pool.query(
        `SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ? LIMIT 1`,
        [commentId, req.user.id]
      );
      liked = lRows.length > 0;
    }

    return res.status(200).json({
      success: true,
      commentId,
      liked,
      likeCount: Number(cRows[0].like_count) || 0,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/comments/:commentId/like
 * Like a comment (creates record, increments like_count)
 */
const likeComment = async (req, res, next) => {
  let connection = null;
  try {
    const commentId = parseInt(req.params.commentId, 10);
    if (isNaN(commentId) || commentId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID' });
    }

    const userId = req.user.id;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Verify comment exists
    const [cRows] = await connection.query(
      `SELECT id, user_id, video_id, content, status, like_count 
       FROM comments 
       WHERE id = ? 
       FOR UPDATE`,
      [commentId]
    );

    if (cRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const comment = cRows[0];
    if (comment.status === 'HIDDEN' || comment.status === 'REMOVED' || comment.status === 'DELETED') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot react to a moderated or deleted comment',
      });
    }

    // Check if user already liked
    const [existing] = await connection.query(
      `SELECT id 
       FROM comment_likes 
       WHERE comment_id = ? AND user_id = ? 
       FOR UPDATE`,
      [commentId, userId]
    );

    let isNewLike = false;
    if (existing.length === 0) {
      isNewLike = true;
      // Create like
      await connection.query(
        `INSERT INTO comment_likes (comment_id, user_id, created_at)
         VALUES (?, ?, NOW())`,
        [commentId, userId]
      );

      await connection.query(
        `UPDATE comments 
         SET like_count = like_count + 1 
         WHERE id = ?`,
        [commentId]
      );
    }

    // Fetch updated count
    const [updatedRows] = await connection.query(
      `SELECT like_count FROM comments WHERE id = ?`,
      [commentId]
    );

    await connection.commit();

    // Send COMMENT_LIKED notification to comment author (with deduplication in notificationService)
    if (isNewLike && comment.user_id && Number(comment.user_id) !== Number(userId)) {
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
          userId: comment.user_id,
          actorUserId: userId,
          type: notificationService.NOTIFICATION_TYPES.COMMENT_LIKED,
          title: 'Comment Liked',
          message: `${likerName} liked your comment: "${(comment.content || '').substring(0, 50)}${(comment.content || '').length > 50 ? '...' : ''}"`,
          entityType: 'comment',
          entityId: commentId,
          videoId: comment.video_id,
          commentId,
          dataJson: {
            video_id: comment.video_id,
            comment_id: commentId,
            actor_username: liker.username,
            actor_display_name: liker.display_name,
            actor_avatar_url: liker.avatar_url,
          },
        }).catch((e) => console.error('[Notification] Failed to send comment like notification:', e.message));
      }).catch((e) => console.error('[Notification] Failed to fetch liker user:', e.message));
    }

    return res.status(200).json({
      success: true,
      commentId,
      liked: true,
      likeCount: Number(updatedRows[0]?.like_count) || 0,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    next(err);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * DELETE /api/comments/:commentId/like
 * Unlike a comment (removes record, decrements like_count)
 */
const unlikeComment = async (req, res, next) => {
  let connection = null;
  try {
    const commentId = parseInt(req.params.commentId, 10);
    if (isNaN(commentId) || commentId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID' });
    }

    const userId = req.user.id;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Verify comment exists
    const [cRows] = await connection.query(
      `SELECT id, status, like_count 
       FROM comments 
       WHERE id = ? 
       FOR UPDATE`,
      [commentId]
    );

    if (cRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const comment = cRows[0];
    if (comment.status === 'HIDDEN' || comment.status === 'REMOVED' || comment.status === 'DELETED') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot react to a moderated or deleted comment',
      });
    }

    // Check if like exists
    const [existing] = await connection.query(
      `SELECT id 
       FROM comment_likes 
       WHERE comment_id = ? AND user_id = ? 
       FOR UPDATE`,
      [commentId, userId]
    );

    if (existing.length > 0) {
      await connection.query(
        `DELETE FROM comment_likes 
         WHERE comment_id = ? AND user_id = ?`,
        [commentId, userId]
      );

      await connection.query(
        `UPDATE comments 
         SET like_count = GREATEST(like_count - 1, 0) 
         WHERE id = ?`,
        [commentId]
      );
    }

    const [updatedRows] = await connection.query(
      `SELECT like_count FROM comments WHERE id = ?`,
      [commentId]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      commentId,
      liked: false,
      likeCount: Number(updatedRows[0]?.like_count) || 0,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    next(err);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  getVideoComments,
  createComment,
  getCommentReplies,
  updateComment,
  deleteComment,
  getCommentLike,
  likeComment,
  unlikeComment,
};
