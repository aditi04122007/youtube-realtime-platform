const { pool } = require('../config/db');
const { deleteOldUpload } = require('../middleware/uploadMiddleware');
const notificationService = require('../services/notificationService');
const { sanitizeText } = require('../utils/sanitizer');

const HANDLE_REGEX = /^[a-zA-Z0-9_.-]{3,50}$/;

/**
 * Helper to normalize channel handles
 * Strips leading @, lowercases, and trims whitespace
 * @param {string} rawHandle
 * @returns {string}
 */
const normalizeHandle = (rawHandle) => {
  if (!rawHandle || typeof rawHandle !== 'string') return '';
  return rawHandle.replace(/^@+/, '').trim().toLowerCase();
};

/**
 * Create Channel for Authenticated User
 * POST /api/channels (Protected)
 */
const createChannel = async (req, res, next) => {
  try {
    const { channel_name, handle, description } = req.body;

    // 1. One channel per user check
    const [existingChannel] = await pool.execute(
      'SELECT id, handle FROM channels WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );

    if (existingChannel.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'You already have a channel',
      });
    }

    // 2. Validate channel name
    if (!channel_name || typeof channel_name !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Channel name is required (minimum 2 characters)',
      });
    }

    const cleanChannelName = sanitizeText(channel_name.trim(), 100);
    if (cleanChannelName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Channel name is required (minimum 2 characters)',
      });
    }

    if (cleanChannelName.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Channel name must not exceed 100 characters',
      });
    }

    // 3. Validate and normalize handle
    const cleanHandle = normalizeHandle(handle);
    if (!cleanHandle || !HANDLE_REGEX.test(cleanHandle)) {
      return res.status(400).json({
        success: false,
        message: 'Channel handle must be 3-50 characters and contain only letters, numbers, hyphens, and underscores',
      });
    }

    // 4. Check handle uniqueness
    const [handleExists] = await pool.execute(
      'SELECT id FROM channels WHERE handle = ? LIMIT 1',
      [cleanHandle]
    );

    if (handleExists.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Channel handle is already taken',
      });
    }

    // 5. Validate optional description
    let cleanDescription = null;
    if (description !== undefined && description !== null) {
      cleanDescription = sanitizeText(String(description).trim(), 1000);
      if (cleanDescription.length > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Channel description must not exceed 1000 characters',
        });
      }
    }

    // 6. Insert channel record
    const [result] = await pool.execute(
      `INSERT INTO channels (user_id, channel_name, handle, description)
       VALUES (?, ?, ?, ?)`,
      [req.user.id, cleanChannelName, cleanHandle, cleanDescription]
    );

    const newChannelId = result.insertId;

    const [channelRows] = await pool.execute(
      `SELECT id, user_id, channel_name, handle, description, avatar_url, banner_url,
              subscriber_count, video_count, view_count, created_at, updated_at
       FROM channels
       WHERE id = ? LIMIT 1`,
      [newChannelId]
    );

    return res.status(201).json({
      success: true,
      message: 'Channel created successfully',
      channel: channelRows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Authenticated User's Channel
 * GET /api/channels/me (Protected)
 */
const getCurrentUserChannel = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, user_id, channel_name, handle, description, avatar_url, banner_url,
              subscriber_count, video_count, view_count, created_at, updated_at
       FROM channels
       WHERE user_id = ? LIMIT 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        channel: null,
      });
    }

    return res.status(200).json({
      success: true,
      channel: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Public Channel by ID
 * GET /api/channels/:id (Public)
 */
const getChannelById = async (req, res, next) => {
  try {
    const channelId = Number(req.params.id);

    if (!channelId || isNaN(channelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid channel ID',
      });
    }

    const [rows] = await pool.execute(
      `SELECT c.id, c.user_id, c.channel_name, c.handle, c.description,
              c.avatar_url, c.banner_url, c.subscriber_count, c.video_count,
              c.view_count, c.created_at, c.updated_at,
              u.username AS owner_username,
              p.display_name AS owner_display_name
       FROM channels c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE c.id = ? AND u.status = 'ACTIVE' LIMIT 1`,
      [channelId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found',
      });
    }

    return res.status(200).json({
      success: true,
      channel: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Public Channel by Handle
 * GET /api/channels/handle/:handle (Public)
 */
const getChannelByHandle = async (req, res, next) => {
  try {
    const cleanHandle = normalizeHandle(req.params.handle);

    if (!cleanHandle) {
      return res.status(400).json({
        success: false,
        message: 'Invalid channel handle',
      });
    }

    const [rows] = await pool.execute(
      `SELECT c.id, c.user_id, c.channel_name, c.handle, c.description,
              c.avatar_url, c.banner_url, c.subscriber_count, c.video_count,
              c.view_count, c.created_at, c.updated_at,
              u.username AS owner_username,
              p.display_name AS owner_display_name
       FROM channels c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE c.handle = ? AND u.status = 'ACTIVE' LIMIT 1`,
      [cleanHandle]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found',
      });
    }

    return res.status(200).json({
      success: true,
      channel: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Current User's Channel
 * PUT /api/channels/me (Protected)
 */
const updateChannel = async (req, res, next) => {
  try {
    const { channel_name, description, handle } = req.body;

    // 1. Verify user owns a channel
    const [existing] = await pool.execute(
      'SELECT id, channel_name, handle, description FROM channels WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'You do not have a channel yet',
      });
    }

    const current = existing[0];

    // 2. Validate channel name
    let cleanName = current.channel_name;
    if (channel_name !== undefined) {
      cleanName = sanitizeText(String(channel_name).trim(), 100);
      if (cleanName.length < 2 || cleanName.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Channel name must be between 2 and 100 characters',
        });
      }
    }

    // 3. Validate description
    let cleanDescription = current.description;
    if (description !== undefined) {
      cleanDescription = description !== null ? sanitizeText(String(description).trim(), 1000) : null;
      if (cleanDescription && cleanDescription.length > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Description must not exceed 1000 characters',
        });
      }
    }

    // 4. Validate and check handle if changed
    let cleanHandle = current.handle;
    if (handle !== undefined) {
      const candidateHandle = normalizeHandle(handle);
      if (!candidateHandle || !HANDLE_REGEX.test(candidateHandle)) {
        return res.status(400).json({
          success: false,
          message: 'Channel handle must be 3-50 characters and contain only letters, numbers, hyphens, and underscores',
        });
      }

      if (candidateHandle !== current.handle) {
        const [taken] = await pool.execute(
          'SELECT id FROM channels WHERE handle = ? AND id != ? LIMIT 1',
          [candidateHandle, current.id]
        );

        if (taken.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'Channel handle is already taken',
          });
        }

        cleanHandle = candidateHandle;
      }
    }

    // 5. Update database (statistics counters are strictly preserved and never updated here)
    await pool.execute(
      `UPDATE channels
       SET channel_name = ?, description = ?, handle = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [cleanName, cleanDescription, cleanHandle, current.id, req.user.id]
    );

    const [updated] = await pool.execute(
      `SELECT id, user_id, channel_name, handle, description, avatar_url, banner_url,
              subscriber_count, video_count, view_count, created_at, updated_at
       FROM channels
       WHERE id = ? LIMIT 1`,
      [current.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Channel updated successfully',
      channel: updated[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload Channel Avatar
 * POST /api/channels/me/avatar (Protected)
 */
const uploadChannelAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No avatar image was uploaded',
      });
    }

    const [channels] = await pool.execute(
      'SELECT id, avatar_url FROM channels WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );

    if (channels.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Please create a channel first before uploading channel artwork',
      });
    }

    const channel = channels[0];
    const newAvatarUrl = `/uploads/channel-avatars/${req.file.filename}`;

    // Delete old avatar if present
    if (channel.avatar_url) {
      deleteOldUpload(channel.avatar_url, 'channel-avatars');
    }

    await pool.execute(
      `UPDATE channels
       SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newAvatarUrl, channel.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Channel avatar uploaded successfully',
      avatar_url: newAvatarUrl,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload Channel Banner
 * POST /api/channels/me/banner (Protected)
 */
const uploadChannelBanner = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No banner image was uploaded',
      });
    }

    const [channels] = await pool.execute(
      'SELECT id, banner_url FROM channels WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );

    if (channels.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Please create a channel first before uploading channel artwork',
      });
    }

    const channel = channels[0];
    const newBannerUrl = `/uploads/channel-banners/${req.file.filename}`;

    // Delete old banner if present
    if (channel.banner_url) {
      deleteOldUpload(channel.banner_url, 'channel-banners');
    }

    await pool.execute(
      `UPDATE channels
       SET banner_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newBannerUrl, channel.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Channel banner uploaded successfully',
      banner_url: newBannerUrl,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Subscribe to Channel
 * POST /api/channels/:id/subscribe (Protected)
 */
const subscribeToChannel = async (req, res, next) => {
  try {
    const target = req.params.id;
    const subscriberId = req.user.id;

    let query = 'SELECT id, user_id, channel_name, handle, subscriber_count FROM channels WHERE ';
    let params = [];
    if (!isNaN(target)) {
      query += 'id = ? LIMIT 1';
      params = [Number(target)];
    } else {
      query += 'handle = ? LIMIT 1';
      params = [target.replace(/^@+/, '').toLowerCase()];
    }

    const [channels] = await pool.query(query, params);
    if (channels.length === 0) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    const channel = channels[0];

    if (Number(channel.user_id) === Number(subscriberId)) {
      return res.status(400).json({ success: false, message: 'You cannot subscribe to your own channel' });
    }

    // Check if already subscribed
    const [existing] = await pool.query(
      'SELECT id FROM channel_subscriptions WHERE subscriber_id = ? AND channel_id = ? LIMIT 1',
      [subscriberId, channel.id]
    );

    if (existing.length > 0) {
      return res.status(200).json({
        success: true,
        message: 'Already subscribed to this channel',
        isSubscribed: true,
        subscriberCount: channel.subscriber_count,
      });
    }

    // Insert subscription and increment counter
    await pool.query(
      'INSERT INTO channel_subscriptions (subscriber_id, channel_id, created_at) VALUES (?, ?, NOW())',
      [subscriberId, channel.id]
    );
    await pool.query(
      'UPDATE channels SET subscriber_count = subscriber_count + 1 WHERE id = ?',
      [channel.id]
    );

    const newCount = channel.subscriber_count + 1;

    // Get subscriber profile for notification
    const [subs] = await pool.query(
      `SELECT u.username, up.display_name, COALESCE(ch.avatar_url, up.avatar_url) AS avatar_url
       FROM users u
       LEFT JOIN user_profiles up ON u.id = up.user_id
       LEFT JOIN channels ch ON u.id = ch.user_id
       WHERE u.id = ? LIMIT 1`,
      [subscriberId]
    );
    const subUser = subs[0] || {};
    const subscriberName = subUser.display_name || subUser.username || 'A viewer';

    // Send real-time notification to channel owner
    await notificationService.createNotification({
      userId: channel.user_id,
      actorUserId: subscriberId,
      type: notificationService.NOTIFICATION_TYPES.NEW_SUBSCRIBER,
      title: 'New Subscriber',
      message: `${subscriberName} subscribed to your channel!`,
      entityType: 'channel',
      entityId: channel.id,
      channelId: channel.id,
      dataJson: {
        channel_id: channel.id,
        channel_name: channel.channel_name,
        channel_handle: channel.handle,
        actor_username: subUser.username,
        actor_display_name: subUser.display_name,
        actor_avatar_url: subUser.avatar_url,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Subscribed to ${channel.channel_name}`,
      isSubscribed: true,
      subscriberCount: newCount,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Unsubscribe from Channel
 * DELETE /api/channels/:id/subscribe (Protected)
 */
const unsubscribeFromChannel = async (req, res, next) => {
  try {
    const target = req.params.id;
    const subscriberId = req.user.id;

    let query = 'SELECT id, user_id, channel_name, handle, subscriber_count FROM channels WHERE ';
    let params = [];
    if (!isNaN(target)) {
      query += 'id = ? LIMIT 1';
      params = [Number(target)];
    } else {
      query += 'handle = ? LIMIT 1';
      params = [target.replace(/^@+/, '').toLowerCase()];
    }

    const [channels] = await pool.query(query, params);
    if (channels.length === 0) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    const channel = channels[0];

    const [delResult] = await pool.query(
      'DELETE FROM channel_subscriptions WHERE subscriber_id = ? AND channel_id = ?',
      [subscriberId, channel.id]
    );

    if (delResult.affectedRows > 0) {
      await pool.query(
        'UPDATE channels SET subscriber_count = GREATEST(subscriber_count - 1, 0) WHERE id = ?',
        [channel.id]
      );
    }

    const newCount = Math.max(0, channel.subscriber_count - (delResult.affectedRows > 0 ? 1 : 0));

    return res.status(200).json({
      success: true,
      message: `Unsubscribed from ${channel.channel_name}`,
      isSubscribed: false,
      subscriberCount: newCount,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Channel Subscription Status
 * GET /api/channels/:id/subscription-status (Public / Optional Auth)
 */
const getChannelSubscriptionStatus = async (req, res, next) => {
  try {
    const target = req.params.id;
    const subscriberId = req.user?.id;

    let query = 'SELECT id, subscriber_count FROM channels WHERE ';
    let params = [];
    if (!isNaN(target)) {
      query += 'id = ? LIMIT 1';
      params = [Number(target)];
    } else {
      query += 'handle = ? LIMIT 1';
      params = [target.replace(/^@+/, '').toLowerCase()];
    }

    const [channels] = await pool.query(query, params);
    if (channels.length === 0) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    const channel = channels[0];
    let isSubscribed = false;

    if (subscriberId) {
      const [sub] = await pool.query(
        'SELECT id FROM channel_subscriptions WHERE subscriber_id = ? AND channel_id = ? LIMIT 1',
        [subscriberId, channel.id]
      );
      isSubscribed = sub.length > 0;
    }

    return res.status(200).json({
      success: true,
      isSubscribed,
      subscriberCount: Number(channel.subscriber_count) || 0,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createChannel,
  getCurrentUserChannel,
  getChannelById,
  getChannelByHandle,
  updateChannel,
  uploadChannelAvatar,
  uploadChannelBanner,
  subscribeToChannel,
  unsubscribeFromChannel,
  getChannelSubscriptionStatus,
};
