const { pool } = require('../config/db');
const { emitToRoom } = require('../socket/socketServer');

/**
 * Helper to record immutable administrative audit log
 */
const logAdminAction = async (db, {
  adminId,
  actionType,
  targetType,
  targetId = null,
  reason = null,
  description = null,
  metadata = null,
  ipAddress = null,
}) => {
  const runner = db || pool;
  const metaJson = metadata ? JSON.stringify(metadata) : null;
  await runner.query(
    `INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, reason, description, metadata, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [adminId, actionType, targetType, targetId, reason, description, metaJson, ipAddress]
  );
};

// ==========================================
// 1. DASHBOARD OVERVIEW & ANALYTICS
// ==========================================

const getDashboardStats = async ({ startDate, endDate, period = '30d' } = {}) => {
  // Date filter resolution
  let dateCondition = '';
  const dateParams = [];

  if (startDate && endDate) {
    dateCondition = 'AND created_at BETWEEN ? AND ?';
    dateParams.push(new Date(startDate), new Date(endDate));
  } else if (period === 'today') {
    dateCondition = 'AND created_at >= CURDATE()';
  } else if (period === '7d') {
    dateCondition = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
  } else if (period === '30d') {
    dateCondition = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
  } else if (period === '90d') {
    dateCondition = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)';
  } else if (period === 'year') {
    dateCondition = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
  }

  // 1. User stats
  const [userStats] = await pool.query(`
    SELECT 
      COUNT(*) AS totalUsers,
      SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS activeUsers,
      SUM(CASE WHEN status = 'SUSPENDED' THEN 1 ELSE 0 END) AS suspendedUsers,
      SUM(CASE WHEN status = 'BANNED' THEN 1 ELSE 0 END) AS bannedUsers,
      SUM(CASE WHEN role = 'ADMIN' THEN 1 ELSE 0 END) AS adminUsers,
      SUM(CASE WHEN role = 'CREATOR' THEN 1 ELSE 0 END) AS creatorUsers
    FROM users
  `);

  // New users in period
  const [newUsers] = await pool.query(
    `SELECT COUNT(*) AS count FROM users WHERE 1=1 ${dateCondition}`,
    dateParams
  );

  // 2. Channel stats
  const [channelStats] = await pool.query(`
    SELECT 
      COUNT(*) AS totalChannels,
      SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS activeChannels,
      SUM(CASE WHEN status = 'SUSPENDED' THEN 1 ELSE 0 END) AS suspendedChannels
    FROM channels
  `);

  // 3. Video stats
  const [videoStats] = await pool.query(`
    SELECT 
      COUNT(*) AS totalVideos,
      SUM(CASE WHEN status = 'PUBLISHED' THEN 1 ELSE 0 END) AS publishedVideos,
      SUM(CASE WHEN status = 'HIDDEN' THEN 1 ELSE 0 END) AS hiddenVideos,
      SUM(CASE WHEN status = 'REMOVED' THEN 1 ELSE 0 END) AS removedVideos,
      SUM(CASE WHEN status = 'DELETED' THEN 1 ELSE 0 END) AS deletedVideos,
      SUM(CASE WHEN visibility = 'PUBLIC' AND status = 'PUBLISHED' THEN 1 ELSE 0 END) AS publicVideos,
      SUM(CASE WHEN visibility = 'PRIVATE' THEN 1 ELSE 0 END) AS privateVideos,
      SUM(CASE WHEN visibility = 'UNLISTED' THEN 1 ELSE 0 END) AS unlistedVideos,
      COALESCE(SUM(view_count), 0) AS totalViews,
      COALESCE(SUM(like_count), 0) AS totalLikes,
      COALESCE(SUM(comment_count), 0) AS totalComments
    FROM videos
  `);

  // New videos in period
  const [newVideos] = await pool.query(
    `SELECT COUNT(*) AS count FROM videos WHERE 1=1 ${dateCondition}`,
    dateParams
  );

  // 4. Comment stats
  const [commentStats] = await pool.query(`
    SELECT 
      COUNT(*) AS totalComments,
      SUM(CASE WHEN status = 'VISIBLE' THEN 1 ELSE 0 END) AS visibleComments,
      SUM(CASE WHEN status = 'HIDDEN' THEN 1 ELSE 0 END) AS hiddenComments,
      SUM(CASE WHEN status = 'REMOVED' THEN 1 ELSE 0 END) AS removedComments
    FROM comments
  `);

  // 5. Reports stats
  const [reportStats] = await pool.query(`
    SELECT 
      COUNT(*) AS totalReports,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pendingReports,
      SUM(CASE WHEN status = 'REVIEWING' THEN 1 ELSE 0 END) AS reviewingReports,
      SUM(CASE WHEN status IN ('RESOLVED', 'ACTION_TAKEN') THEN 1 ELSE 0 END) AS resolvedReports,
      SUM(CASE WHEN status = 'DISMISSED' THEN 1 ELSE 0 END) AS dismissedReports
    FROM reports
  `);

  // 6. Subscriptions & Revenue
  const [subStats] = await pool.query(`
    SELECT 
      COUNT(*) AS totalSubscriptions,
      SUM(CASE WHEN us.status = 'ACTIVE' THEN 1 ELSE 0 END) AS activeSubscriptions,
      SUM(CASE WHEN us.status = 'ACTIVE' AND (sp.code = 'FREE' OR sp.price = 0) THEN 1 ELSE 0 END) AS freeSubscriptions,
      SUM(CASE WHEN us.status = 'ACTIVE' AND sp.code != 'FREE' AND sp.price > 0 THEN 1 ELSE 0 END) AS paidSubscriptions
    FROM user_subscriptions us
    LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
  `);

  const [paymentStats] = await pool.query(`
    SELECT 
      COUNT(*) AS totalTransactions,
      SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) AS successfulPayments,
      COALESCE(SUM(CASE WHEN status = 'SUCCESS' THEN amount ELSE 0 END), 0) AS totalRevenue
    FROM payments
  `);

  // Revenue in period
  const [periodRevenue] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS amount FROM payments WHERE status = 'SUCCESS' ${dateCondition}`,
    dateParams
  );

  // 7. Downloads stats
  const [downloadStats] = await pool.query(`
    SELECT 
      COUNT(*) AS totalDownloads,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completedDownloads,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failedDownloads,
      COALESCE(SUM(file_size), 0) AS totalStorageBytes
    FROM download_history
  `);

  const [activeDownloads] = await pool.query(`
    SELECT COUNT(*) AS count FROM downloads WHERE status = 'PENDING' AND expires_at > NOW()
  `);

  // 8. Video calls stats
  const [callStats] = await pool.query(`
    SELECT 
      COUNT(*) AS totalCalls,
      SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS activeCalls,
      SUM(CASE WHEN status = 'WAITING' THEN 1 ELSE 0 END) AS waitingCalls,
      SUM(CASE WHEN status = 'ENDED' THEN 1 ELSE 0 END) AS endedCalls,
      COALESCE(SUM(CASE WHEN started_at IS NOT NULL AND ended_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, started_at, ended_at) ELSE 0 END), 0) AS totalDurationSeconds
    FROM call_rooms
  `);

  // 9. Recent activities feed (last 10 items)
  const [recentActions] = await pool.query(`
    SELECT 
      aa.id, aa.admin_id, u.username AS adminUsername, aa.action_type, 
      aa.target_type, aa.target_id, aa.reason, aa.description, aa.created_at
    FROM admin_actions aa
    LEFT JOIN users u ON aa.admin_id = u.id
    ORDER BY aa.created_at DESC
    LIMIT 8
  `);

  const [recentReports] = await pool.query(`
    SELECT 
      r.id, r.reason, r.status, r.created_at, 
      u.username AS reporterUsername,
      CASE 
        WHEN r.comment_id IS NOT NULL THEN 'COMMENT'
        WHEN r.video_id IS NOT NULL THEN 'VIDEO'
        WHEN r.reported_user_id IS NOT NULL THEN 'USER'
        ELSE 'OTHER'
      END AS targetType
    FROM reports r
    LEFT JOIN users u ON r.reporter_id = u.id
    ORDER BY r.created_at DESC
    LIMIT 6
  `);

  return {
    users: {
      total: Number(userStats[0]?.totalUsers || 0),
      active: Number(userStats[0]?.activeUsers || 0),
      suspended: Number(userStats[0]?.suspendedUsers || 0),
      banned: Number(userStats[0]?.bannedUsers || 0),
      admins: Number(userStats[0]?.adminUsers || 0),
      creators: Number(userStats[0]?.creatorUsers || 0),
      newInPeriod: Number(newUsers[0]?.count || 0),
    },
    channels: {
      total: Number(channelStats[0]?.totalChannels || 0),
      active: Number(channelStats[0]?.activeChannels || 0),
      suspended: Number(channelStats[0]?.suspendedChannels || 0),
    },
    videos: {
      total: Number(videoStats[0]?.totalVideos || 0),
      published: Number(videoStats[0]?.publishedVideos || 0),
      hidden: Number(videoStats[0]?.hiddenVideos || 0),
      removed: Number(videoStats[0]?.removedVideos || 0),
      deleted: Number(videoStats[0]?.deletedVideos || 0),
      public: Number(videoStats[0]?.publicVideos || 0),
      private: Number(videoStats[0]?.privateVideos || 0),
      unlisted: Number(videoStats[0]?.unlistedVideos || 0),
      totalViews: Number(videoStats[0]?.totalViews || 0),
      totalLikes: Number(videoStats[0]?.totalLikes || 0),
      totalComments: Number(videoStats[0]?.totalComments || 0),
      newInPeriod: Number(newVideos[0]?.count || 0),
    },
    comments: {
      total: Number(commentStats[0]?.totalComments || 0),
      visible: Number(commentStats[0]?.visibleComments || 0),
      hidden: Number(commentStats[0]?.hiddenComments || 0),
      removed: Number(commentStats[0]?.removedComments || 0),
    },
    reports: {
      total: Number(reportStats[0]?.totalReports || 0),
      pending: Number(reportStats[0]?.pendingReports || 0),
      reviewing: Number(reportStats[0]?.reviewingReports || 0),
      resolved: Number(reportStats[0]?.resolvedReports || 0),
      dismissed: Number(reportStats[0]?.dismissedReports || 0),
    },
    subscriptions: {
      total: Number(subStats[0]?.totalSubscriptions || 0),
      active: Number(subStats[0]?.activeSubscriptions || 0),
      free: Number(subStats[0]?.freeSubscriptions || 0),
      paid: Number(subStats[0]?.paidSubscriptions || 0),
    },
    revenue: {
      totalRevenue: Number(paymentStats[0]?.totalRevenue || 0),
      totalTransactions: Number(paymentStats[0]?.totalTransactions || 0),
      successfulPayments: Number(paymentStats[0]?.successfulPayments || 0),
      periodRevenue: Number(periodRevenue[0]?.amount || 0),
    },
    downloads: {
      total: Number(downloadStats[0]?.totalDownloads || 0),
      completed: Number(downloadStats[0]?.completedDownloads || 0),
      failed: Number(downloadStats[0]?.failedDownloads || 0),
      active: Number(activeDownloads[0]?.count || 0),
      totalStorageBytes: Number(downloadStats[0]?.totalStorageBytes || 0),
    },
    calls: {
      total: Number(callStats[0]?.totalCalls || 0),
      active: Number(callStats[0]?.activeCalls || 0),
      waiting: Number(callStats[0]?.waitingCalls || 0),
      ended: Number(callStats[0]?.endedCalls || 0),
      totalDurationSeconds: Number(callStats[0]?.totalDurationSeconds || 0),
    },
    recentActivity: {
      adminActions: recentActions,
      reports: recentReports,
    },
    filter: {
      period,
      startDate: startDate || null,
      endDate: endDate || null,
    },
  };
};

