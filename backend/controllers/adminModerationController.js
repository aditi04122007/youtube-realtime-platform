const { pool } = require('../config/db');

/**
 * GET /api/admin/reports
 * List reported comments with pagination, filtering, searching, and sorting
 */
const getAdminReports = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const { status, reason, search, sort } = req.query;

    const whereClauses = [];
    const queryParams = [];

    // Filter by status
    if (status && status !== 'ALL') {
      whereClauses.push('r.status = ?');
      queryParams.push(status.trim().toUpperCase());
    }

    // Filter by reason
    if (reason && reason !== 'ALL') {
      whereClauses.push('r.reason = ?');
      queryParams.push(reason.trim().toUpperCase());
    }

    // Search query (comment content, reporter username, author username, or report ID)
    if (search && typeof search === 'string' && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      const numId = parseInt(search.trim(), 10);
      if (!isNaN(numId) && numId > 0) {
        whereClauses.push('(r.id = ? OR c.content LIKE ? OR u_rep.username LIKE ? OR u_auth.username LIKE ?)');
        queryParams.push(numId, term, term, term);
      } else {
        whereClauses.push('(c.content LIKE ? OR u_rep.username LIKE ? OR u_auth.username LIKE ?)');
        queryParams.push(term, term, term);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Sorting
    const sortClause = sort === 'oldest' ? 'r.created_at ASC, r.id ASC' : 'r.created_at DESC, r.id DESC';

    // Count total matching
    const countSql = `
      SELECT COUNT(*) AS total
      FROM reports r
      INNER JOIN comments c ON r.comment_id = c.id
      INNER JOIN users u_rep ON r.reporter_id = u_rep.id
      INNER JOIN users u_auth ON c.user_id = u_auth.id
      ${whereSql}
    `;
    const [countRows] = await pool.query(countSql, queryParams);
    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Fetch paginated reports
    const listSql = `
      SELECT 
        r.id,
        r.reason,
        r.description,
        r.status,
        r.reviewed_by AS reviewedBy,
        r.reviewed_at AS reviewedAt,
        r.resolution_note AS resolutionNote,
        r.created_at AS createdAt,
        r.updated_at AS updatedAt,
        -- Reporter
        r.reporter_id AS reporterId,
        u_rep.username AS reporterUsername,
        up_rep.display_name AS reporterDisplayName,
        -- Comment
        c.id AS commentId,
        c.content AS commentContent,
        c.status AS commentStatus,
        c.like_count AS commentLikeCount,
        c.reply_count AS commentReplyCount,
        c.created_at AS commentCreatedAt,
        c.parent_comment_id AS commentParentId,
        -- Author
        c.user_id AS authorId,
        u_auth.username AS authorUsername,
        up_auth.display_name AS authorDisplayName,
        COALESCE(ch.avatar_url, up_auth.avatar_url) AS authorAvatarUrl,
        -- Video
        v.id AS videoId,
        v.title AS videoTitle,
        ch.handle AS channelHandle
      FROM reports r
      INNER JOIN comments c ON r.comment_id = c.id
      INNER JOIN users u_rep ON r.reporter_id = u_rep.id
      LEFT JOIN user_profiles up_rep ON u_rep.id = up_rep.user_id
      INNER JOIN users u_auth ON c.user_id = u_auth.id
      LEFT JOIN user_profiles up_auth ON u_auth.id = up_auth.user_id
      LEFT JOIN channels ch ON u_auth.id = ch.user_id
      INNER JOIN videos v ON c.video_id = v.id
      ${whereSql}
      ORDER BY ${sortClause}
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(listSql, [...queryParams, limit, offset]);

    const reports = rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      description: r.description,
      status: r.status,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt,
      resolutionNote: r.resolutionNote,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      reporter: {
        id: r.reporterId,
        username: r.reporterUsername,
        displayName: r.reporterDisplayName || r.reporterUsername,
      },
      comment: {
        id: r.commentId,
        content: r.commentContent,
        status: r.commentStatus,
        likeCount: Number(r.commentLikeCount) || 0,
        replyCount: Number(r.commentReplyCount) || 0,
        createdAt: r.commentCreatedAt,
        parentId: r.commentParentId,
        author: {
          id: r.authorId,
          username: r.authorUsername,
          displayName: r.authorDisplayName || r.authorUsername,
          avatarUrl: r.authorAvatarUrl || null,
          channelHandle: r.channelHandle || null,
        },
      },
      video: {
        id: r.videoId,
        title: r.videoTitle,
      },
    }));

    return res.status(200).json({
      success: true,
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/reports/:reportId
 * Fetch detailed report info
 */
const getAdminReportById = async (req, res, next) => {
  try {
    const reportId = parseInt(req.params.reportId, 10);
    if (isNaN(reportId) || reportId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid report ID' });
    }

    const sql = `
      SELECT 
        r.id,
        r.reason,
        r.description,
        r.status,
        r.reviewed_by AS reviewedBy,
        r.reviewed_at AS reviewedAt,
        r.resolution_note AS resolutionNote,
        r.created_at AS createdAt,
        r.updated_at AS updatedAt,
        -- Reporter
        r.reporter_id AS reporterId,
        u_rep.username AS reporterUsername,
        up_rep.display_name AS reporterDisplayName,
        -- Comment
        c.id AS commentId,
        c.content AS commentContent,
        c.status AS commentStatus,
        c.like_count AS commentLikeCount,
        c.reply_count AS commentReplyCount,
        c.created_at AS commentCreatedAt,
        c.parent_comment_id AS commentParentId,
        -- Author
        c.user_id AS authorId,
        u_auth.username AS authorUsername,
        up_auth.display_name AS authorDisplayName,
        COALESCE(ch.avatar_url, up_auth.avatar_url) AS authorAvatarUrl,
        -- Video
        v.id AS videoId,
        v.title AS videoTitle,
        ch.handle AS channelHandle,
        -- Reviewer
        u_rev.username AS reviewerUsername
      FROM reports r
      INNER JOIN comments c ON r.comment_id = c.id
      INNER JOIN users u_rep ON r.reporter_id = u_rep.id
      LEFT JOIN user_profiles up_rep ON u_rep.id = up_rep.user_id
      INNER JOIN users u_auth ON c.user_id = u_auth.id
      LEFT JOIN user_profiles up_auth ON u_auth.id = up_auth.user_id
      LEFT JOIN channels ch ON u_auth.id = ch.user_id
      INNER JOIN videos v ON c.video_id = v.id
      LEFT JOIN users u_rev ON r.reviewed_by = u_rev.id
      WHERE r.id = ?
      LIMIT 1
    `;

    const [rows] = await pool.query(sql, [reportId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const r = rows[0];
    const report = {
      id: r.id,
      reason: r.reason,
      description: r.description,
      status: r.status,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt,
      reviewerUsername: r.reviewerUsername || null,
      resolutionNote: r.resolutionNote,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      reporter: {
        id: r.reporterId,
        username: r.reporterUsername,
        displayName: r.reporterDisplayName || r.reporterUsername,
      },
      comment: {
        id: r.commentId,
        content: r.commentContent,
        status: r.commentStatus,
        likeCount: Number(r.commentLikeCount) || 0,
        replyCount: Number(r.commentReplyCount) || 0,
        createdAt: r.commentCreatedAt,
        parentId: r.commentParentId,
        author: {
          id: r.authorId,
          username: r.authorUsername,
          displayName: r.authorDisplayName || r.authorUsername,
          avatarUrl: r.authorAvatarUrl || null,
          channelHandle: r.channelHandle || null,
        },
      },
      video: {
        id: r.videoId,
        title: r.videoTitle,
      },
    };

    return res.status(200).json({ success: true, report });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/reports/:reportId/dismiss
 * Dismiss a report without moderating the comment
 */
const dismissReport = async (req, res, next) => {
  let connection = null;
  try {
    const reportId = parseInt(req.params.reportId, 10);
    if (isNaN(reportId) || reportId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid report ID' });
    }

    const { note } = req.body || {};
    const trimmedNote = typeof note === 'string' ? note.trim().slice(0, 2000) : null;
    const adminId = req.user.id;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rRows] = await connection.query(
      `SELECT id, comment_id, status FROM reports WHERE id = ? FOR UPDATE`,
      [reportId]
    );

    if (rRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const report = rRows[0];

    // Update report
    await connection.query(
      `UPDATE reports 
       SET status = 'DISMISSED', 
           reviewed_by = ?, 
           reviewed_at = NOW(), 
           resolution_note = ?, 
           updated_at = NOW() 
       WHERE id = ?`,
      [adminId, trimmedNote, reportId]
    );

    // Audit log
    await connection.query(
      `INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, description, ip_address, created_at)
       VALUES (?, 'DISMISS_REPORT', 'REPORT', ?, ?, ?, NOW())`,
      [adminId, reportId, trimmedNote || 'Report dismissed without action', req.ip || null]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Report dismissed successfully',
      reportId,
      status: 'DISMISSED',
    });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

/**
 * POST /api/admin/reports/:reportId/review
 * Mark a report as reviewed without changing comment status
 */
const reviewReport = async (req, res, next) => {
  let connection = null;
  try {
    const reportId = parseInt(req.params.reportId, 10);
    if (isNaN(reportId) || reportId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid report ID' });
    }

    const { note } = req.body || {};
    const trimmedNote = typeof note === 'string' ? note.trim().slice(0, 2000) : null;
    const adminId = req.user.id;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rRows] = await connection.query(
      `SELECT id, comment_id, status FROM reports WHERE id = ? FOR UPDATE`,
      [reportId]
    );

    if (rRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    await connection.query(
      `UPDATE reports 
       SET status = 'REVIEWED', 
           reviewed_by = ?, 
           reviewed_at = NOW(), 
           resolution_note = ?, 
           updated_at = NOW() 
       WHERE id = ?`,
      [adminId, trimmedNote, reportId]
    );

    await connection.query(
      `INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, description, ip_address, created_at)
       VALUES (?, 'REVIEW_REPORT', 'REPORT', ?, ?, ?, NOW())`,
      [adminId, reportId, trimmedNote || 'Report marked as reviewed', req.ip || null]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Report marked as reviewed',
      reportId,
      status: 'REVIEWED',
    });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

/**
 * POST /api/admin/reports/:reportId/action
 * Execute a moderation action on the reported comment (HIDE_COMMENT, REMOVE_COMMENT, NO_ACTION)
 */
const takeModerationAction = async (req, res, next) => {
  let connection = null;
  try {
    const reportId = parseInt(req.params.reportId, 10);
    if (isNaN(reportId) || reportId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid report ID' });
    }

    const { action, note } = req.body || {};
    const validActions = ['HIDE_COMMENT', 'REMOVE_COMMENT', 'NO_ACTION'];
    if (!action || !validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Supported actions: HIDE_COMMENT, REMOVE_COMMENT, NO_ACTION',
      });
    }

    const trimmedNote = typeof note === 'string' ? note.trim().slice(0, 2000) : null;
    const adminId = req.user.id;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Fetch report with comment info
    const [rRows] = await connection.query(
      `SELECT 
         r.id, 
         r.comment_id, 
         r.reason, 
         r.status AS report_status,
         c.video_id,
         c.parent_comment_id,
         c.status AS comment_status
       FROM reports r
       INNER JOIN comments c ON r.comment_id = c.id
       WHERE r.id = ?
       FOR UPDATE`,
      [reportId]
    );

    if (rRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const report = rRows[0];
    const commentId = report.comment_id;

    if (action === 'HIDE_COMMENT') {
      // 1. Set comment status to HIDDEN
      await connection.query(
        `UPDATE comments SET status = 'HIDDEN', updated_at = NOW() WHERE id = ?`,
        [commentId]
      );

      // 2. Purge cached translations for this comment
      await connection.query(
        `DELETE FROM comment_translations WHERE comment_id = ?`,
        [commentId]
      );

      // 3. Update report status to ACTION_TAKEN
      await connection.query(
        `UPDATE reports 
         SET status = 'ACTION_TAKEN', 
             reviewed_by = ?, 
             reviewed_at = NOW(), 
             resolution_note = ?, 
             updated_at = NOW() 
         WHERE id = ?`,
        [adminId, trimmedNote, reportId]
      );

      // 4. Record audit log
      await connection.query(
        `INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, reason, description, ip_address, created_at)
         VALUES (?, 'HIDE_COMMENT', 'COMMENT', ?, ?, ?, ?, NOW())`,
        [adminId, commentId, report.reason, trimmedNote || 'Comment hidden by moderation', req.ip || null]
      );
    } else if (action === 'REMOVE_COMMENT') {
      // 1. Set comment status to REMOVED
      await connection.query(
        `UPDATE comments SET status = 'REMOVED', updated_at = NOW() WHERE id = ?`,
        [commentId]
      );

      // 2. Purge cached translations
      await connection.query(
        `DELETE FROM comment_translations WHERE comment_id = ?`,
        [commentId]
      );

      // 3. Decrement counters if comment was previously VISIBLE or REPORTED
      if (report.comment_status === 'VISIBLE' || report.comment_status === 'REPORTED') {
        if (report.parent_comment_id === null) {
          // Top-level comment
          await connection.query(
            `UPDATE videos SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?`,
            [report.video_id]
          );
        } else {
          // Nested reply
          await connection.query(
            `UPDATE comments SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = ?`,
            [report.parent_comment_id]
          );
        }
      }

      // 4. Update report status to ACTION_TAKEN
      await connection.query(
        `UPDATE reports 
         SET status = 'ACTION_TAKEN', 
             reviewed_by = ?, 
             reviewed_at = NOW(), 
             resolution_note = ?, 
             updated_at = NOW() 
         WHERE id = ?`,
        [adminId, trimmedNote, reportId]
      );

      // 5. Record audit log
      await connection.query(
        `INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, reason, description, ip_address, created_at)
         VALUES (?, 'REMOVE_COMMENT', 'COMMENT', ?, ?, ?, ?, NOW())`,
        [adminId, commentId, report.reason, trimmedNote || 'Comment removed by moderation', req.ip || null]
      );
    } else if (action === 'NO_ACTION') {
      // Mark as REVIEWED
      await connection.query(
        `UPDATE reports 
         SET status = 'REVIEWED', 
             reviewed_by = ?, 
             reviewed_at = NOW(), 
             resolution_note = ?, 
             updated_at = NOW() 
         WHERE id = ?`,
        [adminId, trimmedNote, reportId]
      );

      await connection.query(
        `INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, reason, description, ip_address, created_at)
         VALUES (?, 'NO_ACTION', 'REPORT', ?, ?, ?, ?, NOW())`,
        [adminId, reportId, report.reason, trimmedNote || 'No moderation action taken', req.ip || null]
      );
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: `Moderation action '${action}' applied successfully`,
      reportId,
      commentId,
      action,
    });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

/**
 * GET /api/admin/audit-logs
 * Fetch administrative moderation audit history
 */
const getAdminAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM admin_actions WHERE target_type IN ('COMMENT', 'REPORT')`
    );
    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const sql = `
      SELECT 
        aa.id,
        aa.admin_id AS adminId,
        aa.action_type AS actionType,
        aa.target_type AS targetType,
        aa.target_id AS targetId,
        aa.reason,
        aa.description,
        aa.created_at AS createdAt,
        u.username AS adminUsername,
        up.display_name AS adminDisplayName
      FROM admin_actions aa
      INNER JOIN users u ON aa.admin_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE aa.target_type IN ('COMMENT', 'REPORT')
      ORDER BY aa.created_at DESC, aa.id DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(sql, [limit, offset]);

    const logs = rows.map((l) => ({
      id: l.id,
      adminId: l.adminId,
      adminUsername: l.adminUsername,
      adminDisplayName: l.adminDisplayName || l.adminUsername,
      action: l.actionType,
      actionType: l.actionType,
      targetType: l.targetType,
      targetId: l.targetId,
      reason: l.reason,
      description: l.description,
      createdAt: l.createdAt,
    }));

    return res.status(200).json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAdminReports,
  getAdminReportById,
  dismissReport,
  reviewReport,
  takeModerationAction,
  getAdminAuditLogs,
};
