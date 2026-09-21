const { pool } = require('../config/db');
const { emitToUser } = require('../socket/socketServer');

/**
 * Valid Notification Types
 */
const NOTIFICATION_TYPES = {
  VIDEO_PUBLISHED: 'VIDEO_PUBLISHED',
  NEW_SUBSCRIBER: 'NEW_SUBSCRIBER',
  COMMENT_ON_VIDEO: 'COMMENT_ON_VIDEO',
  REPLY_TO_COMMENT: 'REPLY_TO_COMMENT',
  COMMENT_LIKED: 'COMMENT_LIKED',
  VIDEO_LIKED: 'VIDEO_LIKED',
  SUBSCRIPTION_STARTED: 'SUBSCRIPTION_STARTED',
  SUBSCRIPTION_CHANGED: 'SUBSCRIPTION_CHANGED',
  CALL_ROOM_INVITATION: 'CALL_ROOM_INVITATION',
};

/**
 * Construct smart navigation URL based on notification type and IDs
 */
const buildNotificationLink = (row, dataJson = {}) => {
  if (dataJson.custom_link) {
    return dataJson.custom_link;
  }
  switch (row.type) {
    case NOTIFICATION_TYPES.VIDEO_PUBLISHED:
    case NOTIFICATION_TYPES.COMMENT_ON_VIDEO:
    case NOTIFICATION_TYPES.REPLY_TO_COMMENT:
    case NOTIFICATION_TYPES.VIDEO_LIKED:
    case NOTIFICATION_TYPES.COMMENT_LIKED:
      return row.video_id ? `/watch/${row.video_id}` : '/';
    case NOTIFICATION_TYPES.NEW_SUBSCRIBER:
      if (dataJson.channel_handle) return `/channel/${dataJson.channel_handle}`;
      if (row.channel_id) return `/channel/${row.channel_id}`;
      if (row.actor_user_id) return `/profile/${row.actor_user_id}`;
      return '/';
    case NOTIFICATION_TYPES.SUBSCRIPTION_STARTED:
    case NOTIFICATION_TYPES.SUBSCRIPTION_CHANGED:
      return '/subscription-dashboard';
    case NOTIFICATION_TYPES.CALL_ROOM_INVITATION:
      return dataJson.room_code ? `/call-room/${dataJson.room_code}` : '/';
    default:
      return row.video_id ? `/watch/${row.video_id}` : '/';
  }
};

/**
 * Format raw notification DB row into standard client payload
 */
const formatNotification = (row) => {
  let parsedData = {};
  if (row.data_json) {
    try {
      parsedData = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json;
    } catch (e) {
      parsedData = {};
    }
  }

  const link = buildNotificationLink(row, parsedData);

  return {
    id: row.id,
    userId: row.user_id,
    actorUserId: row.actor_user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id,
    videoId: row.video_id,
    commentId: row.comment_id,
    channelId: row.channel_id,
    data: parsedData,
    link,
    isRead: Boolean(row.is_read),
    readAt: row.read_at,
    createdAt: row.created_at,
    actor: row.actor_user_id
      ? {
          id: row.actor_user_id,
          username: row.actor_username || parsedData.actor_username || null,
          displayName: row.actor_display_name || parsedData.actor_display_name || null,
          avatarUrl: row.actor_avatar_url || parsedData.actor_avatar_url || null,
        }
      : null,
    video: row.video_id
      ? {
          id: row.video_id,
          title: row.video_title || parsedData.video_title || null,
          thumbnailUrl: row.video_thumbnail_url || parsedData.video_thumbnail_url || null,
        }
      : null,
  };
};