const getDashboardCharts = async ({ period = '30d' } = {}) => {
  let intervalDays = 30;
  if (period === '7d') intervalDays = 7;
  else if (period === '90d') intervalDays = 90;
  else if (period === 'year') intervalDays = 365;

  // 1. User registrations by date
  const [userTrend] = await pool.query(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM users
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [intervalDays]
  );

  // 2. Video uploads by date
  const [videoTrend] = await pool.query(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM videos
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [intervalDays]
  );

  // 3. Revenue by date
  const [revenueTrend] = await pool.query(
    `SELECT DATE(created_at) AS date, COALESCE(SUM(amount), 0) AS total
     FROM payments
     WHERE status = 'SUCCESS' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [intervalDays]
  );

  // 4. Reports by date
  const [reportTrend] = await pool.query(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM reports
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [intervalDays]
  );

  return {
    period,
    userTrend: userTrend.map(r => ({ date: r.date, value: Number(r.count) })),
    videoTrend: videoTrend.map(r => ({ date: r.date, value: Number(r.count) })),
    revenueTrend: revenueTrend.map(r => ({ date: r.date, value: Number(r.total) })),
    reportTrend: reportTrend.map(r => ({ date: r.date, value: Number(r.count) })),
  };
};

// ==========================================
// 2. USER MANAGEMENT
// ==========================================

const getUsers = async ({
  page = 1,
  limit = 20,
  search = '',
  role = 'ALL',
  status = 'ALL',
  sortBy = 'created_at',
  sortOrder = 'DESC',
} = {}) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;

  const whereClauses = [];
  const queryParams = [];

  if (role && role !== 'ALL') {
    whereClauses.push('u.role = ?');
    queryParams.push(role.toUpperCase());
  }

  if (status && status !== 'ALL') {
    whereClauses.push('u.status = ?');
    queryParams.push(status.toUpperCase());
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    const numId = parseInt(search.trim(), 10);
    if (!isNaN(numId) && numId > 0) {
      whereClauses.push('(u.id = ? OR u.username LIKE ? OR u.email LIKE ? OR up.display_name LIKE ?)');
      queryParams.push(numId, term, term, term);
    } else {
      whereClauses.push('(u.username LIKE ? OR u.email LIKE ? OR up.display_name LIKE ?)');
      queryParams.push(term, term, term);
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const allowedSorts = ['id', 'username', 'email', 'role', 'status', 'created_at'];
  const sortCol = allowedSorts.includes(sortBy) ? `u.${sortBy}` : 'u.created_at';
  const sortDir = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Count total
  const [countRows] = await pool.query(
    `SELECT COUNT(DISTINCT u.id) AS total
     FROM users u
     LEFT JOIN user_profiles up ON u.id = up.user_id
     ${whereSql}`,
    queryParams
  );
  const total = Number(countRows[0]?.total || 0);

  // List rows
  const [users] = await pool.query(
    `SELECT 
       u.id, u.username, u.email, u.role, u.status, u.email_verified, u.created_at,
       up.display_name, up.avatar_url,
       ch.id AS channel_id, ch.handle AS channel_handle, ch.channel_name,
       (SELECT COUNT(*) FROM videos v WHERE v.user_id = u.id AND v.status != 'DELETED') AS video_count,
       (SELECT sp.name FROM user_subscriptions us JOIN subscription_plans sp ON us.plan_id = sp.id WHERE us.user_id = u.id AND us.status = 'ACTIVE' LIMIT 1) AS subscription_plan,
       (SELECT MAX(last_active_at) FROM devices WHERE user_id = u.id) AS last_active_at
     FROM users u
     LEFT JOIN user_profiles up ON u.id = up.user_id
     LEFT JOIN channels ch ON u.id = ch.user_id
     ${whereSql}
     ORDER BY ${sortCol} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...queryParams, l, offset]
  );

  return {
    users: users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      status: u.status,
      emailVerified: Boolean(u.email_verified),
      createdAt: u.created_at,
      displayName: u.display_name || u.username,
      avatarUrl: u.avatar_url,
      channel: u.channel_id ? {
        id: u.channel_id,
        handle: u.channel_handle,
        name: u.channel_name,
      } : null,
      videoCount: Number(u.video_count || 0),
      subscriptionPlan: u.subscription_plan || 'Free Plan',
      lastActiveAt: u.last_active_at || u.created_at,
    })),
    pagination: {
      page: p,
      limit: l,
      total,
      totalPages: Math.ceil(total / l) || 1,
    },
  };
};

