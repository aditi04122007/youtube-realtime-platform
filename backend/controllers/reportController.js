const { pool } = require('../config/db');
const { REPORT_REASONS, isValidReportReason } = require('../utils/reportReasons');
const { checkVideoAccess } = require('./translationController');

/**
 * GET /api/reports/reasons
 * Get centralized list of supported moderation reasons
 */
const getReportReasons = (req, res) => {
  return res.status(200).json({
    success: true,
    reasons: REPORT_REASONS,
  });
};

/**
 * POST /api/comments/:commentId/reports
 * Submit a report against a comment or nested reply
 */
const submitCommentReport = async (req, res, next) => {
  try {
    const commentId = parseInt(req.params.commentId, 10);
    if (isNaN(commentId) || commentId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID' });
    }

    const reporterId = req.user.id;
    const { reason, description } = req.body;

    // 1. Validate Reason
    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, message: 'Report reason is required' });
    }
    const normalizedReason = reason.trim().toUpperCase();
    if (!isValidReportReason(normalizedReason)) {
      return res.status(400).json({ success: false, message: 'Invalid or unsupported report reason' });
    }

    // 2. Validate Description (optional, max 1000 characters)
    let trimmedDesc = null;
    if (description !== undefined && description !== null) {
      if (typeof description !== 'string') {
        return res.status(400).json({ success: false, message: 'Description must be a string' });
      }
      trimmedDesc = description.trim();
      if (trimmedDesc.length > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Description cannot exceed 1000 characters',
        });
      }
      if (trimmedDesc.length === 0) {
        trimmedDesc = null;
      }
    }

    // 3. Find Comment and verify existence
    const [cRows] = await pool.query(
      `SELECT id, video_id, user_id, status 
       FROM comments 
       WHERE id = ? 
       LIMIT 1`,
      [commentId]
    );

    if (cRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const comment = cRows[0];

    if (comment.status === 'DELETED') {
      return res.status(400).json({ success: false, message: 'Cannot report a deleted comment' });
    }

    // 4. Verify user can access the video/comment
    await checkVideoAccess(comment.video_id, req.user);

    // 5. Prevent reporting own comment
    if (Number(comment.user_id) === Number(reporterId)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot report your own comment',
      });
    }

    // 6. Duplicate report prevention: Check for pending report by same user
    const [dupRows] = await pool.query(
      `SELECT id, status 
       FROM reports 
       WHERE reporter_id = ? AND comment_id = ? AND status = 'PENDING' 
       LIMIT 1`,
      [reporterId, commentId]
    );

    if (dupRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'You have already reported this comment. Our moderation team is reviewing it.',
      });
    }

    // 7. Insert report
    const [insertResult] = await pool.query(
      `INSERT INTO reports (
         reporter_id, reported_user_id, video_id, comment_id, reason, description, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())`,
      [reporterId, comment.user_id, comment.video_id, commentId, normalizedReason, trimmedDesc]
    );

    return res.status(201).json({
      success: true,
      message: 'Report submitted successfully. Thank you for helping keep the community safe.',
      report: {
        id: insertResult.insertId,
        commentId,
        reason: normalizedReason,
        status: 'PENDING',
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

module.exports = {
  getReportReasons,
  submitCommentReport,
};
