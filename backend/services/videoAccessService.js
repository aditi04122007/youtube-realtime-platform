const { pool } = require('../config/db');
const downloadQuotaService = require('./downloadQuotaService');

/**
 * Subscription Plan Rank Hierarchy
 * FREE: 1, BRONZE: 2, SILVER: 3, GOLD: 4
 */
const PLAN_RANKS = Object.freeze({
  FREE: 1,
  BRONZE: 2,
  SILVER: 3,
  GOLD: 4,
});

class VideoAccessService {
  /**
   * Authoritative access evaluation for streaming and viewing permissions.
   *
   * @param {Object|null} user - Authenticated user payload from req.user (or null for guest)
   * @param {number|string} videoId - Video ID to evaluate
   * @returns {Promise<Object>} Access evaluation result with status, code, canWatch, and metadata
   */
  async canUserAccessVideo(user, videoId) {
    const vid = parseInt(videoId, 10);
    if (isNaN(vid)) {
      return {
        canWatch: false,
        status: 400,
        message: 'Invalid video ID',
        code: 'INVALID_VIDEO_ID',
      };
    }

    // 1. Fetch video and attached access rule (defaults to FREE if no rule row exists)
    const [rows] = await pool.query(
      `SELECT 
         v.id, v.user_id, v.visibility, v.status,
         COALESCE(var.access_type, 'FREE') AS access_type,
         var.required_plan_id,
         COALESCE(var.minimum_plan_code, sp.code, 'BRONZE') AS minimum_plan_code,
         sp.name AS minimum_plan_name,
         sp.price AS minimum_plan_price
       FROM videos v
       LEFT JOIN video_access_rules var ON v.id = var.video_id
       LEFT JOIN subscription_plans sp ON var.required_plan_id = sp.id
       WHERE v.id = ? AND v.status != 'DELETED'
       LIMIT 1`,
      [vid]
    );

    if (rows.length === 0) {
      return {
        canWatch: false,
        status: 404,
        message: 'Video not found',
        code: 'NOT_FOUND',
      };
    }

    const video = rows[0];
    const isOwner = Boolean(user && user.id === video.user_id);
    const isAdmin = Boolean(user && user.role === 'ADMIN');
    const isOwnerOrAdmin = isOwner || isAdmin;

    // 2. Video privacy and processing gates
    if (video.visibility === 'PRIVATE' && !isOwnerOrAdmin) {
      return {
        canWatch: false,
        status: 403,
        message: 'This video is private',
        code: 'PRIVATE_VIDEO',
      };
    }

    if (video.status === 'PROCESSING' && !isOwnerOrAdmin) {
      return {
        canWatch: false,
        status: 403,
        message: 'This video is currently processing',
        code: 'PROCESSING_VIDEO',
      };
    }

    // 3. FREE videos - open access for all viewers
    const isPremium = video.access_type === 'PREMIUM';
    if (!isPremium) {
      return {
        canWatch: true,
        accessType: 'FREE',
        isPremium: false,
        minimumPlanCode: null,
        minimumPlanName: null,
        videoId: vid,
      };
    }

    // 4. PREMIUM videos - Owner and Admin bypass
    if (isOwnerOrAdmin) {
      return {
        canWatch: true,
        accessType: 'PREMIUM',
        isPremium: true,
        isOwnerOrAdmin: true,
        minimumPlanCode: video.minimum_plan_code,
        minimumPlanName: video.minimum_plan_name,
        videoId: vid,
      };
    }

    // 5. PREMIUM videos - Guest access denied (401 Unauthorized)
    if (!user) {
      return {
        canWatch: false,
        status: 401,
        message: 'Sign in to watch this premium video',
        code: 'AUTH_REQUIRED',
        accessType: 'PREMIUM',
        isPremium: true,
        requiresAuth: true,
        requiresSubscription: false,
        minimumPlanCode: video.minimum_plan_code,
        minimumPlanName: video.minimum_plan_name,
        videoId: vid,
      };
    }

    // 6. PREMIUM videos - Authenticated user active subscription verification
    const [subRows] = await pool.query(
      `SELECT 
         us.id, us.user_id, us.plan_id, us.status, us.end_date,
         sp.code AS plan_code, sp.name AS plan_name, sp.premium_access, sp.price
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = ?
         AND us.status = 'ACTIVE'
         AND (us.end_date IS NULL OR us.end_date >= NOW())
       ORDER BY sp.price DESC, us.id DESC
       LIMIT 1`,
      [user.id]
    );

    const activeSub = subRows[0];

    // Missing subscription or subscription without premium access (e.g. FREE tier)
    if (!activeSub || Number(activeSub.premium_access) !== 1) {
      return {
        canWatch: false,
        status: 403,
        message: 'A premium subscription is required to watch this video',
        code: 'PREMIUM_REQUIRED',
        accessType: 'PREMIUM',
        isPremium: true,
        requiresAuth: false,
        requiresSubscription: true,
        minimumPlanCode: video.minimum_plan_code,
        minimumPlanName: video.minimum_plan_name,
        userPlanCode: activeSub ? activeSub.plan_code : 'FREE',
        videoId: vid,
      };
    }

    // 7. Tier hierarchy check
    const userRank = PLAN_RANKS[activeSub.plan_code] || 1;
    const requiredRank = PLAN_RANKS[video.minimum_plan_code] || 2; // Default BRONZE = 2

    if (userRank < requiredRank) {
      return {
        canWatch: false,
        status: 403,
        message: `This video requires a ${video.minimum_plan_name || video.minimum_plan_code} plan or higher`,
        code: 'UPGRADE_REQUIRED',
        accessType: 'PREMIUM',
        isPremium: true,
        requiresAuth: false,
        requiresSubscription: true,
        minimumPlanCode: video.minimum_plan_code,
        minimumPlanName: video.minimum_plan_name,
        userPlanCode: activeSub.plan_code,
        videoId: vid,
      };
    }

    // Subscription satisfies or exceeds the minimum tier requirement
    return {
      canWatch: true,
      accessType: 'PREMIUM',
      isPremium: true,
      userPlanCode: activeSub.plan_code,
      minimumPlanCode: video.minimum_plan_code,
      minimumPlanName: video.minimum_plan_name,
      videoId: vid,
    };
  }