const getUserById = async (userId) => {
  const [rows] = await pool.query(
    `SELECT 
       u.id, u.username, u.email, u.role, u.status, u.email_verified, u.created_at, u.updated_at,
       up.display_name, up.avatar_url, up.bio, up.location, up.website,
       ch.id AS channel_id, ch.handle AS channel_handle, ch.channel_name, ch.subscriber_count,
       (SELECT COUNT(*) FROM videos v WHERE v.user_id = u.id AND v.status != 'DELETED') AS totalVideos,
       (SELECT COALESCE(SUM(view_count), 0) FROM videos v WHERE v.user_id = u.id AND v.status != 'DELETED') AS totalViews,
       (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id) AS totalComments,
       (SELECT COUNT(*) FROM reports r WHERE r.reported_user_id = u.id) AS reportsReceivedCount,
       (SELECT COUNT(*) FROM reports r WHERE r.reporter_id = u.id) AS reportsFiledCount
     FROM users u
     LEFT JOIN user_profiles up ON u.id = up.user_id
     LEFT JOIN channels ch ON u.id = ch.user_id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );

  if (rows.length === 0) return null;
  const user = rows[0];

  // Active subscription
  const [subRows] = await pool.query(
    `SELECT us.id, us.status, us.start_date, us.end_date, us.billing_cycle, sp.name AS plan_name, sp.code AS plan_code, sp.price
     FROM user_subscriptions us
     JOIN subscription_plans sp ON us.plan_id = sp.id
     WHERE us.user_id = ? AND us.status = 'ACTIVE'
     ORDER BY us.id DESC LIMIT 1`,
    [userId]
  );

  // Active devices
  const [devices] = await pool.query(
    `SELECT id, device_name, device_type, browser, operating_system, ip_address, is_revoked, last_active_at, created_at
     FROM devices
     WHERE user_id = ?
     ORDER BY last_active_at DESC
     LIMIT 5`,
    [userId]
  );

  // Recent moderation actions targeting this user
  const [moderations] = await pool.query(
    `SELECT aa.id, aa.action_type, aa.reason, aa.description, aa.created_at, u2.username AS adminUsername
     FROM admin_actions aa
     LEFT JOIN users u2 ON aa.admin_id = u2.id
     WHERE aa.target_type = 'USER' AND aa.target_id = ?
     ORDER BY aa.created_at DESC
     LIMIT 10`,
    [userId]
  );

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: Boolean(user.email_verified),
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    profile: {
      displayName: user.display_name || user.username,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      location: user.location,
      website: user.website,
    },
    channel: user.channel_id ? {
      id: user.channel_id,
      handle: user.channel_handle,
      name: user.channel_name,
      subscriberCount: Number(user.subscriber_count || 0),
    } : null,
    metrics: {
      totalVideos: Number(user.totalVideos || 0),
      totalViews: Number(user.totalViews || 0),
      totalComments: Number(user.totalComments || 0),
      reportsReceived: Number(user.reportsReceivedCount || 0),
      reportsFiled: Number(user.reportsFiledCount || 0),
    },
    subscription: subRows[0] || null,
    devices,
    moderationHistory: moderations,
  };
};

const suspendUser = async (adminId, userId, reason, ip) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [users] = await conn.query('SELECT id, role, status FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (users.length === 0) {
      throw { status: 404, message: 'User not found' };
    }

    const targetUser = users[0];

    // Admin safety check: cannot suspend last active admin
    if (targetUser.role === 'ADMIN') {
      const [adminCount] = await conn.query("SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'");
      if (adminCount[0]?.count <= 1) {
        throw { status: 400, message: 'Cannot suspend the last remaining active administrator' };
      }
    }

    // Update status to SUSPENDED
    await conn.query("UPDATE users SET status = 'SUSPENDED', updated_at = NOW() WHERE id = ?", [userId]);

    // Revoke all active sessions
    await conn.query("UPDATE devices SET is_revoked = 1, revoked_at = NOW() WHERE user_id = ?", [userId]);

    // Audit log
    await logAdminAction(conn, {
      adminId,
      actionType: 'SUSPEND_USER',
      targetType: 'USER',
      targetId: userId,
      reason,
      description: `User account suspended: ${reason || 'No reason provided'}`,
      ipAddress: ip,
    });

    await conn.commit();
    return { success: true, message: 'User suspended successfully' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const unsuspendUser = async (adminId, userId, reason, ip) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [users] = await conn.query('SELECT id, status FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (users.length === 0) {
      throw { status: 404, message: 'User not found' };
    }

    await conn.query("UPDATE users SET status = 'ACTIVE', updated_at = NOW() WHERE id = ?", [userId]);

    await logAdminAction(conn, {
      adminId,
      actionType: 'UNSUSPEND_USER',
      targetType: 'USER',
      targetId: userId,
      reason,
      description: `User account restored to ACTIVE: ${reason || 'No reason provided'}`,
      ipAddress: ip,
    });

    await conn.commit();
    return { success: true, message: 'User restored successfully' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const banUser = async (adminId, userId, reason, ip) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [users] = await conn.query('SELECT id, role, status FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (users.length === 0) {
      throw { status: 404, message: 'User not found' };
    }

    const targetUser = users[0];

    // Admin safety check: cannot ban last active admin
    if (targetUser.role === 'ADMIN') {
      const [adminCount] = await conn.query("SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'");
      if (adminCount[0]?.count <= 1) {
        throw { status: 400, message: 'Cannot ban the last remaining active administrator' };
      }
    }

    await conn.query("UPDATE users SET status = 'BANNED', updated_at = NOW() WHERE id = ?", [userId]);
    await conn.query("UPDATE devices SET is_revoked = 1, revoked_at = NOW() WHERE user_id = ?", [userId]);

    await logAdminAction(conn, {
      adminId,
      actionType: 'BAN_USER',
      targetType: 'USER',
      targetId: userId,
      reason,
      description: `User permanently banned: ${reason || 'No reason provided'}`,
      ipAddress: ip,
    });

    await conn.commit();
    return { success: true, message: 'User permanently banned' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const updateUserRole = async (adminId, userId, newRole, reason, ip) => {
  const allowedRoles = ['USER', 'CREATOR', 'ADMIN'];
  if (!allowedRoles.includes(newRole)) {
    throw { status: 400, message: 'Invalid role. Must be USER, CREATOR, or ADMIN' };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [users] = await conn.query('SELECT id, role, status FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (users.length === 0) {
      throw { status: 404, message: 'User not found' };
    }

    const targetUser = users[0];

    // Admin safety check: cannot demote last active admin
    if (targetUser.role === 'ADMIN' && newRole !== 'ADMIN') {
      const [adminCount] = await conn.query("SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'");
      if (adminCount[0]?.count <= 1) {
        throw { status: 400, message: 'Cannot demote the last remaining active administrator' };
      }
    }

    await conn.query('UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?', [newRole, userId]);

    await logAdminAction(conn, {
      adminId,
      actionType: 'UPDATE_USER_ROLE',
      targetType: 'USER',
      targetId: userId,
      reason,
      description: `User role updated from ${targetUser.role} to ${newRole}`,
      metadata: { previousRole: targetUser.role, newRole },
      ipAddress: ip,
    });

    await conn.commit();
    return { success: true, message: `User role updated to ${newRole}` };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const revokeUserSessions = async (adminId, userId, reason, ip) => {
  const [res] = await pool.query('UPDATE devices SET is_revoked = 1, revoked_at = NOW() WHERE user_id = ?', [userId]);

  await logAdminAction(pool, {
    adminId,
    actionType: 'REVOKE_SESSIONS',
    targetType: 'USER',
    targetId: userId,
    reason,
    description: `Revoked all active sessions for user ID ${userId}`,
    ipAddress: ip,
  });

  return { success: true, message: 'All active user sessions revoked' };
};

// ==========================================
// 3. CHANNEL MANAGEMENT
// ==========================================

const getChannels = async ({
  page = 1,
  limit = 20,
  search = '',
  status = 'ALL',
  sortBy = 'created_at',
  sortOrder = 'DESC',
} = {}) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;

  const whereClauses = [];
  const queryParams = [];

  if (status && status !== 'ALL') {
    whereClauses.push('ch.status = ?');
    queryParams.push(status.toUpperCase());
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    whereClauses.push('(ch.channel_name LIKE ? OR ch.handle LIKE ? OR u.username LIKE ? OR u.email LIKE ?)');
    queryParams.push(term, term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const allowedSorts = ['id', 'channel_name', 'handle', 'subscriber_count', 'created_at', 'status'];
  const sortCol = allowedSorts.includes(sortBy) ? `ch.${sortBy}` : 'ch.created_at';
  const sortDir = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM channels ch
     INNER JOIN users u ON ch.user_id = u.id
     ${whereSql}`,
    queryParams
  );
  const total = Number(countRows[0]?.total || 0);

  const [channels] = await pool.query(
    `SELECT 
       ch.id, ch.user_id, ch.channel_name, ch.handle, ch.description, ch.avatar_url,
       ch.channel_art_url, ch.subscriber_count, ch.status, ch.created_at,
       u.username AS owner_username, u.email AS owner_email, u.status AS owner_status,
       (SELECT COUNT(*) FROM videos v WHERE v.channel_id = ch.id AND v.status != 'DELETED') AS video_count,
       (SELECT COALESCE(SUM(v.view_count), 0) FROM videos v WHERE v.channel_id = ch.id AND v.status != 'DELETED') AS total_views
     FROM channels ch
     INNER JOIN users u ON ch.user_id = u.id
     ${whereSql}
     ORDER BY ${sortCol} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...queryParams, l, offset]
  );

  return {
    channels: channels.map(c => ({
      id: c.id,
      userId: c.user_id,
      name: c.channel_name,
      handle: c.handle,
      description: c.description,
      avatarUrl: c.avatar_url,
      channelArtUrl: c.channel_art_url,
      subscriberCount: Number(c.subscriber_count || 0),
      status: c.status || 'ACTIVE',
      createdAt: c.created_at,
      videoCount: Number(c.video_count || 0),
      totalViews: Number(c.total_views || 0),
      owner: {
        id: c.user_id,
        username: c.owner_username,
        email: c.owner_email,
        status: c.owner_status,
      },
    })),
    pagination: {
      page: p,
      limit: l,
      total,
      totalPages: Math.ceil(total / l) || 1,
    },
  };
};

const suspendChannel = async (adminId, channelId, reason, ip) => {
  const [rows] = await pool.query('SELECT id, channel_name FROM channels WHERE id = ?', [channelId]);
  if (rows.length === 0) throw { status: 404, message: 'Channel not found' };

  await pool.query("UPDATE channels SET status = 'SUSPENDED', updated_at = NOW() WHERE id = ?", [channelId]);

  await logAdminAction(pool, {
    adminId,
    actionType: 'SUSPEND_CHANNEL',
    targetType: 'CHANNEL',
    targetId: channelId,
    reason,
    description: `Suspended channel ${rows[0].channel_name}: ${reason || 'No reason provided'}`,
    ipAddress: ip,
  });

  return { success: true, message: 'Channel suspended successfully' };
};

const restoreChannel = async (adminId, channelId, reason, ip) => {
  const [rows] = await pool.query('SELECT id, channel_name FROM channels WHERE id = ?', [channelId]);
  if (rows.length === 0) throw { status: 404, message: 'Channel not found' };

  await pool.query("UPDATE channels SET status = 'ACTIVE', updated_at = NOW() WHERE id = ?", [channelId]);

  await logAdminAction(pool, {
    adminId,
    actionType: 'RESTORE_CHANNEL',
    targetType: 'CHANNEL',
    targetId: channelId,
    reason,
    description: `Restored channel ${rows[0].channel_name}: ${reason || 'No reason provided'}`,
    ipAddress: ip,
  });

  return { success: true, message: 'Channel restored successfully' };
};

// ==========================================
// 4. VIDEO MANAGEMENT
// ==========================================

const getVideos = async ({
  page = 1,
  limit = 20,
  search = '',
  status = 'ALL',
  visibility = 'ALL',
  categoryId = null,
  sortBy = 'created_at',
  sortOrder = 'DESC',
} = {}) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;

  const whereClauses = [];
  const queryParams = [];

  if (status && status !== 'ALL') {
    whereClauses.push('v.status = ?');
    queryParams.push(status.toUpperCase());
  }

  if (visibility && visibility !== 'ALL') {
    whereClauses.push('v.visibility = ?');
    queryParams.push(visibility.toUpperCase());
  }

  if (categoryId) {
    whereClauses.push('vcm.category_id = ?');
    queryParams.push(parseInt(categoryId, 10));
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    const numId = parseInt(search.trim(), 10);
    if (!isNaN(numId) && numId > 0) {
      whereClauses.push('(v.id = ? OR v.title LIKE ? OR ch.channel_name LIKE ? OR ch.handle LIKE ?)');
      queryParams.push(numId, term, term, term);
    } else {
      whereClauses.push('(v.title LIKE ? OR ch.channel_name LIKE ? OR ch.handle LIKE ?)');
      queryParams.push(term, term, term);
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const allowedSorts = ['id', 'title', 'view_count', 'like_count', 'comment_count', 'created_at', 'status'];
  const sortCol = allowedSorts.includes(sortBy) ? `v.${sortBy}` : 'v.created_at';
  const sortDir = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const [countRows] = await pool.query(
    `SELECT COUNT(DISTINCT v.id) AS total
     FROM videos v
     INNER JOIN channels ch ON v.channel_id = ch.id
     LEFT JOIN video_category_map vcm ON v.id = vcm.video_id
     ${whereSql}`,
    queryParams
  );
  const total = Number(countRows[0]?.total || 0);

  const [videos] = await pool.query(
    `SELECT 
       v.id, v.user_id, v.channel_id, v.title, v.description, v.thumbnail_url,
       v.duration_seconds, v.visibility, v.status, v.view_count, v.like_count,
       v.dislike_count, v.comment_count, v.created_at, v.published_at,
       ch.channel_name, ch.handle AS channel_handle,
       u.username AS uploader_username, u.email AS uploader_email,
       (SELECT COUNT(*) FROM reports r WHERE r.video_id = v.id) AS report_count,
       (SELECT cat.name FROM video_category_map map JOIN video_categories cat ON map.category_id = cat.id WHERE map.video_id = v.id LIMIT 1) AS category_name
     FROM videos v
     INNER JOIN channels ch ON v.channel_id = ch.id
     INNER JOIN users u ON v.user_id = u.id
     LEFT JOIN video_category_map vcm ON v.id = vcm.video_id
     ${whereSql}
     GROUP BY v.id
     ORDER BY ${sortCol} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...queryParams, l, offset]
  );

  return {
    videos: videos.map(v => ({
      id: v.id,
      title: v.title,
      description: v.description,
      thumbnailUrl: v.thumbnail_url,
      duration: v.duration_seconds,
      visibility: v.visibility,
      status: v.status,
      views: Number(v.view_count || 0),
      likes: Number(v.like_count || 0),
      dislikes: Number(v.dislike_count || 0),
      comments: Number(v.comment_count || 0),
      reportsCount: Number(v.report_count || 0),
      createdAt: v.created_at,
      publishedAt: v.published_at,
      categoryName: v.category_name,
      channel: {
        id: v.channel_id,
        name: v.channel_name,
        handle: v.channel_handle,
      },
      uploader: {
        id: v.user_id,
        username: v.uploader_username,
        email: v.uploader_email,
      },
    })),
    pagination: {
      page: p,
      limit: l,
      total,
      totalPages: Math.ceil(total / l) || 1,
    },
  };
};