/**
 * Create persistent notification in MySQL and deliver via Socket.IO
 *
 * @param {object} params
 * @param {number|string} params.userId - Target recipient user ID
 * @param {number|string} [params.actorUserId] - Who triggered the event (optional)
 * @param {string} params.type - One of NOTIFICATION_TYPES
 * @param {string} params.title - Short header
 * @param {string} params.message - Descriptive text
 * @param {string} [params.entityType] - e.g. 'video', 'comment', 'channel', 'subscription'
 * @param {number|string} [params.entityId] - Target entity ID
 * @param {number|string} [params.videoId] - Related video ID
 * @param {number|string} [params.commentId] - Related comment ID
 * @param {number|string} [params.channelId] - Related channel ID
 * @param {object} [params.dataJson] - Arbitrary metadata (avatars, thumbnails, names)
 * @returns {Promise<object|null>} Created notification object or null if suppressed
 */
const createNotification = async ({
  userId,
  actorUserId = null,
  type,
  title,
  message,
  entityType = null,
  entityId = null,
  videoId = null,
  commentId = null,
  channelId = null,
  dataJson = null,
}) => {
  if (!userId) {
    throw new Error('userId is required to create a notification');
  }

  // 1. Self-notification suppression: do not notify a user about their own action
  if (actorUserId && Number(actorUserId) === Number(userId)) {
    return null;
  }

  // 2. Spam deduplication for reaction events (likes on videos and comments within 1 hour)
  if (
    actorUserId &&
    (type === NOTIFICATION_TYPES.VIDEO_LIKED || type === NOTIFICATION_TYPES.COMMENT_LIKED)
  ) {
    const [recent] = await pool.query(
      `SELECT id FROM notifications 
       WHERE user_id = ? 
         AND actor_user_id = ? 
         AND type = ? 
         AND (video_id = ? OR (video_id IS NULL AND ? IS NULL))
         AND (comment_id = ? OR (comment_id IS NULL AND ? IS NULL))
         AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
       LIMIT 1`,
      [userId, actorUserId, type, videoId, videoId, commentId, commentId]
    );

    if (recent.length > 0) {
      return null;
    }
  }

  // 3. Insert notification into MySQL
  const jsonString = dataJson ? (typeof dataJson === 'string' ? dataJson : JSON.stringify(dataJson)) : null;

  const [result] = await pool.query(
    `INSERT INTO notifications (
       user_id,
       actor_user_id,
       type,
       title,
       message,
       entity_type,
       entity_id,
       video_id,
       comment_id,
       channel_id,
       data_json,
       is_read,
       created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, NOW())`,
    [
      userId,
      actorUserId || null,
      type,
      title,
      message,
      entityType || null,
      entityId || null,
      videoId || null,
      commentId || null,
      channelId || null,
      jsonString,
    ]
  );

  const notificationId = result.insertId;

  // 4. Fetch the enriched notification row
  const [rows] = await pool.query(
    `SELECT 
       n.*,
       u.username AS actor_username,
       up.display_name AS actor_display_name,
       COALESCE(ch.avatar_url, up.avatar_url) AS actor_avatar_url,
       v.title AS video_title,
       v.thumbnail_url AS video_thumbnail_url
     FROM notifications n
     LEFT JOIN users u ON n.actor_user_id = u.id
     LEFT JOIN user_profiles up ON u.id = up.user_id
     LEFT JOIN channels ch ON u.id = ch.user_id
     LEFT JOIN videos v ON n.video_id = v.id
     WHERE n.id = ? LIMIT 1`,
    [notificationId]
  );

  if (rows.length === 0) {
    return null;
  }

  const formatted = formatNotification(rows[0]);

  // 5. Emit real-time notification to user's private room via Socket.IO
  emitToUser(userId, 'notification:new', formatted);

  // 6. Emit updated unread count
  const unreadCount = await getUnreadCount(userId);
  emitToUser(userId, 'notification:count', { unreadCount });

  return formatted;
};

/**
 * Get paginated list of notifications for a user
 */