  /**
   * Returns safe public metadata describing video access permissions for UI rendering.
   *
   * @param {number|string} videoId - Target video ID
   * @param {Object|null} user - Current user (or null)
   */
  async getVideoAccessDetails(videoId, user) {
    const access = await this.canUserAccessVideo(user, videoId);

    return {
      videoId: access.videoId || parseInt(videoId, 10),
      accessType: access.accessType || 'FREE',
      isPremium: Boolean(access.isPremium),
      minimumPlanCode: access.minimumPlanCode || null,
      minimumPlanName: access.minimumPlanName || null,
      canWatch: Boolean(access.canWatch),
      requiresAuth: Boolean(access.requiresAuth),
      requiresSubscription: Boolean(access.requiresSubscription),
      reason: access.message || null,
      code: access.code || 'ACCESS_GRANTED',
      userPlanCode: access.userPlanCode || (user ? 'FREE' : null),
      isOwnerOrAdmin: Boolean(access.isOwnerOrAdmin),
    };
  }

  /**
   * Sets or updates the access rule for a video with ownership authorization.
   *
   * @param {number|string} videoId - Video ID
   * @param {Object} options - { accessType: 'FREE'|'PREMIUM', minimumPlanCode: 'BRONZE'|'SILVER'|'GOLD' }
   * @param {number} actorUserId - User ID making the change
   * @param {string} actorRole - Role of the user ('USER', 'ADMIN', etc.)
   */
  async setVideoAccessRule(videoId, { accessType = 'FREE', minimumPlanCode = 'BRONZE' }, actorUserId, actorRole) {
    const vid = parseInt(videoId, 10);
    if (isNaN(vid)) {
      const err = new Error('Invalid video ID');
      err.status = 400;
      throw err;
    }

    // 1. Check video ownership
    const [videos] = await pool.query(
      'SELECT id, user_id FROM videos WHERE id = ? AND status != "DELETED" LIMIT 1',
      [vid]
    );

    if (videos.length === 0) {
      const err = new Error('Video not found');
      err.status = 404;
      throw err;
    }

    const video = videos[0];
    if (video.user_id !== actorUserId && actorRole !== 'ADMIN') {
      const err = new Error('You do not have permission to modify access rules for this video');
      err.status = 403;
      throw err;
    }

    // 2. Normalize and validate accessType
    const normalizedType = String(accessType || 'FREE').toUpperCase();
    if (!['FREE', 'PREMIUM'].includes(normalizedType)) {
      const err = new Error("Invalid access_type. Must be 'FREE' or 'PREMIUM'");
      err.status = 400;
      throw err;
    }

    let requiredPlanId = null;
    let normalizedPlanCode = null;

    if (normalizedType === 'PREMIUM') {
      normalizedPlanCode = String(minimumPlanCode || 'BRONZE').toUpperCase();
      if (!['BRONZE', 'SILVER', 'GOLD'].includes(normalizedPlanCode)) {
        normalizedPlanCode = 'BRONZE';
      }

      const [plans] = await pool.query(
        'SELECT id FROM subscription_plans WHERE code = ? LIMIT 1',
        [normalizedPlanCode]
      );

      if (plans.length > 0) {
        requiredPlanId = plans[0].id;
      }
    }

    // 3. Upsert rule
    await pool.query(
      `INSERT INTO video_access_rules (video_id, access_type, required_plan_id, minimum_plan_code)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         access_type = VALUES(access_type),
         required_plan_id = VALUES(required_plan_id),
         minimum_plan_code = VALUES(minimum_plan_code),
         updated_at = CURRENT_TIMESTAMP`,
      [vid, normalizedType, requiredPlanId, normalizedPlanCode]
    );

    return {
      videoId: vid,
      accessType: normalizedType,
      minimumPlanCode: normalizedPlanCode,
      requiredPlanId,
    };
  }