const getVideoById = async (videoId) => {
  const [rows] = await pool.query(
    `SELECT 
       v.id, v.user_id, v.channel_id, v.title, v.description, v.video_url, v.thumbnail_url,
       v.duration_seconds, v.visibility, v.status, v.view_count, v.like_count, v.dislike_count,
       v.comment_count, v.file_size, v.mime_type, v.created_at, v.published_at,
       ch.channel_name, ch.handle AS channel_handle, ch.avatar_url AS channel_avatar,
       u.username AS uploader_username, u.email AS uploader_email,
       (SELECT cat.name FROM video_category_map map JOIN video_categories cat ON map.category_id = cat.id WHERE map.video_id = v.id LIMIT 1) AS category_name
     FROM videos v
     INNER JOIN channels ch ON v.channel_id = ch.id
     INNER JOIN users u ON v.user_id = u.id
     WHERE v.id = ?
     LIMIT 1`,
    [videoId]
  );

  if (rows.length === 0) return null;
  const video = rows[0];

  // Reports on this video
  const [reports] = await pool.query(
    `SELECT r.id, r.reason, r.description, r.status, r.created_at, u.username AS reporterUsername
     FROM reports r
     LEFT JOIN users u ON r.reporter_id = u.id
     WHERE r.video_id = ?
     ORDER BY r.created_at DESC`,
    [videoId]
  );

  return {
    ...video,
    reports,
  };
};