const getNotifications = async ({ userId, page = 1, limit = 20, unreadOnly = false }) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;
  const isUnreadFilter = String(unreadOnly) === 'true' || unreadOnly === true;

  // 1. Fetch count
  const countQuery = `
    SELECT 
      COUNT(*) AS total_count,
      SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) AS unread_count
    FROM notifications
    WHERE user_id = ?
      ${isUnreadFilter ? 'AND is_read = FALSE' : ''}
  `;
  const [countRows] = await pool.query(countQuery, [userId]);
  const totalCount = Number(countRows[0]?.total_count) || 0;
  const unreadCount = Number(countRows[0]?.unread_count) || 0;

  // 2. Fetch paginated rows
  const [rows] = await pool.query(
    `SELECT 
       n.*,
       u.username AS actor_username,
       up.display_name AS actor_display_name,
       COALESCE(ch.avatar_url, up.avatar_url) AS actor_avatar_url,
       v.title AS video_title,
       v.thumbnail_url AS video_thumbnail_url
     FROM notifications n
     LEFT JOIN users u ON n.actor_user_id = u.id
     LEFT JOIN user_profiles up ON u.id = up.user_id
     LEFT JOIN channels ch ON u.id = ch.user_id
     LEFT JOIN videos v ON n.video_id = v.id
     WHERE n.user_id = ?
       ${isUnreadFilter ? 'AND n.is_read = FALSE' : ''}
     ORDER BY n.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, safeLimit, offset]
  );

  const notifications = rows.map(formatNotification);
  const totalPages = Math.ceil(totalCount / safeLimit);

  return {
    notifications,
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalCount,
      totalPages,
      hasMore: safePage < totalPages,
    },
    unreadCount,
  };
};

/**
 * Fast unread count query
 */
const getUnreadCount = async (userId) => {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = FALSE',
    [userId]
  );
  return Number(rows[0]?.count) || 0;
};

/**
 * Mark a single notification as read (with IDOR protection)
 */
const markAsRead = async ({ notificationId, userId }) => {
  // Check if notification exists and check ownership
  const [existing] = await pool.query(
    'SELECT id, user_id, is_read FROM notifications WHERE id = ? LIMIT 1',
    [notificationId]
  );

  if (existing.length === 0) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }

  if (Number(existing[0].user_id) !== Number(userId)) {
    const error = new Error('You do not have permission to modify this notification');
    error.statusCode = 403;
    throw error;
  }

  if (!existing[0].is_read) {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = ?',
      [notificationId]
    );
  }

  const unreadCount = await getUnreadCount(userId);
  emitToUser(userId, 'notification:count', { unreadCount });

  return {
    success: true,
    notificationId: Number(notificationId),
    isRead: true,
    unreadCount,
  };
};

/**
 * Mark all notifications for a user as read
 */
const markAllAsRead = async (userId) => {
  const [result] = await pool.query(
    'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = ? AND is_read = FALSE',
    [userId]
  );

  emitToUser(userId, 'notification:count', { unreadCount: 0 });

  return {
    success: true,
    markedCount: result.affectedRows,
    unreadCount: 0,
  };
};

/**
 * Delete a notification (with IDOR protection)
 */
const deleteNotification = async ({ notificationId, userId }) => {
  const [existing] = await pool.query(
    'SELECT id, user_id, is_read FROM notifications WHERE id = ? LIMIT 1',
    [notificationId]
  );

  if (existing.length === 0) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }

  if (Number(existing[0].user_id) !== Number(userId)) {
    const error = new Error('You do not have permission to delete this notification');
    error.statusCode = 403;
    throw error;
  }

  await pool.query('DELETE FROM notifications WHERE id = ?', [notificationId]);

  const unreadCount = await getUnreadCount(userId);
  emitToUser(userId, 'notification:count', { unreadCount });

  return {
    success: true,
    notificationId: Number(notificationId),
    unreadCount,
  };
};

module.exports = {
  NOTIFICATION_TYPES,
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  formatNotification,
};