  /**
   * Authoritative download authorization evaluation.
   *
   * @param {Object|null} user - Authenticated user object from req.user
   * @param {number|string} videoId - Video ID to evaluate for download
   * @returns {Promise<Object>} Structured evaluation { allowed, canDownload, status, code, reason, message, planCode, downloadLimit, video }
   */
  async canUserDownloadVideo(user, videoId) {
    const vid = parseInt(videoId, 10);
    if (isNaN(vid)) {
      return {
        allowed: false,
        canDownload: false,
        status: 400,
        code: 'INVALID_VIDEO_ID',
        reason: 'INVALID_VIDEO_ID',
        message: 'Invalid video ID',
      };
    }

    // 1. Authentication check: Downloads strictly require an authenticated user
    if (!user || !user.id) {
      return {
        allowed: false,
        canDownload: false,
        status: 401,
        code: 'AUTH_REQUIRED',
        reason: 'SIGN_IN_REQUIRED',
        message: 'Sign in to download this video',
        requiresAuth: true,
        requiresSubscription: false,
      };
    }

    // 2. Fetch video details from database
    const [rows] = await pool.query(
      `SELECT 
         v.id, v.user_id, v.title, v.video_url, v.duration_seconds,
         v.visibility, v.status, v.file_size, v.mime_type
       FROM videos v
       WHERE v.id = ? AND v.status != 'DELETED'
       LIMIT 1`,
      [vid]
    );

    if (rows.length === 0) {
      return {
        allowed: false,
        canDownload: false,
        status: 404,
        code: 'NOT_FOUND',
        reason: 'VIDEO_NOT_FOUND',
        message: 'Video not found',
      };
    }

    const video = rows[0];
    const isOwner = Number(user.id) === Number(video.user_id);
    const isAdmin = user.role === 'ADMIN';

    // 3. Status checks: Video must be in a ready state (not PROCESSING)
    if (video.status === 'PROCESSING') {
      return {
        allowed: false,
        canDownload: false,
        status: 403,
        code: 'PROCESSING_VIDEO',
        reason: 'PROCESSING_VIDEO',
        message: 'This video is currently processing and not ready for download',
      };
    }

    // 4. Privacy checks: Private videos can never be downloaded by non-owners
    if (video.visibility === 'PRIVATE' && !isOwner && !isAdmin) {
      return {
        allowed: false,
        canDownload: false,
        status: 403,
        code: 'PRIVATE_VIDEO',
        reason: 'PRIVATE_VIDEO',
        message: 'This video is private and cannot be downloaded',
      };
    }

    // 5. Explicit Creator Management Rule (STEP 15):
    // A creator is allowed to download their own uploaded video for management / backup purposes
    if (isOwner) {
      return {
        allowed: true,
        canDownload: true,
        status: 200,
        code: 'DOWNLOAD_ALLOWED',
        reason: 'DOWNLOAD_ALLOWED',
        message: 'Download authorized (creator management)',
        isOwner: true,
        planCode: null,
        video,
      };
    }

    // 6. Viewing Access Check (STEP 13 & 14):
    // Non-owner viewers must first satisfy standard viewing permissions (e.g. premium tier access)
    const viewingAccess = await this.canUserAccessVideo(user, vid);
    if (!viewingAccess.canWatch) {
      return {
        allowed: false,
        canDownload: false,
        status: viewingAccess.status || 403,
        code: viewingAccess.code || 'PREMIUM_REQUIRED',
        reason: viewingAccess.code || 'PREMIUM_REQUIRED',
        message: viewingAccess.message || 'You must have access to watch this video before you can download it',
        requiresAuth: Boolean(viewingAccess.requiresAuth),
        requiresSubscription: true,
        minimumPlanCode: viewingAccess.minimumPlanCode || null,
        minimumPlanName: viewingAccess.minimumPlanName || null,
      };
    }

    // 7. Active Subscription & Plan Download Eligibility (STEP 3 & 21):
    // Must have an active subscription with download_limit > 0
    const [subRows] = await pool.query(
      `SELECT 
         us.id, us.user_id, us.plan_id, us.status, us.end_date,
         sp.code AS plan_code, sp.name AS plan_name, sp.download_limit, sp.price
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = ?
         AND us.status = 'ACTIVE'
         AND (us.end_date IS NULL OR us.end_date >= NOW())
       ORDER BY sp.price DESC, us.id DESC
       LIMIT 1`,
      [user.id]
    );

    const activeSub = subRows[0];

    // If no active subscription or download_limit is 0 / null
    if (!activeSub) {
      return {
        allowed: false,
        canDownload: false,
        status: 403,
        code: 'DOWNLOADS_NOT_INCLUDED',
        reason: 'DOWNLOADS_NOT_INCLUDED',
        message: 'Downloads are not included in your current plan',
        requiresSubscription: true,
        planCode: 'FREE',
        downloadLimit: 0,
      };
    }

    const downloadLimit = Number(activeSub.download_limit || 0);
    if (downloadLimit <= 0) {
      return {
        allowed: false,
        canDownload: false,
        status: 403,
        code: 'DOWNLOADS_NOT_INCLUDED',
        reason: 'DOWNLOADS_NOT_INCLUDED',
        message: 'Downloads are not included in your current plan',
        requiresSubscription: true,
        planCode: activeSub.plan_code,
        downloadLimit: 0,
      };
    }

    // 8. Phase 20 Monthly Download Quota Check
    const quotaCheck = await downloadQuotaService.canConsumeDownload(user.id);
    if (!quotaCheck.allowed) {
      return {
        allowed: false,
        canDownload: false,
        status: 403,
        code: quotaCheck.reason || 'QUOTA_EXHAUSTED',
        reason: quotaCheck.reason || 'QUOTA_EXHAUSTED',
        message: quotaCheck.message || 'Monthly download quota reached for your plan',
        requiresSubscription: quotaCheck.reason === 'DOWNLOADS_NOT_INCLUDED',
        planCode: quotaCheck.quota?.planCode || activeSub.plan_code,
        downloadLimit: quotaCheck.quota?.limit ?? downloadLimit,
        quota: quotaCheck.quota,
      };
    }

    // All download checks passed!
    return {
      allowed: true,
      canDownload: true,
      status: 200,
      code: 'DOWNLOAD_ALLOWED',
      reason: 'DOWNLOAD_ALLOWED',
      message: 'Download authorized',
      planCode: activeSub.plan_code,
      planName: activeSub.plan_name,
      downloadLimit,
      quota: quotaCheck.quota,
      video,
    };
  }