const updateVideoStatus = async (adminId, videoId, status, reason, ip) => {
  const allowed = ['PUBLISHED', 'HIDDEN', 'REMOVED', 'PROCESSING', 'DELETED'];
  if (!allowed.includes(status)) {
    throw { status: 400, message: `Invalid status. Must be one of: ${allowed.join(', ')}` };
  }

  const [rows] = await pool.query('SELECT id, title, status FROM videos WHERE id = ?', [videoId]);
  if (rows.length === 0) throw { status: 404, message: 'Video not found' };

  await pool.query('UPDATE videos SET status = ?, updated_at = NOW() WHERE id = ?', [status, videoId]);

  await logAdminAction(pool, {
    adminId,
    actionType: `SET_VIDEO_${status}`,
    targetType: 'VIDEO',
    targetId: videoId,
    reason,
    description: `Video status changed from ${rows[0].status} to ${status}`,
    metadata: { previousStatus: rows[0].status, newStatus: status },
    ipAddress: ip,
  });

  return { success: true, message: `Video status updated to ${status}` };
};

const updateVideoVisibility = async (adminId, videoId, visibility, reason, ip) => {
  const allowed = ['PUBLIC', 'UNLISTED', 'PRIVATE'];
  if (!allowed.includes(visibility)) {
    throw { status: 400, message: `Invalid visibility. Must be one of: ${allowed.join(', ')}` };
  }

  const [rows] = await pool.query('SELECT id, title, visibility FROM videos WHERE id = ?', [videoId]);
  if (rows.length === 0) throw { status: 404, message: 'Video not found' };

  await pool.query('UPDATE videos SET visibility = ?, updated_at = NOW() WHERE id = ?', [visibility, videoId]);

  await logAdminAction(pool, {
    adminId,
    actionType: `SET_VIDEO_VISIBILITY_${visibility}`,
    targetType: 'VIDEO',
    targetId: videoId,
    reason,
    description: `Video visibility changed from ${rows[0].visibility} to ${visibility}`,
    metadata: { previousVisibility: rows[0].visibility, newVisibility: visibility },
    ipAddress: ip,
  });

  return { success: true, message: `Video visibility updated to ${visibility}` };
};

