const { pool } = require('../config/db');
const storageService = require('../services/storageService');
const videoAccessService = require('../services/videoAccessService');
const notificationService = require('../services/notificationService');
const { sanitizeText } = require('../utils/sanitizer');

/**
 * Format raw video row to safe public payload
 */
const formatVideoResponse = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description || '',
  video_url: row.video_url,
  thumbnail_url: row.thumbnail_url || null,
  duration_seconds: Number(row.duration_seconds) || 0,
  visibility: row.visibility,
  status: row.status,
  view_count: Number(row.view_count) || 0,
  like_count: Number(row.like_count) || 0,
  dislike_count: Number(row.dislike_count) || 0,
  comment_count: Number(row.comment_count) || 0,
  file_size: Number(row.file_size) || 0,
  mime_type: row.mime_type || null,
  published_at: row.published_at || row.created_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
  category: row.category_name || null,
  access: {
    type: row.access_type || 'FREE',
    is_premium: (row.access_type || 'FREE') === 'PREMIUM',
    minimum_plan_code: row.minimum_plan_code || (row.access_type === 'PREMIUM' ? 'BRONZE' : null),
    minimum_plan_name: row.minimum_plan_name || (row.access_type === 'PREMIUM' ? 'Bronze' : null),
    can_watch: row.can_watch !== undefined ? Boolean(row.can_watch) : undefined,
  },
  is_premium: (row.access_type || 'FREE') === 'PREMIUM',
  minimum_plan_code: row.minimum_plan_code || (row.access_type === 'PREMIUM' ? 'BRONZE' : null),
  channel: {
    id: row.channel_id,
    channel_name: row.channel_name,
    handle: row.channel_handle,
    avatar_url: row.channel_avatar_url || null,
    subscriber_count: Number(row.channel_subscribers) || 0,
  },
});

/**
 * Helper to slugify tags
 */
const slugify = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * POST /api/videos/upload
 * Protected route: creator uploads video with optional thumbnail and metadata
 */
