const { pool } = require('../config/db');
const videoAccessService = require('./videoAccessService');

class PlaylistService {
  /**
   * Check if a user is allowed to create a new playlist based on active subscription plan limits.
   * Sourced directly from subscription_plans.max_playlists (0 = unlimited).
   */
  async checkUserPlaylistLimit(userId) {
    const conn = await pool.getConnection();
    try {
      // 1. Fetch user's active subscription
      const [subRows] = await conn.query(
        `SELECT us.status, sp.id AS plan_id, sp.name AS plan_name, sp.code AS plan_code, sp.max_playlists
         FROM user_subscriptions us
         JOIN subscription_plans sp ON us.plan_id = sp.id
         WHERE us.user_id = ? AND us.status = 'ACTIVE'
         ORDER BY us.id DESC
         LIMIT 1`,
        [userId]
      );

      let maxPlaylists = 10; // Default FREE tier limit
      let planCode = 'FREE';

      if (subRows.length > 0) {
        maxPlaylists = Number(subRows[0].max_playlists ?? 10);
        planCode = (subRows[0].plan_code || 'FREE').toUpperCase();
      } else {
        // Fallback to database FREE plan default
        const [freeRows] = await conn.query(
          "SELECT max_playlists, code FROM subscription_plans WHERE code = 'FREE' LIMIT 1"
        );
        if (freeRows.length > 0) {
          maxPlaylists = Number(freeRows[0].max_playlists ?? 10);
        }
      }

      // Count current playlists
      const [countRows] = await conn.query(
        'SELECT COUNT(*) AS total FROM playlists WHERE user_id = ?',
        [userId]
      );
      const currentCount = Number(countRows[0]?.total || 0);

      // Gold / VIP or max_playlists === 0 means Unlimited
      const isUnlimited = planCode === 'GOLD' || maxPlaylists === 0;

      if (isUnlimited) {
        return {
          allowed: true,
          limit: null,
          used: currentCount,
          unlimited: true,
          planCode,
        };
      }

      const allowed = currentCount < maxPlaylists;
      return {
        allowed,
        limit: maxPlaylists,
        used: currentCount,
        unlimited: false,
        planCode,
      };
    } finally {
      conn.release();
    }
  }