// ==========================================
// 5. COMMENT MODERATION
// ==========================================

const getComments = async ({
  page = 1,
  limit = 20,
  search = '',
  status = 'ALL',
  videoId = null,
  sortBy = 'created_at',
  sortOrder = 'DESC',
} = {}) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;

  const whereClauses = [];
  const queryParams = [];

  if (status && status !== 'ALL') {
    whereClauses.push('c.status = ?');
    queryParams.push(status.toUpperCase());
  }

  if (videoId) {
    whereClauses.push('c.video_id = ?');
    queryParams.push(parseInt(videoId, 10));
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    whereClauses.push('(c.content LIKE ? OR u.username LIKE ? OR v.title LIKE ?)');
    queryParams.push(term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const allowedSorts = ['id', 'like_count', 'reply_count', 'created_at', 'status'];
  const sortCol = allowedSorts.includes(sortBy) ? `c.${sortBy}` : 'c.created_at';
  const sortDir = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM comments c
     INNER JOIN users u ON c.user_id = u.id
     INNER JOIN videos v ON c.video_id = v.id
     ${whereSql}`,
    queryParams
  );
  const total = Number(countRows[0]?.total || 0);

  const [comments] = await pool.query(
    `SELECT 
       c.id, c.video_id, c.user_id, c.parent_comment_id, c.content, c.status,
       c.like_count, c.reply_count, c.created_at, c.updated_at,
       u.username AS author_username, u.email AS author_email,
       v.title AS video_title,
       (SELECT COUNT(*) FROM reports r WHERE r.comment_id = c.id) AS report_count
     FROM comments c
     INNER JOIN users u ON c.user_id = u.id
     INNER JOIN videos v ON c.video_id = v.id
     ${whereSql}
     ORDER BY ${sortCol} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...queryParams, l, offset]
  );

  return {
    comments: comments.map(c => ({
      id: c.id,
      videoId: c.video_id,
      videoTitle: c.video_title,
      userId: c.user_id,
      author: {
        id: c.user_id,
        username: c.author_username,
        email: c.author_email,
      },
      content: c.content,
      status: c.status,
      likeCount: Number(c.like_count || 0),
      replyCount: Number(c.reply_count || 0),
      reportsCount: Number(c.report_count || 0),
      parentCommentId: c.parent_comment_id,
      createdAt: c.created_at,
    })),
    pagination: {
      page: p,
      limit: l,
      total,
      totalPages: Math.ceil(total / l) || 1,
    },
  };
};