  /**
   * Returns safe public metadata describing download permissions for UI rendering.
   *
   * @param {number|string} videoId - Target video ID
   * @param {Object|null} user - Current user (or null)
   */
  async getVideoDownloadAccessDetails(videoId, user) {
    const downloadCheck = await this.canUserDownloadVideo(user, videoId);

    // If user is logged in, attach their quota so UI can display downloads remaining
    let userQuota = downloadCheck.quota || null;
    if (!userQuota && user && user.id) {
      try {
        userQuota = await downloadQuotaService.getDownloadQuota(user.id);
      } catch (qErr) {
        // Fallback silently
      }
    }

    return {
      videoId: parseInt(videoId, 10),
      canDownload: Boolean(downloadCheck.canDownload),
      reason: downloadCheck.reason || downloadCheck.code || 'DOWNLOAD_ALLOWED',
      message: downloadCheck.message || '',
      code: downloadCheck.code,
      planCode: downloadCheck.planCode || (user ? 'FREE' : null),
      requiresAuth: Boolean(downloadCheck.requiresAuth),
      requiresSubscription: Boolean(downloadCheck.requiresSubscription),
      isOwner: Boolean(downloadCheck.isOwner),
      quota: userQuota,
    };
  }
}

module.exports = new VideoAccessService();