  /**
   * Create a new playlist for the authenticated user.
   */
  async createPlaylist(userId, { name, description = null, visibility = 'PRIVATE' }) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      const error = new Error('Playlist name is required');
      error.status = 400;
      throw error;
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 150) {
      const error = new Error('Playlist name cannot exceed 150 characters');
      error.status = 400;
      throw error;
    }

    const validVisibilities = ['PRIVATE', 'UNLISTED', 'PUBLIC'];
    const normalizedVisibility = (visibility || 'PRIVATE').toUpperCase();
    if (!validVisibilities.includes(normalizedVisibility)) {
      const error = new Error("Visibility must be 'PRIVATE', 'UNLISTED', or 'PUBLIC'");
      error.status = 400;
      throw error;
    }

    // Check plan limits
    const limitCheck = await this.checkUserPlaylistLimit(userId);
    if (!limitCheck.allowed) {
      const error = new Error('You have reached the playlist limit for your current plan.');
      error.status = 403;
      error.code = 'PLAYLIST_LIMIT_REACHED';
      error.limit = limitCheck.limit;
      error.used = limitCheck.used;
      throw error;
    }

    const trimmedDesc = description && typeof description === 'string' ? description.trim() : null;

    const [result] = await pool.query(
      `INSERT INTO playlists 
         (user_id, name, title, description, visibility, video_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())`,
      [userId, trimmedName, trimmedName, trimmedDesc, normalizedVisibility]
    );

    return {
      id: result.insertId,
      userId,
      name: trimmedName,
      title: trimmedName,
      description: trimmedDesc,
      visibility: normalizedVisibility,
      thumbnailUrl: null,
      videoCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Get all playlists owned by the authenticated user with pagination.
   */
  async getUserPlaylists(userId, { page = 1, limit = 20 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const [countRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM playlists WHERE user_id = ?',
      [userId]
    );
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limitNum) || 1;

    const [rows] = await pool.query(
      `SELECT 
         p.id,
         p.user_id AS userId,
         COALESCE(p.name, p.title) AS name,
         p.title,
         p.description,
         p.visibility,
         p.thumbnail_url AS thumbnailUrl,
         p.video_count AS videoCount,
         p.created_at AS createdAt,
         p.updated_at AS updatedAt
       FROM playlists p
       WHERE p.user_id = ?
       ORDER BY p.updated_at DESC, p.id DESC
       LIMIT ? OFFSET ?`,
      [userId, limitNum, offset]
    );

    return {
      playlists: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        name: r.name,
        title: r.title,
        description: r.description,
        visibility: r.visibility,
        thumbnailUrl: r.thumbnailUrl,
        videoCount: Number(r.videoCount || 0),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get playlist details and ordered video list respecting visibility and video access rules.
   */
  async getPlaylistDetails(playlistId, viewerUser = null) {
    const pid = parseInt(playlistId, 10);
    if (isNaN(pid)) {
      const error = new Error('Invalid playlist ID');
      error.status = 400;
      throw error;
    }

    // 1. Fetch playlist metadata and owner info
    const [pRows] = await pool.query(
      `SELECT 
         p.id,
         p.user_id AS userId,
         COALESCE(p.name, p.title) AS name,
         p.title,
         p.description,
         p.visibility,
         p.thumbnail_url AS thumbnailUrl,
         p.video_count AS videoCount,
         p.created_at AS createdAt,
         p.updated_at AS updatedAt,
         u.username AS ownerUsername,
         c.id AS ownerChannelId,
         c.channel_name AS ownerChannelName,
         c.handle AS ownerChannelHandle,
         c.avatar_url AS ownerChannelAvatar
       FROM playlists p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN channels c ON c.user_id = u.id
       WHERE p.id = ?
       LIMIT 1`,
      [pid]
    );

    if (pRows.length === 0) {
      const error = new Error('Playlist not found');
      error.status = 404;
      throw error;
    }

    const playlist = pRows[0];
    const isOwner = Boolean(viewerUser && viewerUser.id === playlist.userId);
    const isAdmin = Boolean(viewerUser && viewerUser.role === 'ADMIN');
    const isOwnerOrAdmin = isOwner || isAdmin;

    // 2. Visibility evaluation
    if (playlist.visibility === 'PRIVATE' && !isOwnerOrAdmin) {
      const error = new Error('This playlist is private');
      error.status = 403;
      error.code = 'PRIVATE_PLAYLIST';
      throw error;
    }

    // 3. Fetch ordered videos with watch history progress
    const viewerId = viewerUser ? viewerUser.id : null;
    const [vRows] = await pool.query(
      `SELECT 
         pv.position,
         pv.added_at AS addedAt,
         v.id AS videoId,
         v.title AS videoTitle,
         v.description AS videoDescription,
         v.thumbnail_url AS videoThumbnailUrl,
         v.duration_seconds AS durationSeconds,
         v.view_count AS viewCount,
         v.status AS videoStatus,
         v.visibility AS videoVisibility,
         v.user_id AS videoUserId,
         c.id AS channelId,
         c.channel_name AS channelName,
         c.handle AS channelHandle,
         c.avatar_url AS channelAvatarUrl,
         wh.progress_seconds AS progressSeconds,
         wh.completed AS watchCompleted
       FROM playlist_videos pv
       JOIN videos v ON pv.video_id = v.id
       LEFT JOIN channels c ON v.channel_id = c.id
       LEFT JOIN watch_history wh ON wh.video_id = v.id AND wh.user_id = ?
       WHERE pv.playlist_id = ? AND v.status != 'DELETED'
       ORDER BY pv.position ASC, pv.added_at ASC`,
      [viewerId, pid]
    );

    // 4. Evaluate access for each video (Phase 18 video access rules)
    const formattedVideos = [];
    for (const row of vRows) {
      const isVideoOwner = Boolean(viewerUser && viewerUser.id === row.videoUserId);
      const isVideoOwnerOrAdmin = isVideoOwner || isAdmin;

      // Handle private videos inside playlist
      if (row.videoVisibility === 'PRIVATE' && !isVideoOwnerOrAdmin) {
        if (isOwner) {
          // Playlist owner sees placeholder so playlist list order is not broken
          formattedVideos.push({
            id: row.videoId,
            title: '[Private Video]',
            description: null,
            thumbnailUrl: null,
            durationSeconds: 0,
            channel: null,
            position: row.position,
            addedAt: row.addedAt,
            isUnavailable: true,
            access: {
              canWatch: false,
              requiresAuth: true,
              message: 'This video is private',
            },
          });
        }
        // Exclude for outside viewers
        continue;
      }

      // Check access permission via videoAccessService
      let accessDetails = { canWatch: true, isPremium: false };
      try {
        accessDetails = await videoAccessService.getVideoAccessDetails(row.videoId, viewerUser);
      } catch (err) {
        accessDetails = { canWatch: false, isPremium: false };
      }

      const dur = Number(row.durationSeconds || 0);
      const prog = Number(row.progressSeconds || 0);
      const progressPercent = dur > 0 ? Math.min(100, Math.round((prog / dur) * 100)) : 0;

      formattedVideos.push({
        id: row.videoId,
        title: row.videoTitle,
        description: row.videoDescription,
        thumbnailUrl: row.videoThumbnailUrl,
        durationSeconds: dur,
        viewCount: Number(row.viewCount || 0),
        position: row.position,
        addedAt: row.addedAt,
        channel: row.channelId
          ? {
              id: row.channelId,
              name: row.channelName,
              handle: row.channelHandle,
              avatarUrl: row.channelAvatarUrl,
            }
          : null,
        watchProgress: viewerUser
          ? {
              progressSeconds: prog,
              progressPercent,
              completed: Boolean(row.watchCompleted),
            }
          : null,
        access: {
          canWatch: Boolean(accessDetails.canWatch),
          isPremium: Boolean(accessDetails.isPremium),
          minimumPlanCode: accessDetails.minimumPlanCode || null,
          requiresAuth: Boolean(accessDetails.requiresAuth),
          requiresSubscription: Boolean(accessDetails.requiresSubscription),
        },
      });
    }

    return {
      id: playlist.id,
      userId: playlist.userId,
      name: playlist.name,
      title: playlist.title,
      description: playlist.description,
      visibility: playlist.visibility,
      thumbnailUrl: playlist.thumbnailUrl || (formattedVideos[0]?.thumbnailUrl ?? null),
      videoCount: formattedVideos.length,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
      isOwner,
      owner: {
        id: playlist.userId,
        username: playlist.ownerUsername,
        channel: playlist.ownerChannelId
          ? {
              id: playlist.ownerChannelId,
              name: playlist.ownerChannelName,
              handle: playlist.ownerChannelHandle,
              avatarUrl: playlist.ownerChannelAvatar,
            }
          : null,
      },
      videos: formattedVideos,
    };
  }

  /**
   * Update playlist metadata. Only owner can update.
   */
  async updatePlaylist(playlistId, userId, { name, description, visibility }) {
    const pid = parseInt(playlistId, 10);
    if (isNaN(pid)) {
      const error = new Error('Invalid playlist ID');
      error.status = 400;
      throw error;
    }

    const [rows] = await pool.query('SELECT id, user_id FROM playlists WHERE id = ? LIMIT 1', [pid]);
    if (rows.length === 0) {
      const error = new Error('Playlist not found');
      error.status = 404;
      throw error;
    }

    if (rows[0].user_id !== userId) {
      const error = new Error('You do not have permission to modify this playlist');
      error.status = 403;
      throw error;
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        const error = new Error('Playlist name cannot be empty');
        error.status = 400;
        throw error;
      }
      const trimmedName = name.trim();
      updates.push('name = ?', 'title = ?');
      values.push(trimmedName, trimmedName);
    }

    if (description !== undefined) {
      const trimmedDesc = description && typeof description === 'string' ? description.trim() : null;
      updates.push('description = ?');
      values.push(trimmedDesc);
    }

    if (visibility !== undefined) {
      const normalizedVis = (visibility || '').toUpperCase();
      if (!['PRIVATE', 'UNLISTED', 'PUBLIC'].includes(normalizedVis)) {
        const error = new Error("Visibility must be 'PRIVATE', 'UNLISTED', or 'PUBLIC'");
        error.status = 400;
        throw error;
      }
      updates.push('visibility = ?');
      values.push(normalizedVis);
    }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      values.push(pid);
      await pool.query(`UPDATE playlists SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    return this.getPlaylistDetails(pid, { id: userId });
  }

  /**
   * Delete playlist. Only owner can delete.
   */
  async deletePlaylist(playlistId, userId) {
    const pid = parseInt(playlistId, 10);
    if (isNaN(pid)) {
      const error = new Error('Invalid playlist ID');
      error.status = 400;
      throw error;
    }

    const [rows] = await pool.query('SELECT id, user_id FROM playlists WHERE id = ? LIMIT 1', [pid]);
    if (rows.length === 0) {
      const error = new Error('Playlist not found');
      error.status = 404;
      throw error;
    }

    if (rows[0].user_id !== userId) {
      const error = new Error('You do not have permission to delete this playlist');
      error.status = 403;
      throw error;
    }

    await pool.query('DELETE FROM playlists WHERE id = ?', [pid]);
    return { success: true, message: 'Playlist deleted successfully' };
  }

  /**
   * Add video to playlist.
   */
  async addVideoToPlaylist(playlistId, userId, videoId) {
    const pid = parseInt(playlistId, 10);
    const vid = parseInt(videoId, 10);

    if (isNaN(pid) || isNaN(vid)) {
      const error = new Error('Invalid playlist or video ID');
      error.status = 400;
      throw error;
    }

    // Verify playlist ownership
    const [pRows] = await pool.query(
      'SELECT id, user_id, thumbnail_url FROM playlists WHERE id = ? LIMIT 1',
      [pid]
    );
    if (pRows.length === 0) {
      const error = new Error('Playlist not found');
      error.status = 404;
      throw error;
    }
    if (pRows[0].user_id !== userId) {
      const error = new Error('You do not have permission to modify this playlist');
      error.status = 403;
      throw error;
    }

    // Verify video exists
    const [vRows] = await pool.query(
      "SELECT id, thumbnail_url, status FROM videos WHERE id = ? AND status != 'DELETED' LIMIT 1",
      [vid]
    );
    if (vRows.length === 0) {
      const error = new Error('Video not found or is unavailable');
      error.status = 404;
      throw error;
    }

    // Check duplicate
    const [dupRows] = await pool.query(
      'SELECT 1 FROM playlist_videos WHERE playlist_id = ? AND video_id = ? LIMIT 1',
      [pid, vid]
    );
    if (dupRows.length > 0) {
      return {
        success: true,
        alreadyInPlaylist: true,
        message: 'Video is already in this playlist',
      };
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Compute next position
      const [posRows] = await conn.query(
        'SELECT COALESCE(MAX(position), 0) + 1 AS nextPos FROM playlist_videos WHERE playlist_id = ?',
        [pid]
      );
      const nextPos = Number(posRows[0]?.nextPos || 1);

      await conn.query(
        'INSERT INTO playlist_videos (playlist_id, video_id, position, added_at) VALUES (?, ?, ?, NOW())',
        [pid, vid, nextPos]
      );

      // Recalculate video_count and thumbnail
      const [countRows] = await conn.query(
        'SELECT COUNT(*) AS total FROM playlist_videos WHERE playlist_id = ?',
        [pid]
      );
      const newCount = Number(countRows[0]?.total || 0);

      const hasThumbnail = Boolean(pRows[0].thumbnail_url);
      const videoThumb = vRows[0].thumbnail_url;

      if (!hasThumbnail && videoThumb) {
        await conn.query(
          'UPDATE playlists SET video_count = ?, thumbnail_url = ?, updated_at = NOW() WHERE id = ?',
          [newCount, videoThumb, pid]
        );
      } else {
        await conn.query('UPDATE playlists SET video_count = ?, updated_at = NOW() WHERE id = ?', [
          newCount,
          pid,
        ]);
      }

      await conn.commit();

      return {
        success: true,
        alreadyInPlaylist: false,
        message: 'Video added to playlist',
        position: nextPos,
        videoCount: newCount,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Remove video from playlist.
   */
  async removeVideoFromPlaylist(playlistId, userId, videoId) {
    const pid = parseInt(playlistId, 10);
    const vid = parseInt(videoId, 10);

    if (isNaN(pid) || isNaN(vid)) {
      const error = new Error('Invalid playlist or video ID');
      error.status = 400;
      throw error;
    }

    const [pRows] = await pool.query('SELECT id, user_id FROM playlists WHERE id = ? LIMIT 1', [pid]);
    if (pRows.length === 0) {
      const error = new Error('Playlist not found');
      error.status = 404;
      throw error;
    }
    if (pRows[0].user_id !== userId) {
      const error = new Error('You do not have permission to modify this playlist');
      error.status = 403;
      throw error;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query('DELETE FROM playlist_videos WHERE playlist_id = ? AND video_id = ?', [
        pid,
        vid,
      ]);

      // Re-normalize positions 1..N
      const [remaining] = await conn.query(
        'SELECT video_id FROM playlist_videos WHERE playlist_id = ? ORDER BY position ASC, added_at ASC',
        [pid]
      );

      for (let i = 0; i < remaining.length; i++) {
        await conn.query(
          'UPDATE playlist_videos SET position = ? WHERE playlist_id = ? AND video_id = ?',
          [i + 1, pid, remaining[i].video_id]
        );
      }

      const newCount = remaining.length;

      // Update thumbnail to next video or null
      let newThumb = null;
      if (newCount > 0) {
        const [nextThumbRows] = await conn.query(
          `SELECT v.thumbnail_url 
           FROM playlist_videos pv 
           JOIN videos v ON pv.video_id = v.id 
           WHERE pv.playlist_id = ? 
           ORDER BY pv.position ASC 
           LIMIT 1`,
          [pid]
        );
        newThumb = nextThumbRows[0]?.thumbnail_url || null;
      }

      await conn.query(
        'UPDATE playlists SET video_count = ?, thumbnail_url = ?, updated_at = NOW() WHERE id = ?',
        [newCount, newThumb, pid]
      );

      await conn.commit();

      return {
        success: true,
        message: 'Video removed from playlist',
        videoCount: newCount,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Reorder playlist videos transactionally.
   */
  async reorderPlaylist(playlistId, userId, videoIds) {
    const pid = parseInt(playlistId, 10);
    if (isNaN(pid)) {
      const error = new Error('Invalid playlist ID');
      error.status = 400;
      throw error;
    }

    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      const error = new Error('videoIds must be a non-empty array of video IDs');
      error.status = 400;
      throw error;
    }

    // Verify ownership
    const [pRows] = await pool.query('SELECT id, user_id FROM playlists WHERE id = ? LIMIT 1', [pid]);
    if (pRows.length === 0) {
      const error = new Error('Playlist not found');
      error.status = 404;
      throw error;
    }
    if (pRows[0].user_id !== userId) {
      const error = new Error('You do not have permission to modify this playlist');
      error.status = 403;
      throw error;
    }

    // Check duplicates in input
    const uniqueIds = Array.from(new Set(videoIds.map((id) => parseInt(id, 10))));
    if (uniqueIds.some(isNaN) || uniqueIds.length !== videoIds.length) {
      const error = new Error('videoIds array contains invalid or duplicate IDs');
      error.status = 400;
      throw error;
    }

    // Verify all videos belong to this playlist
    const [existing] = await pool.query(
      'SELECT video_id FROM playlist_videos WHERE playlist_id = ?',
      [pid]
    );
    const existingIds = new Set(existing.map((r) => Number(r.video_id)));

    for (const id of uniqueIds) {
      if (!existingIds.has(id)) {
        const error = new Error(`Video ID ${id} does not belong to this playlist`);
        error.status = 400;
        throw error;
      }
    }

    if (uniqueIds.length !== existingIds.size) {
      const error = new Error('Reorder list must contain all videos in the playlist');
      error.status = 400;
      throw error;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (let i = 0; i < uniqueIds.length; i++) {
        await conn.query(
          'UPDATE playlist_videos SET position = ? WHERE playlist_id = ? AND video_id = ?',
          [i + 1, pid, uniqueIds[i]]
        );
      }

      await conn.query('UPDATE playlists SET updated_at = NOW() WHERE id = ?', [pid]);

      await conn.commit();
      return { success: true, message: 'Playlist reordered successfully' };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Get all user playlists with a flag indicating if a specific video is currently included.
   */
  async getUserPlaylistsWithVideoStatus(userId, videoId) {
    const vid = parseInt(videoId, 10);
    if (isNaN(vid)) {
      const error = new Error('Invalid video ID');
      error.status = 400;
      throw error;
    }

    const [rows] = await pool.query(
      `SELECT 
         p.id,
         COALESCE(p.name, p.title) AS name,
         p.visibility,
         p.video_count AS videoCount,
         p.thumbnail_url AS thumbnailUrl,
         IF(pv.video_id IS NOT NULL, 1, 0) AS containsVideo
       FROM playlists p
       LEFT JOIN playlist_videos pv ON p.id = pv.playlist_id AND pv.video_id = ?
       WHERE p.user_id = ?
       ORDER BY p.updated_at DESC, p.id DESC`,
      [vid, userId]
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      visibility: r.visibility,
      videoCount: Number(r.videoCount || 0),
      thumbnailUrl: r.thumbnailUrl,
      containsVideo: Boolean(r.containsVideo),
    }));
  }
}

module.exports = new PlaylistService();