const updateCommentStatus = async (adminId, commentId, status, reason, ip) => {
  const allowed = ['VISIBLE', 'HIDDEN', 'REMOVED'];
  if (!allowed.includes(status)) {
    throw { status: 400, message: `Invalid comment status. Must be one of: ${allowed.join(', ')}` };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT id, video_id, parent_comment_id, status FROM comments WHERE id = ? FOR UPDATE', [commentId]);
    if (rows.length === 0) throw { status: 404, message: 'Comment not found' };

    const comment = rows[0];

    await conn.query('UPDATE comments SET status = ?, updated_at = NOW() WHERE id = ?', [status, commentId]);

    // If removing, update video comment counter
    if (status === 'REMOVED' && comment.status !== 'REMOVED') {
      if (comment.parent_comment_id === null) {
        await conn.query('UPDATE videos SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?', [comment.video_id]);
      } else {
        await conn.query('UPDATE comments SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = ?', [comment.parent_comment_id]);
      }
    }

    await logAdminAction(conn, {
      adminId,
      actionType: `SET_COMMENT_${status}`,
      targetType: 'COMMENT',
      targetId: commentId,
      reason,
      description: `Comment status set to ${status}`,
      ipAddress: ip,
    });

    await conn.commit();
    return { success: true, message: `Comment status updated to ${status}` };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ==========================================
// 6. UNIFIED REPORT MANAGEMENT
// ==========================================

const getReports = async ({
  page = 1,
  limit = 20,
  status = 'ALL',
  type = 'ALL',
  search = '',
  sortBy = 'created_at',
  sortOrder = 'DESC',
} = {}) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;

  const whereClauses = [];
  const queryParams = [];

  if (status && status !== 'ALL') {
    whereClauses.push('r.status = ?');
    queryParams.push(status.toUpperCase());
  }

  if (type === 'COMMENT') {
    whereClauses.push('r.comment_id IS NOT NULL');
  } else if (type === 'VIDEO') {
    whereClauses.push('r.video_id IS NOT NULL');
  } else if (type === 'USER') {
    whereClauses.push('r.reported_user_id IS NOT NULL');
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    whereClauses.push('(r.reason LIKE ? OR r.description LIKE ? OR u_rep.username LIKE ?)');
    queryParams.push(term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sortCol = sortBy === 'created_at' ? 'r.created_at' : 'r.id';
  const sortDir = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM reports r
     LEFT JOIN users u_rep ON r.reporter_id = u_rep.id
     ${whereSql}`,
    queryParams
  );
  const total = Number(countRows[0]?.total || 0);

  const [reports] = await pool.query(
    `SELECT 
       r.id, r.reporter_id, r.reported_user_id, r.video_id, r.comment_id,
       r.reason, r.description, r.status, r.reviewed_by, r.reviewed_at,
       r.resolution_note, r.created_at, r.updated_at,
       u_rep.username AS reporter_username,
       u_rev.username AS reviewer_username,
       v.title AS video_title,
       c.content AS comment_content,
       u_tar.username AS reported_user_username
     FROM reports r
     LEFT JOIN users u_rep ON r.reporter_id = u_rep.id
     LEFT JOIN users u_rev ON r.reviewed_by = u_rev.id
     LEFT JOIN videos v ON r.video_id = v.id
     LEFT JOIN comments c ON r.comment_id = c.id
     LEFT JOIN users u_tar ON r.reported_user_id = u_tar.id
     ${whereSql}
     ORDER BY ${sortCol} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...queryParams, l, offset]
  );

  return {
    reports: reports.map(r => ({
      id: r.id,
      targetType: r.comment_id ? 'COMMENT' : (r.video_id ? 'VIDEO' : 'USER'),
      targetId: r.comment_id || r.video_id || r.reported_user_id,
      targetTitle: r.comment_id ? r.comment_content : (r.video_id ? r.video_title : r.reported_user_username),
      reason: r.reason,
      description: r.description,
      status: r.status,
      resolutionNote: r.resolution_note,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      reviewedAt: r.reviewed_at,
      reporter: {
        id: r.reporter_id,
        username: r.reporter_username,
      },
      reviewer: r.reviewed_by ? {
        id: r.reviewed_by,
        username: r.reviewer_username,
      } : null,
    })),
    pagination: {
      page: p,
      limit: l,
      total,
      totalPages: Math.ceil(total / l) || 1,
    },
  };
};

const resolveReport = async (adminId, reportId, resolutionNote, ip) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [reports] = await conn.query('SELECT * FROM reports WHERE id = ? FOR UPDATE', [reportId]);
    if (reports.length === 0) throw { status: 404, message: 'Report not found' };

    await conn.query(
      `UPDATE reports 
       SET status = 'RESOLVED', reviewed_by = ?, reviewed_at = NOW(), resolution_note = ?, updated_at = NOW() 
       WHERE id = ?`,
      [adminId, resolutionNote || 'Resolved by administrator', reportId]
    );

    await logAdminAction(conn, {
      adminId,
      actionType: 'RESOLVE_REPORT',
      targetType: 'REPORT',
      targetId: reportId,
      reason: reports[0].reason,
      description: resolutionNote || 'Report marked as RESOLVED',
      ipAddress: ip,
    });

    await conn.commit();
    return { success: true, message: 'Report resolved successfully' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const dismissReport = async (adminId, reportId, resolutionNote, ip) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [reports] = await conn.query('SELECT * FROM reports WHERE id = ? FOR UPDATE', [reportId]);
    if (reports.length === 0) throw { status: 404, message: 'Report not found' };

    await conn.query(
      `UPDATE reports 
       SET status = 'DISMISSED', reviewed_by = ?, reviewed_at = NOW(), resolution_note = ?, updated_at = NOW() 
       WHERE id = ?`,
      [adminId, resolutionNote || 'Dismissed by administrator', reportId]
    );

    await logAdminAction(conn, {
      adminId,
      actionType: 'DISMISS_REPORT',
      targetType: 'REPORT',
      targetId: reportId,
      reason: reports[0].reason,
      description: resolutionNote || 'Report marked as DISMISSED',
      ipAddress: ip,
    });

    await conn.commit();
    return { success: true, message: 'Report dismissed successfully' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ==========================================
// 7. DOWNLOADS MANAGEMENT
// ==========================================

const getDownloadStats = async () => {
  const [totals] = await pool.query(`
    SELECT 
      COUNT(*) AS totalDownloads,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completedDownloads,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failedDownloads,
      COALESCE(SUM(file_size), 0) AS totalStorageBytes
    FROM download_history
  `);

  const [today] = await pool.query(`
    SELECT COUNT(*) AS count 
    FROM download_history 
    WHERE downloaded_at >= CURDATE()
  `);

  const [month] = await pool.query(`
    SELECT COUNT(*) AS count 
    FROM download_history 
    WHERE downloaded_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
  `);

  // Top downloading users
  const [topUsers] = await pool.query(`
    SELECT u.id, u.username, u.email, COUNT(dh.id) AS downloadCount
    FROM download_history dh
    JOIN users u ON dh.user_id = u.id
    GROUP BY u.id
    ORDER BY downloadCount DESC
    LIMIT 5
  `);

  return {
    totalDownloads: Number(totals[0]?.totalDownloads || 0),
    completedDownloads: Number(totals[0]?.completedDownloads || 0),
    failedDownloads: Number(totals[0]?.failedDownloads || 0),
    totalStorageBytes: Number(totals[0]?.totalStorageBytes || 0),
    todayDownloads: Number(today[0]?.count || 0),
    monthDownloads: Number(month[0]?.count || 0),
    topUsers,
  };
};

const getDownloads = async ({
  page = 1,
  limit = 20,
  search = '',
  status = 'ALL',
} = {}) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;

  const whereClauses = [];
  const queryParams = [];

  if (status && status !== 'ALL') {
    whereClauses.push('dh.status = ?');
    queryParams.push(status.toUpperCase());
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    whereClauses.push('(u.username LIKE ? OR u.email LIKE ? OR v.title LIKE ?)');
    queryParams.push(term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM download_history dh
     INNER JOIN users u ON dh.user_id = u.id
     LEFT JOIN videos v ON dh.video_id = v.id
     ${whereSql}`,
    queryParams
  );
  const total = Number(countRows[0]?.total || 0);

  const [downloads] = await pool.query(
    `SELECT 
       dh.id, dh.user_id, dh.video_id, dh.status, dh.file_name, dh.file_size,
       dh.mime_type, dh.downloaded_at, dh.completed_at, dh.failure_reason,
       u.username, u.email,
       v.title AS video_title, v.thumbnail_url
     FROM download_history dh
     INNER JOIN users u ON dh.user_id = u.id
     LEFT JOIN videos v ON dh.video_id = v.id
     ${whereSql}
     ORDER BY dh.downloaded_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, l, offset]
  );

  return {
    downloads: downloads.map(d => ({
      id: d.id,
      userId: d.user_id,
      username: d.username,
      email: d.email,
      videoId: d.video_id,
      videoTitle: d.video_title || 'Unknown Video',
      thumbnailUrl: d.thumbnail_url,
      fileName: d.file_name,
      fileSize: Number(d.file_size || 0),
      mimeType: d.mime_type,
      status: d.status,
      downloadedAt: d.downloaded_at,
      completedAt: d.completed_at,
      failureReason: d.failure_reason,
    })),
    pagination: {
      page: p,
      limit: l,
      total,
      totalPages: Math.ceil(total / l) || 1,
    },
  };
};

// ==========================================
// 8. VIDEO CALL MONITORING
// ==========================================

const getCallRooms = async ({
  page = 1,
  limit = 20,
  status = 'ALL',
  roomType = 'ALL',
  search = '',
} = {}) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;

  const whereClauses = [];
  const queryParams = [];

  if (status && status !== 'ALL') {
    whereClauses.push('cr.status = ?');
    queryParams.push(status.toUpperCase());
  }

  if (roomType && roomType !== 'ALL') {
    whereClauses.push('cr.room_type = ?');
    queryParams.push(roomType.toUpperCase());
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    whereClauses.push('(cr.room_code LIKE ? OR u.username LIKE ?)');
    queryParams.push(term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM call_rooms cr
     LEFT JOIN users u ON cr.created_by = u.id
     ${whereSql}`,
    queryParams
  );
  const total = Number(countRows[0]?.total || 0);

  const [rooms] = await pool.query(
    `SELECT 
       cr.id, cr.room_code, cr.created_by, cr.room_type, cr.status,
       cr.max_participants, cr.created_at, cr.started_at, cr.ended_at,
       u.username AS host_username, u.email AS host_email,
       (SELECT COUNT(*) FROM call_room_participants crp WHERE crp.room_id = cr.id AND crp.status = 'JOINED') AS active_participants,
       (SELECT COUNT(*) FROM call_room_participants crp WHERE crp.room_id = cr.id) AS total_participants
     FROM call_rooms cr
     LEFT JOIN users u ON cr.created_by = u.id
     ${whereSql}
     ORDER BY cr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, l, offset]
  );

  return {
    rooms: rooms.map(r => ({
      id: r.id,
      roomCode: r.room_code,
      createdBy: r.created_by,
      hostUsername: r.host_username,
      hostEmail: r.host_email,
      roomType: r.room_type,
      status: r.status,
      maxParticipants: r.max_participants,
      activeParticipants: Number(r.active_participants || 0),
      totalParticipants: Number(r.total_participants || 0),
      createdAt: r.created_at,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      durationSeconds: r.started_at
        ? Math.floor(((r.ended_at ? new Date(r.ended_at) : new Date()) - new Date(r.started_at)) / 1000)
        : 0,
    })),
    pagination: {
      page: p,
      limit: l,
      total,
      totalPages: Math.ceil(total / l) || 1,
    },
  };
};

const endCallRoom = async (adminId, roomCode, reason, ip) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rooms] = await conn.query('SELECT id, room_code, status FROM call_rooms WHERE room_code = ? FOR UPDATE', [roomCode]);
    if (rooms.length === 0) throw { status: 404, message: 'Call room not found' };

    const room = rooms[0];
    if (room.status === 'ENDED') {
      await conn.rollback();
      return { success: true, message: 'Room is already ended' };
    }

    // 1. Update room status to ENDED
    await conn.query("UPDATE call_rooms SET status = 'ENDED', ended_at = NOW() WHERE id = ?", [room.id]);

    // 2. Mark active participants as LEFT
    await conn.query("UPDATE call_room_participants SET status = 'LEFT', left_at = NOW() WHERE room_id = ? AND status = 'JOINED'", [room.id]);

    // 3. Socket broadcast to room
    try {
      emitToRoom(`room:${roomCode}`, 'room:ended', {
        roomCode,
        reason: reason || 'Call room was terminated by an administrator',
      });
    } catch (sockErr) {
      console.warn('[Admin] Socket emitToRoom error:', sockErr.message);
    }

    // 4. Audit logging
    await logAdminAction(conn, {
      adminId,
      actionType: 'TERMINATE_CALL_ROOM',
      targetType: 'CALL_ROOM',
      targetId: room.id,
      reason,
      description: `Call room ${roomCode} force-terminated by admin: ${reason || 'No reason provided'}`,
      metadata: { roomCode },
      ipAddress: ip,
    });

    await conn.commit();
    return { success: true, message: `Call room ${roomCode} terminated successfully` };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ==========================================
