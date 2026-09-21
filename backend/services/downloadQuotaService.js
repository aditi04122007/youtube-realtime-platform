const { pool } = require('../config/db');

class DownloadQuotaService {
  /**
   * Calculates the current monthly quota billing period for a user.
   * - For monthly subscriptions: advances month-by-month from subscription start_date.
   * - For yearly subscriptions: monthly allowance resets every month from start_date.
   * - For free/no-subscription: calendar month (1st of month to 1st of next month).
   *
   * @param {Object|null} activeSub - Active subscription row (with start_date, end_date, billing_cycle)
   * @param {Date} [now=new Date()] - Reference date
   * @returns {{ periodStart: Date, periodEnd: Date }}
   */
  getQuotaPeriod(activeSub, now = new Date()) {
    if (!activeSub || !activeSub.start_date) {
      // Calendar month fallback
      const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
      return { periodStart, periodEnd };
    }

    const subStart = new Date(activeSub.start_date);
    let pStart = new Date(subStart.getTime() - 10000); // 10s grace window for timestamp precision skew
    let pEnd = new Date(subStart);
    pEnd.setMonth(pEnd.getMonth() + 1);

    // If now is ahead of the first monthly period, walk forward monthly cycles
    while (pEnd <= now) {
      pStart = new Date(pEnd);
      pEnd = new Date(pStart);
      pEnd.setMonth(pEnd.getMonth() + 1);
    }

    return { periodStart: pStart, periodEnd: pEnd };
  }

  /**
   * Authoritative download quota inspection.
   * Source of truth: subscription_plans.download_limit
   *
   * @param {number} userId - Authenticated user ID
   * @returns {Promise<Object>} Structured quota object
   */
  async getDownloadQuota(userId) {
    // 1. Fetch user's active subscription and attached plan
    const [subRows] = await pool.query(
      `SELECT 
         us.id, us.user_id, us.plan_id, us.status, us.start_date, us.end_date, us.billing_cycle,
         sp.code AS plan_code, sp.name AS plan_name, sp.download_limit, sp.price
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = ?
         AND us.status = 'ACTIVE'
         AND (us.end_date IS NULL OR us.end_date >= NOW())
       ORDER BY sp.price DESC, us.id DESC
       LIMIT 1`,
      [userId]
    );

    const activeSub = subRows[0] || null;
    const { periodStart, periodEnd } = this.getQuotaPeriod(activeSub);

    // 2. Query usage in current period
    const used = await this.getDownloadUsage(userId, periodStart, periodEnd);

    // 3. Handle Free or no subscription
    if (!activeSub) {
      return {
        planCode: 'FREE',
        planName: 'Free Plan',
        limit: 0,
        used: 0,
        remaining: 0,
        unlimited: false,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      };
    }

    const planCode = String(activeSub.plan_code || 'FREE').toUpperCase();
    const rawLimit = activeSub.download_limit;

    // 4. Handle Unlimited plans (GOLD or limit >= 500 or null)
    const isGold = planCode === 'GOLD';
    const isExplicitUnlimited = rawLimit === null;

    if (isGold || isExplicitUnlimited) {
      return {
        planCode,
        planName: activeSub.plan_name,
        limit: null,
        used,
        remaining: null,
        unlimited: true,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      };
    }

    // 5. Standard limited plans (BRONZE, SILVER, etc.)
    const limit = Number(rawLimit || 0);
    const remaining = Math.max(0, limit - used);

    return {
      planCode,
      planName: activeSub.plan_name,
      limit,
      used,
      remaining,
      unlimited: false,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    };
  }

  /**
   * Count downloads consumed in the specified quota period.
   * Note: Soft-deleted download history records STILL count against quota
   * to ensure deleting history never refunds quota.
   *
   * @param {number} userId - User ID
   * @param {Date} periodStart - Period start date
   * @param {Date} periodEnd - Period end date
   * @param {Object} [executor=pool] - Query executor (pool or connection)
   * @returns {Promise<number>} Number of consumed downloads
   */
  async getDownloadUsage(userId, periodStart, periodEnd, executor = pool) {
    const [rows] = await executor.query(
      `SELECT COUNT(*) AS totalUsed
       FROM download_history
       WHERE user_id = ?
         AND status IN ('STARTED', 'COMPLETED')
         AND downloaded_at >= ?
         AND downloaded_at < ?`,
      [userId, periodStart, periodEnd]
    );

    return Number(rows[0]?.totalUsed || 0);
  }

