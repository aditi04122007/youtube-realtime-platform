const { pool } = require('../config/db');
const downloadQuotaService = require('../services/downloadQuotaService');

/**
 * GET /api/download-history/quota
 * Returns current authoritative monthly quota and usage for the authenticated user.
 */
const getQuota = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const quota = await downloadQuotaService.getDownloadQuota(userId);

    return res.status(200).json({
      success: true,
      quota,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/download-history
 * Returns paginated download history for the authenticated user.
 * Filters out soft-deleted records (is_deleted = 0).
 */
const getHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Parse and sanitize pagination parameters
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 20;
    if (limit > 50) limit = 50; // Max limit: 50

    const offset = (page - 1) * limit;

    // 1. Total active records count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM download_history
       WHERE user_id = ? AND is_deleted = 0`,
      [userId]
    );
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    // 2. Fetch paginated records with video metadata
    const [rows] = await pool.query(
      `SELECT 
         dh.id,
         dh.video_id AS videoId,
         dh.download_id AS downloadId,
         dh.status,
         dh.file_name AS fileName,
         dh.file_size AS fileSize,
         dh.mime_type AS mimeType,
         dh.downloaded_at AS downloadedAt,
         dh.completed_at AS completedAt,
         dh.failure_reason AS failureReason,
         v.title,
         v.thumbnail_url AS thumbnailUrl,
         v.duration_seconds AS durationSeconds
       FROM download_history dh
       LEFT JOIN videos v ON dh.video_id = v.id
       WHERE dh.user_id = ? AND dh.is_deleted = 0
       ORDER BY dh.downloaded_at DESC, dh.id DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const items = rows.map((r) => ({
      id: r.id,
      videoId: r.videoId,
      downloadId: r.downloadId,
      title: r.title || 'Untitled Video',
      thumbnailUrl: r.thumbnailUrl || null,
      durationSeconds: r.durationSeconds || 0,
      fileName: r.fileName || `video-${r.videoId}.mp4`,
      fileSize: Number(r.fileSize || 0),
      mimeType: r.mimeType || 'video/mp4',
      status: r.status,
      downloadedAt: r.downloadedAt,
      completedAt: r.completedAt,
      failureReason: r.failureReason || null,
    }));

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
 * GET /api/download-history/summary
 * Returns download summary metrics for the authenticated user.
 */
const getSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 1. Overall download counts
    const [counts] = await pool.query(
      `SELECT 
         COUNT(*) AS totalDownloads,
         SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completedDownloads,
         SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failedDownloads,
         SUM(CASE WHEN status = 'STARTED' THEN 1 ELSE 0 END) AS startedDownloads
       FROM download_history
       WHERE user_id = ? AND is_deleted = 0`,
      [userId]
    );

    // 2. Current quota period usage
    const quota = await downloadQuotaService.getDownloadQuota(userId);

    return res.status(200).json({
      success: true,
      summary: {
        totalDownloads: Number(counts[0]?.totalDownloads || 0),
        completedDownloads: Number(counts[0]?.completedDownloads || 0),
        failedDownloads: Number(counts[0]?.failedDownloads || 0),
        startedDownloads: Number(counts[0]?.startedDownloads || 0),
        currentPeriodDownloads: quota.used,
        quotaLimit: quota.limit,
        quotaRemaining: quota.remaining,
        isUnlimited: quota.unlimited,
        planCode: quota.planCode,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/download-history/:id
 * Soft deletes a download history record for the authenticated user.
 * Deleting history does NOT restore consumed quota.
 */
const deleteHistoryItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const historyId = parseInt(req.params.id, 10);

    if (isNaN(historyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid download history ID',
      });
    }

    // 1. Check if record exists
    const [rows] = await pool.query(
      `SELECT id, user_id, is_deleted 
       FROM download_history 
       WHERE id = ? LIMIT 1`,
      [historyId]
    );

    if (rows.length === 0 || rows[0].is_deleted === 1) {
      return res.status(404).json({
        success: false,
        message: 'Download history record not found',
      });
    }

    const record = rows[0];

    // 2. IDOR Protection: User ownership check
    if (record.user_id !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this download history record',
      });
    }

    // 3. Soft delete: Mark is_deleted = 1
    await pool.query(
      `UPDATE download_history 
       SET is_deleted = 1, deleted_at = NOW(), updated_at = NOW() 
       WHERE id = ? AND user_id = ?`,
      [historyId, userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Download history record deleted successfully',
      id: historyId,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getQuota,
  getHistory,
  getSummary,
  deleteHistoryItem,
};