// 9. AUDIT LOGS / SYSTEM ACTIVITY
// ==========================================

const getActivityLogs = async ({
  page = 1,
  limit = 20,
  adminId = null,
  actionType = 'ALL',
  targetType = 'ALL',
  search = '',
  startDate = null,
  endDate = null,
} = {}) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;

  const whereClauses = [];
  const queryParams = [];

  if (adminId) {
    whereClauses.push('aa.admin_id = ?');
    queryParams.push(parseInt(adminId, 10));
  }

  if (actionType && actionType !== 'ALL') {
    whereClauses.push('aa.action_type = ?');
    queryParams.push(actionType.toUpperCase());
  }

  if (targetType && targetType !== 'ALL') {
    whereClauses.push('aa.target_type = ?');
    queryParams.push(targetType.toUpperCase());
  }

  if (startDate && endDate) {
    whereClauses.push('aa.created_at BETWEEN ? AND ?');
    queryParams.push(new Date(startDate), new Date(endDate));
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    whereClauses.push('(aa.description LIKE ? OR aa.reason LIKE ? OR u.username LIKE ?)');
    queryParams.push(term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM admin_actions aa
     LEFT JOIN users u ON aa.admin_id = u.id
     ${whereSql}`,
    queryParams
  );
  const total = Number(countRows[0]?.total || 0);

  const [logs] = await pool.query(
    `SELECT 
       aa.id, aa.admin_id, aa.action_type, aa.target_type, aa.target_id,
       aa.reason, aa.description, aa.metadata, aa.ip_address, aa.created_at,
       u.username AS admin_username, u.email AS admin_email
     FROM admin_actions aa
     LEFT JOIN users u ON aa.admin_id = u.id
     ${whereSql}
     ORDER BY aa.created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, l, offset]
  );

  return {
    logs: logs.map(log => ({
      id: log.id,
      adminId: log.admin_id,
      adminUsername: log.admin_username,
      adminEmail: log.admin_email,
      actionType: log.action_type,
      targetType: log.target_type,
      targetId: log.target_id,
      reason: log.reason,
      description: log.description,
      metadata: log.metadata,
      ipAddress: log.ip_address,
      createdAt: log.created_at,
    })),
    pagination: {
      page: p,
      limit: l,
      total,
      totalPages: Math.ceil(total / l) || 1,
    },
  };
};

// ==========================================
// 10. SYSTEM INFO / HEALTH
// ==========================================

const getSystemInfo = async () => {
  const startTime = Date.now();
  await pool.query('SELECT 1');
  const dbLatencyMs = Date.now() - startTime;

  return {
    status: 'ONLINE',
    dbConnection: 'HEALTHY',
    dbLatencyMs,
    nodeVersion: process.version,
    platform: process.platform,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    serverTimestamp: new Date().toISOString(),
  };
};

module.exports = {
  logAdminAction,
  getDashboardStats,
  getDashboardCharts,
  getUsers,
  getUserById,
  suspendUser,
  unsuspendUser,
  banUser,
  updateUserRole,
  revokeUserSessions,
  getChannels,
  suspendChannel,
  restoreChannel,
  getVideos,
  getVideoById,
  updateVideoStatus,
  updateVideoVisibility,
  getComments,
  updateCommentStatus,
  getReports,
  resolveReport,
  dismissReport,
  getDownloadStats,
  getDownloads,
  getCallRooms,
  endCallRoom,
  getActivityLogs,
  getSystemInfo,
};