  /**
   * Quick pre-check if user has download quota available.
   *
   * @param {number} userId - User ID
   * @returns {Promise<{ allowed: boolean, reason?: string, quota: Object }>}
   */
  async canConsumeDownload(userId) {
    const quota = await this.getDownloadQuota(userId);

    if (quota.unlimited) {
      return { allowed: true, quota };
    }

    if (quota.limit <= 0) {
      return {
        allowed: false,
        reason: 'DOWNLOADS_NOT_INCLUDED',
        message: 'Downloads are not included in your current plan',
        quota,
      };
    }

    if (quota.remaining <= 0) {
      return {
        allowed: false,
        reason: 'QUOTA_EXHAUSTED',
        message: 'Monthly download quota reached for your plan',
        quota,
      };
    }

    return { allowed: true, quota };
  }

  /**
   * Transaction-safe quota check and reservation.
   * Uses MySQL row locking (FOR UPDATE) to prevent race conditions when remaining = 1.
   *
   * @param {number} userId - Authenticated user ID
   * @param {number} videoId - Video ID to download
   * @param {string} [fileName=null] - Sanitized filename
   * @param {number} [fileSize=0] - File size in bytes
   * @param {string} [mimeType='video/mp4'] - MIME type
   * @returns {Promise<Object>} { allowed: boolean, downloadId?: number, historyId?: number, quota?: Object, message?: string, status?: number }
   */
  async reserveDownloadQuota(userId, videoId, fileName = null, fileSize = 0, mimeType = 'video/mp4') {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // 1. Lock and read active subscription with plan details
      const [subRows] = await conn.query(
        `SELECT 
           us.id, us.user_id, us.plan_id, us.status, us.start_date, us.end_date, us.billing_cycle,
           sp.code AS plan_code, sp.name AS plan_name, sp.download_limit, sp.price
         FROM user_subscriptions us
         JOIN subscription_plans sp ON us.plan_id = sp.id
         WHERE us.user_id = ?
           AND us.status = 'ACTIVE'
           AND (us.end_date IS NULL OR us.end_date >= NOW())
         ORDER BY sp.price DESC, us.id DESC
         LIMIT 1
         FOR UPDATE`,
        [userId]
      );

      const activeSub = subRows[0] || null;

      if (!activeSub) {
        await conn.rollback();
        return {
          allowed: false,
          status: 403,
          code: 'DOWNLOADS_NOT_INCLUDED',
          reason: 'DOWNLOADS_NOT_INCLUDED',
          message: 'Downloads are not included in your current plan',
        };
      }

      const planCode = String(activeSub.plan_code || 'FREE').toUpperCase();
      const rawLimit = activeSub.download_limit;
      const isGold = planCode === 'GOLD';
      const isUnlimited = isGold || rawLimit === null;

      const { periodStart, periodEnd } = this.getQuotaPeriod(activeSub);

      // 2. Lock and count downloads used in current quota period
      const [usageRows] = await conn.query(
        `SELECT COUNT(*) AS totalUsed
         FROM download_history
         WHERE user_id = ?
           AND status IN ('STARTED', 'COMPLETED')
           AND downloaded_at >= ?
           AND downloaded_at < ?
         FOR UPDATE`,
        [userId, periodStart, periodEnd]
      );

      const used = Number(usageRows[0]?.totalUsed || 0);

      // 3. Quota check for limited plans
      if (!isUnlimited) {
        const limit = Number(rawLimit || 0);
        if (limit <= 0) {
          await conn.rollback();
          return {
            allowed: false,
            status: 403,
            code: 'DOWNLOADS_NOT_INCLUDED',
            reason: 'DOWNLOADS_NOT_INCLUDED',
            message: 'Downloads are not included in your current plan',
          };
        }

        if (used >= limit) {
          await conn.rollback();
          return {
            allowed: false,
            status: 403,
            code: 'QUOTA_EXHAUSTED',
            reason: 'QUOTA_EXHAUSTED',
            message: 'Monthly download quota reached for your plan',
            quota: {
              planCode,
              limit,
              used,
              remaining: 0,
              unlimited: false,
            },
          };
        }
      }

      // 4. Create record in downloads table (Phase 19 table)
      const [downloadRes] = await conn.query(
        `INSERT INTO downloads 
           (user_id, video_id, status, file_name, file_size, mime_type, created_at, updated_at)
         VALUES 
           (?, ?, 'STARTED', ?, ?, ?, NOW(), NOW())`,
        [userId, videoId, fileName, fileSize, mimeType]
      );
      const downloadId = downloadRes.insertId;

      // 5. Create record in download_history table (Phase 20 table)
      const [historyRes] = await conn.query(
        `INSERT INTO download_history
           (user_id, video_id, download_id, status, file_name, file_size, mime_type, downloaded_at, created_at, updated_at)
         VALUES
           (?, ?, ?, 'STARTED', ?, ?, ?, NOW(), NOW(), NOW())`,
        [userId, videoId, downloadId, fileName, fileSize, mimeType]
      );
      const historyId = historyRes.insertId;

      await conn.commit();

      const newUsed = used + 1;
      const limit = isUnlimited ? null : Number(rawLimit);
      const remaining = isUnlimited ? null : Math.max(0, limit - newUsed);

      return {
        allowed: true,
        downloadId,
        historyId,
        quota: {
          planCode,
          limit,
          used: newUsed,
          remaining,
          unlimited: isUnlimited,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
        },
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Find an existing active download reservation for this user and video created recently (e.g. within 45s).
   * Useful to deduplicate HTTP Range requests and rapid consecutive chunk requests.
   *
   * @param {number} userId - User ID
   * @param {number} videoId - Video ID
   * @param {number} [windowSeconds=45] - Window in seconds
   * @returns {Promise<Object|null>} Existing history record or null
   */
  async findRecentDownloadSession(userId, videoId, windowSeconds = 15) {
    const [rows] = await pool.query(
      `SELECT id, download_id, status, downloaded_at
       FROM download_history
       WHERE user_id = ?
         AND video_id = ?
         AND downloaded_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)
         AND status IN ('STARTED', 'COMPLETED')
       ORDER BY id DESC
       LIMIT 1`,
      [userId, videoId, windowSeconds]
    );

    return rows[0] || null;
  }

  /**
   * Records download completion in both downloads and download_history tables.
   *
   * @param {number} historyId - download_history.id
   * @param {number} downloadId - downloads.id
   * @param {number} fileSize - Actual file size
   * @param {string} mimeType - MIME type
   */
  async recordDownloadCompletion(historyId, downloadId, fileSize = 0, mimeType = 'video/mp4') {
    try {
      if (downloadId) {
        await pool.query(
          `UPDATE downloads 
           SET status = 'COMPLETED', file_size = COALESCE(?, file_size), mime_type = COALESCE(?, mime_type), updated_at = NOW() 
           WHERE id = ?`,
          [fileSize || null, mimeType || null, downloadId]
        );
      }

      if (historyId) {
        await pool.query(
          `UPDATE download_history 
           SET status = 'COMPLETED', completed_at = NOW(), file_size = COALESCE(?, file_size), mime_type = COALESCE(?, mime_type), updated_at = NOW() 
           WHERE id = ?`,
          [fileSize || null, mimeType || null, historyId]
        );
      }
    } catch (err) {
      console.error('[DownloadQuotaService] Failed to record completion:', err.message);
    }
  }

  /**
   * Records download failure in both downloads and download_history tables.
   * When status is updated to 'FAILED', it is excluded from active quota usage queries,
   * guaranteeing that pre-streaming failures do not consume quota.
   *
   * @param {number} historyId - download_history.id
   * @param {number} downloadId - downloads.id
   * @param {string} reason - Failure reason
   */
  async recordDownloadFailure(historyId, downloadId, reason = 'Download interrupted') {
    try {
      const safeReason = String(reason || 'Download failed').substring(0, 500);

      if (downloadId) {
        await pool.query(
          `UPDATE downloads 
           SET status = 'FAILED', updated_at = NOW() 
           WHERE id = ?`,
          [downloadId]
        );
      }

      if (historyId) {
        await pool.query(
          `UPDATE download_history 
           SET status = 'FAILED', failure_reason = ?, updated_at = NOW() 
           WHERE id = ?`,
          [safeReason, historyId]
        );
      }
    } catch (err) {
      console.error('[DownloadQuotaService] Failed to record failure:', err.message);
    }
  }
}

module.exports = new DownloadQuotaService();