const uploadVideo = async (req, res, next) => {
  const videoFile = req.files?.video?.[0];
  const thumbnailFile = req.files?.thumbnail?.[0];

  const cleanupFiles = () => {
    if (videoFile) storageService.deleteFile(storageService.getVideoUrl(videoFile.filename));
    if (thumbnailFile) storageService.deleteFile(storageService.getThumbnailUrl(thumbnailFile.filename));
  };

  try {
    const userId = req.user.id;

    // 1. Validate that video file was uploaded
    if (!videoFile) {
      if (thumbnailFile) cleanupFiles();
      return res.status(400).json({
        success: false,
        message: 'Video file is required for upload',
      });
    }

    // 2. Validate user channel ownership (Must have created a channel)
    const [channels] = await pool.query(
      'SELECT id, channel_name, handle FROM channels WHERE user_id = ? LIMIT 1',
      [userId]
    );

    if (channels.length === 0) {
      cleanupFiles();
      return res.status(403).json({
        success: false,
        message: 'You need a channel before you can upload videos. Please create a channel first.',
        requiresChannel: true,
      });
    }

    const channel = channels[0];
    const channelId = channel.id;

    // 3. Validate metadata
    const { title, description, category_id, tags, visibility = 'PUBLIC' } = req.body;

    if (!title || typeof title !== 'string') {
      cleanupFiles();
      return res.status(400).json({
        success: false,
        message: 'Video title must be at least 3 characters long',
      });
    }

    const cleanTitle = sanitizeText(title.trim(), 200);
    if (cleanTitle.length < 3) {
      cleanupFiles();
      return res.status(400).json({
        success: false,
        message: 'Video title must be at least 3 characters long',
      });
    }

    if (cleanTitle.length > 200) {
      cleanupFiles();
      return res.status(400).json({
        success: false,
        message: 'Video title cannot exceed 200 characters',
      });
    }

    const cleanDescription = description ? sanitizeText(description.trim(), 5000) : null;

    const cleanVisibility = ['PUBLIC', 'UNLISTED', 'PRIVATE'].includes(visibility.toUpperCase())
      ? visibility.toUpperCase()
      : 'PUBLIC';

    // Validate category_id if supplied
    let validCategoryId = null;
    if (category_id) {
      const parsedCatId = parseInt(category_id, 10);
      if (!isNaN(parsedCatId)) {
        const [catExists] = await pool.query(
          'SELECT id FROM video_categories WHERE id = ? LIMIT 1',
          [parsedCatId]
        );
        if (catExists.length > 0) {
          validCategoryId = catExists[0].id;
        } else {
          cleanupFiles();
          return res.status(400).json({
            success: false,
            message: 'Selected video category does not exist',
          });
        }
      }
    }

    // Parse and normalize tags (comma-separated or JSON array, max 10 tags)
    let parsedTags = [];
    if (tags) {
      if (typeof tags === 'string') {
        parsedTags = tags
          .split(',')
          .map((t) => sanitizeText(t, 50))
          .filter((t) => t.length > 0 && t.length <= 50);
      } else if (Array.isArray(tags)) {
        parsedTags = tags
          .map((t) => sanitizeText(t, 50))
          .filter((t) => t.length > 0 && t.length <= 50);
      }
      // Deduplicate and cap at 10
      parsedTags = Array.from(new Set(parsedTags)).slice(0, 10);
    }

    // 4. File metadata
    const videoUrl = storageService.getVideoUrl(videoFile.filename);
    const thumbnailUrl = thumbnailFile
      ? storageService.getThumbnailUrl(thumbnailFile.filename)
      : null;
    const fileSize = videoFile.size;
    const mimeType = videoFile.mimetype;
    const durationSeconds = 0; // Default or extracted duration

    // 5. Database transaction execution
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      // Insert into videos
      const [insertResult] = await conn.query(
        `INSERT INTO videos (
           user_id, channel_id, title, description, video_url, thumbnail_url,
           duration_seconds, visibility, status, file_size, mime_type, published_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', ?, ?, NOW())`,
        [
          userId,
          channelId,
          cleanTitle,
          cleanDescription,
          videoUrl,
          thumbnailUrl,
          durationSeconds,
          cleanVisibility,
          fileSize,
          mimeType,
        ]
      );

      const videoId = insertResult.insertId;

      // Associate category if provided
      if (validCategoryId) {
        await conn.query(
          'INSERT INTO video_category_map (video_id, category_id) VALUES (?, ?)',
          [videoId, validCategoryId]
        );
      }

      // Associate tags if provided
      for (const tagName of parsedTags) {
        const tagSlug = slugify(tagName) || `tag-${Date.now()}`;
        // Insert tag or fetch existing
        await conn.query(
          `INSERT INTO tags (name, slug) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
          [tagName, tagSlug]
        );
        const [tagRow] = await conn.query('SELECT id FROM tags WHERE name = ? LIMIT 1', [tagName]);
        if (tagRow.length > 0) {
          await conn.query(
            'INSERT IGNORE INTO video_tags (video_id, tag_id) VALUES (?, ?)',
            [videoId, tagRow[0].id]
          );
        }
      }

      // Increment channel video counter
      await conn.query(
        'UPDATE channels SET video_count = video_count + 1 WHERE id = ?',
        [channelId]
      );

      // Configure access rule
      const accessType = String(req.body.access_type || 'FREE').toUpperCase();
      const cleanAccessType = ['FREE', 'PREMIUM'].includes(accessType) ? accessType : 'FREE';
      let requiredPlanId = null;
      let minPlanCode = null;

      if (cleanAccessType === 'PREMIUM') {
        const inputCode = String(req.body.minimum_plan_code || 'BRONZE').toUpperCase();
        minPlanCode = ['BRONZE', 'SILVER', 'GOLD'].includes(inputCode) ? inputCode : 'BRONZE';
        const [pRows] = await conn.query('SELECT id FROM subscription_plans WHERE code = ? LIMIT 1', [minPlanCode]);
        if (pRows.length > 0) {
          requiredPlanId = pRows[0].id;
        }
      }

      await conn.query(
        `INSERT INTO video_access_rules (video_id, access_type, required_plan_id, minimum_plan_code)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           access_type = VALUES(access_type),
           required_plan_id = VALUES(required_plan_id),
           minimum_plan_code = VALUES(minimum_plan_code)`,
        [videoId, cleanAccessType, requiredPlanId, minPlanCode]
      );

      await conn.commit();
      conn.release();

      // Dispatch VIDEO_PUBLISHED notifications asynchronously to all channel subscribers
      if (cleanVisibility === 'PUBLIC') {
        pool.query(
          'SELECT subscriber_id FROM channel_subscriptions WHERE channel_id = ?',
          [channelId]
        ).then(([subs]) => {
          subs.forEach((sub) => {
            notificationService.createNotification({
              userId: sub.subscriber_id,
              actorUserId: userId,
              type: notificationService.NOTIFICATION_TYPES.VIDEO_PUBLISHED,
              title: 'New Video Uploaded',
              message: `${channel.channel_name} uploaded: "${title.trim()}"`,
              entityType: 'video',
              entityId: videoId,
              videoId: videoId,
              channelId: channelId,
              dataJson: {
                video_id: videoId,
                video_title: title.trim(),
                thumbnail_url: thumbnailUrl,
                channel_name: channel.channel_name,
                channel_handle: channel.handle,
              },
            }).catch((e) => console.error('[Notification] Failed to notify subscriber:', e.message));
          });
        }).catch((e) => console.error('[Notification] Failed to query subscribers:', e.message));
      }

      return res.status(201).json({
        success: true,
        message: 'Video published successfully',
        data: {
          id: videoId,
          title: title.trim(),
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          status: 'PUBLISHED',
          visibility: cleanVisibility,
          access: {
            type: cleanAccessType,
            is_premium: cleanAccessType === 'PREMIUM',
            minimum_plan_code: minPlanCode,
          },
          is_premium: cleanAccessType === 'PREMIUM',
          minimum_plan_code: minPlanCode,
          channel: {
            id: channel.id,
            channel_name: channel.channel_name,
            handle: channel.handle,
          },
        },
      });
    } catch (dbErr) {
      await conn.rollback();
      conn.release();
      cleanupFiles();
      throw dbErr;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/videos/my
 * Protected route: get paginated videos belonging to authenticated user
 */
const getMyVideos = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const offset = (page - 1) * limit;

    // Count total
    const [countRes] = await pool.query(
      'SELECT COUNT(*) AS total FROM videos WHERE user_id = ? AND status != "DELETED"',
      [userId]
    );
    const total = countRes[0]?.total || 0;

    // Fetch user videos
    const [videos] = await pool.query(
      `SELECT 
         v.id, v.title, v.description, v.video_url, v.thumbnail_url,
         v.duration_seconds, v.visibility, v.status, v.view_count, v.like_count,
         v.comment_count, v.file_size, v.mime_type, v.published_at, v.created_at, v.updated_at,
         c.id AS channel_id, c.channel_name, c.handle AS channel_handle,
         c.avatar_url AS channel_avatar_url, c.subscriber_count AS channel_subscribers,
         (SELECT cat.name FROM video_category_map vcm JOIN video_categories cat ON vcm.category_id = cat.id WHERE vcm.video_id = v.id LIMIT 1) AS category_name,
         COALESCE(var.access_type, 'FREE') AS access_type,
         COALESCE(var.minimum_plan_code, sp.code, 'BRONZE') AS minimum_plan_code,
         sp.name AS minimum_plan_name
       FROM videos v
       INNER JOIN channels c ON v.channel_id = c.id
       LEFT JOIN video_access_rules var ON v.id = var.video_id
       LEFT JOIN subscription_plans sp ON var.required_plan_id = sp.id
       WHERE v.user_id = ? AND v.status != 'DELETED'
       ORDER BY v.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    return res.status(200).json({
      success: true,
      data: videos.map(formatVideoResponse),
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + videos.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/videos/:id
 * Public route with privacy verification
 */
const getVideoById = async (req, res, next) => {
  try {
    const videoId = parseInt(req.params.id, 10);
    if (isNaN(videoId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid video ID',
      });
    }

    const [rows] = await pool.query(
      `SELECT 
         v.id, v.user_id, v.channel_id, v.title, v.description, v.video_url, v.thumbnail_url,
         v.duration_seconds, v.visibility, v.status, v.view_count, v.like_count, v.dislike_count,
         v.comment_count, v.file_size, v.mime_type, v.published_at, v.created_at, v.updated_at,
         c.id AS channel_id, c.channel_name, c.handle AS channel_handle,
         c.avatar_url AS channel_avatar_url, c.subscriber_count AS channel_subscribers,
         (SELECT cat.name FROM video_category_map vcm JOIN video_categories cat ON vcm.category_id = cat.id WHERE vcm.video_id = v.id LIMIT 1) AS category_name,
         (SELECT cat.id FROM video_category_map vcm JOIN video_categories cat ON vcm.category_id = cat.id WHERE vcm.video_id = v.id LIMIT 1) AS category_id,
         COALESCE(var.access_type, 'FREE') AS access_type,
         COALESCE(var.minimum_plan_code, sp.code, 'BRONZE') AS minimum_plan_code,
         sp.name AS minimum_plan_name
       FROM videos v
       INNER JOIN channels c ON v.channel_id = c.id
       LEFT JOIN video_access_rules var ON v.id = var.video_id
       LEFT JOIN subscription_plans sp ON var.required_plan_id = sp.id
       WHERE v.id = ? AND v.status != 'DELETED'
       LIMIT 1`,
      [videoId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Video not found',
      });
    }

    const video = rows[0];

    // Privacy & status checks
    const isOwner = req.user && (req.user.id === video.user_id || req.user.role === 'ADMIN');

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

    if (video.status === 'REMOVED' && !isOwner) {
      return res.status(404).json({
        success: false,
        message: 'This video has been removed by platform moderation',
      });
    }

    if (video.status === 'HIDDEN' && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'This video is currently hidden by platform moderation',
      });
    }

    // Evaluate video access details for caller
    const accessDetails = await videoAccessService.getVideoAccessDetails(videoId, req.user);

    // Fetch tags
    const [tags] = await pool.query(
      `SELECT t.id, t.name, t.slug 
       FROM tags t 
       INNER JOIN video_tags vt ON t.id = vt.tag_id 
       WHERE vt.video_id = ?`,
      [videoId]
    );

    const formatted = formatVideoResponse(video);
    formatted.category_id = video.category_id || null;
    formatted.tags = tags;
    formatted.access = accessDetails;
    formatted.is_premium = accessDetails.isPremium;
    formatted.minimum_plan_code = accessDetails.minimumPlanCode;
    formatted.minimum_plan_name = accessDetails.minimumPlanName;
    formatted.stream_url = accessDetails.canWatch ? `/api/videos/${videoId}/stream` : null;

    return res.status(200).json({
      success: true,
      video: formatted,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/videos/:id
 * Protected route: creator edits video metadata and optional thumbnail
 */
const updateVideo = async (req, res, next) => {
  const newThumbnailFile = req.file;

  try {
    const videoId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(videoId)) {
      if (newThumbnailFile) storageService.deleteFile(storageService.getThumbnailUrl(newThumbnailFile.filename));
      return res.status(400).json({ success: false, message: 'Invalid video ID' });
    }

    // Check ownership
    const [existing] = await pool.query(
      'SELECT id, user_id, channel_id, thumbnail_url FROM videos WHERE id = ? AND status != "DELETED" LIMIT 1',
      [videoId]
    );

    if (existing.length === 0) {
      if (newThumbnailFile) storageService.deleteFile(storageService.getThumbnailUrl(newThumbnailFile.filename));
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    const video = existing[0];
    if (video.user_id !== userId && req.user.role !== 'ADMIN') {
      if (newThumbnailFile) storageService.deleteFile(storageService.getThumbnailUrl(newThumbnailFile.filename));
      return res.status(403).json({ success: false, message: 'You do not have permission to edit this video' });
    }

    const { title, description, category_id, tags, visibility } = req.body;

    const updates = [];
    const params = [];

    if (title && typeof title === 'string') {
      const cleanTitle = sanitizeText(title.trim(), 200);
      if (cleanTitle.length < 3 || cleanTitle.length > 200) {
        if (newThumbnailFile) storageService.deleteFile(storageService.getThumbnailUrl(newThumbnailFile.filename));
        return res.status(400).json({ success: false, message: 'Title must be between 3 and 200 characters' });
      }
      updates.push('title = ?');
      params.push(cleanTitle);
    }

    if (description !== undefined) {
      const cleanDescription = description ? sanitizeText(String(description).trim(), 5000) : null;
      updates.push('description = ?');
      params.push(cleanDescription);
    }

    if (visibility && ['PUBLIC', 'UNLISTED', 'PRIVATE'].includes(visibility.toUpperCase())) {
      updates.push('visibility = ?');
      params.push(visibility.toUpperCase());
    }

    let oldThumbnailToDelete = null;
    if (newThumbnailFile) {
      const newThumbUrl = storageService.getThumbnailUrl(newThumbnailFile.filename);
      updates.push('thumbnail_url = ?');
      params.push(newThumbUrl);
      oldThumbnailToDelete = video.thumbnail_url;
    }

    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      if (updates.length > 0) {
        params.push(videoId);
        await conn.query(`UPDATE videos SET ${updates.join(', ')} WHERE id = ?`, params);
      }

      // Update category if provided
      if (category_id !== undefined) {
        await conn.query('DELETE FROM video_category_map WHERE video_id = ?', [videoId]);
        const catIdNum = parseInt(category_id, 10);
        if (!isNaN(catIdNum) && catIdNum > 0) {
          await conn.query('INSERT INTO video_category_map (video_id, category_id) VALUES (?, ?)', [videoId, catIdNum]);
        }
      }

      // Update tags if provided
      if (tags !== undefined) {
        await conn.query('DELETE FROM video_tags WHERE video_id = ?', [videoId]);
        let parsedTags = [];
        if (typeof tags === 'string') {
          parsedTags = tags.split(',').map((t) => sanitizeText(t.trim(), 50)).filter((t) => t.length > 0 && t.length <= 50);
        } else if (Array.isArray(tags)) {
          parsedTags = tags.map((t) => sanitizeText(String(t).trim(), 50)).filter((t) => t.length > 0 && t.length <= 50);
        }
        parsedTags = Array.from(new Set(parsedTags)).slice(0, 10);

        for (const tagName of parsedTags) {
          const tagSlug = slugify(tagName) || `tag-${Date.now()}`;
          await conn.query(
            `INSERT INTO tags (name, slug) VALUES (?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
            [tagName, tagSlug]
          );
          const [tRow] = await conn.query('SELECT id FROM tags WHERE name = ? LIMIT 1', [tagName]);
          if (tRow.length > 0) {
            await conn.query('INSERT IGNORE INTO video_tags (video_id, tag_id) VALUES (?, ?)', [videoId, tRow[0].id]);
          }
        }
      }

      // Update access rule if provided
      if (req.body.access_type !== undefined) {
        const accType = String(req.body.access_type || 'FREE').toUpperCase();
        const cleanAccType = ['FREE', 'PREMIUM'].includes(accType) ? accType : 'FREE';
        let reqPlanId = null;
        let minCode = null;

        if (cleanAccType === 'PREMIUM') {
          const inputCode = String(req.body.minimum_plan_code || 'BRONZE').toUpperCase();
          minCode = ['BRONZE', 'SILVER', 'GOLD'].includes(inputCode) ? inputCode : 'BRONZE';
          const [pRows] = await conn.query('SELECT id FROM subscription_plans WHERE code = ? LIMIT 1', [minCode]);
          if (pRows.length > 0) reqPlanId = pRows[0].id;
        }

        await conn.query(
          `INSERT INTO video_access_rules (video_id, access_type, required_plan_id, minimum_plan_code)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             access_type = VALUES(access_type),
             required_plan_id = VALUES(required_plan_id),
             minimum_plan_code = VALUES(minimum_plan_code),
             updated_at = CURRENT_TIMESTAMP`,
          [videoId, cleanAccType, reqPlanId, minCode]
        );
      }

      await conn.commit();
      conn.release();

      // Clean up old thumbnail now that DB succeeded
      if (oldThumbnailToDelete) {
        storageService.deleteThumbnail(oldThumbnailToDelete);
      }

      return res.status(200).json({
        success: true,
        message: 'Video updated successfully',
      });
    } catch (dbErr) {
      await conn.rollback();
      conn.release();
      if (newThumbnailFile) storageService.deleteFile(storageService.getThumbnailUrl(newThumbnailFile.filename));
      throw dbErr;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/videos/:id
 * Protected route: owner or admin deletes video
 */
const deleteVideo = async (req, res, next) => {
  try {
    const videoId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(videoId)) {
      return res.status(400).json({ success: false, message: 'Invalid video ID' });
    }

    const [existing] = await pool.query(
      'SELECT id, user_id, channel_id, video_url, thumbnail_url FROM videos WHERE id = ? AND status != "DELETED" LIMIT 1',
      [videoId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    const video = existing[0];
    if (video.user_id !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this video' });
    }

    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      // Delete database record (foreign key cascades will clear mappings)
      await conn.query('DELETE FROM videos WHERE id = ?', [videoId]);

      // Decrement channel video count
      await conn.query(
        'UPDATE channels SET video_count = GREATEST(0, video_count - 1) WHERE id = ?',
        [video.channel_id]
      );

      await conn.commit();
      conn.release();

      // Clean up files on disk
      if (video.video_url) storageService.deleteVideo(video.video_url);
      if (video.thumbnail_url) storageService.deleteThumbnail(video.thumbnail_url);

      return res.status(200).json({
        success: true,
        message: 'Video deleted successfully',
      });
    } catch (dbErr) {
      await conn.rollback();
      conn.release();
      throw dbErr;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/videos/channel/:channelId
 * Public route: get published public videos for a channel
 */
const getChannelVideos = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const offset = (page - 1) * limit;

    // Resolve channel by numeric ID or handle
    let chanId = parseInt(channelId, 10);
    if (isNaN(chanId)) {
      const cleanHandle = channelId.replace(/^@/, '');
      const [chanRow] = await pool.query('SELECT id FROM channels WHERE handle = ? LIMIT 1', [cleanHandle]);
      if (chanRow.length === 0) {
        return res.status(404).json({ success: false, message: 'Channel not found' });
      }
      chanId = chanRow[0].id;
    }

    // Count
    const [countRes] = await pool.query(
      `SELECT COUNT(*) AS total 
       FROM videos 
       WHERE channel_id = ? AND visibility = 'PUBLIC' AND status IN ('READY', 'PUBLISHED')`,
      [chanId]
    );
    const total = countRes[0]?.total || 0;

    // Query videos
    const [videos] = await pool.query(
      `SELECT 
         v.id, v.title, v.description, v.video_url, v.thumbnail_url,
         v.duration_seconds, v.visibility, v.status, v.view_count, v.like_count,
         v.comment_count, v.file_size, v.mime_type, v.published_at, v.created_at,
         c.id AS channel_id, c.channel_name, c.handle AS channel_handle,
         c.avatar_url AS channel_avatar_url, c.subscriber_count AS channel_subscribers,
         (SELECT cat.name FROM video_category_map vcm JOIN video_categories cat ON vcm.category_id = cat.id WHERE vcm.video_id = v.id LIMIT 1) AS category_name,
         COALESCE(var.access_type, 'FREE') AS access_type,
         COALESCE(var.minimum_plan_code, sp.code, 'BRONZE') AS minimum_plan_code,
         sp.name AS minimum_plan_name
       FROM videos v
       INNER JOIN channels c ON v.channel_id = c.id
       LEFT JOIN video_access_rules var ON v.id = var.video_id
       LEFT JOIN subscription_plans sp ON var.required_plan_id = sp.id
       WHERE v.channel_id = ? AND v.visibility = 'PUBLIC' AND v.status IN ('READY', 'PUBLISHED')
       ORDER BY v.published_at DESC
       LIMIT ? OFFSET ?`,
      [chanId, limit, offset]
    );

    return res.status(200).json({
      success: true,
      data: videos.map(formatVideoResponse),
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + videos.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
};

const videoSearchService = require('../services/videoSearchService');

/**
 * GET /api/videos/search
 * Public catalog search endpoint with filters, sorting, and pagination
 */
const searchVideosHandler = async (req, res, next) => {
  try {
    const data = await videoSearchService.searchVideos(req.query);
    res.status(200).json({
      success: true,
      query: (req.query.q || '').trim(),
      videos: data.results,
      results: data.results,
      data: data.results,
      pagination: data.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/videos/suggestions
 * Autocomplete search suggestions
 */
const getSuggestionsHandler = async (req, res, next) => {
  try {
    const suggestions = await videoSearchService.getSearchSuggestions(req.query.q || '');
    res.status(200).json({
      success: true,
      suggestions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/videos/related/:videoId
 * Public related videos discovery
 */
const getRelatedVideosHandler = async (req, res, next) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const data = await videoSearchService.getRelatedVideos(req.params.videoId, limit);
    res.status(200).json({
      success: true,
      videos: data,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/videos/categories
 * Public endpoint to fetch categories
 */
const getCategories = async (req, res, next) => {
  try {
    const [categories] = await pool.query('SELECT id, name, slug, description FROM video_categories ORDER BY id ASC');
    res.status(200).json({
      success: true,
      data: categories,
      categories,
    });
  } catch (error) {
    next(error);
  }
};

const videoStreamService = require('../services/videoStreamService');

/**
 * GET /api/videos/:id/stream
 * Stream video media with HTTP Range support
 */
const streamVideoHandler = async (req, res, next) => {
  return videoStreamService.streamVideo(req, res, next);
};

/**
 * GET /api/videos/:id/access
 * Check access permissions for current user on target video
 */
const getVideoAccessHandler = async (req, res, next) => {
  try {
    const videoId = parseInt(req.params.id, 10);
    if (isNaN(videoId)) {
      return res.status(400).json({ success: false, message: 'Invalid video ID' });
    }
    const access = await videoAccessService.getVideoAccessDetails(videoId, req.user);
    return res.status(200).json({
      success: true,
      access,
      data: access,
    });
  } catch (err) {
    next(err);
  }
};

const downloadService = require('../services/downloadService');

/**
 * GET /api/videos/:videoId/download-access (or /:id/download-access)
 * Checks download eligibility for current user on target video (Phase 19)
 */
const getVideoDownloadAccessHandler = async (req, res, next) => {
  try {
    const rawId = req.params.videoId || req.params.id;
    const videoId = parseInt(rawId, 10);
    if (isNaN(videoId)) {
      return res.status(400).json({ success: false, message: 'Invalid video ID' });
    }

    const access = await videoAccessService.getVideoDownloadAccessDetails(videoId, req.user);
    return res.status(200).json({
      success: true,
      ...access,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/videos/:videoId/download (or /:id/download)
 * Secure, controlled file download endpoint (Phase 19)
 */
const downloadVideoHandler = async (req, res, next) => {
  try {
    const rawId = req.params.videoId || req.params.id;
    const videoId = parseInt(rawId, 10);
    if (isNaN(videoId)) {
      return res.status(400).json({ success: false, message: 'Invalid video ID' });
    }

    // 1. Authoritative access check
    const access = await videoAccessService.canUserDownloadVideo(req.user, videoId);
    if (!access.allowed) {
      return res.status(access.status || 403).json({
        success: false,
        message: access.message,
        code: access.code,
        reason: access.reason,
        requiresAuth: Boolean(access.requiresAuth),
        requiresSubscription: Boolean(access.requiresSubscription),
        planCode: access.planCode || null,
        minimumPlanCode: access.minimumPlanCode || null,
      });
    }

    // 2. Stream download via DownloadService
    return await downloadService.streamDownload(req, res, access.video, access);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  uploadVideo,
  getMyVideos,
  getVideoById,
  updateVideo,
  deleteVideo,
  getChannelVideos,
  getCategories,
  searchVideosHandler,
  getSuggestionsHandler,
  getRelatedVideosHandler,
  streamVideoHandler,
  getVideoAccessHandler,
  getVideoDownloadAccessHandler,
  downloadVideoHandler,
};
