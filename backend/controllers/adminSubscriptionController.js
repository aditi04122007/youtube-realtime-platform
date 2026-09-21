const { pool } = require('../config/db');

/**
 * GET /api/admin/subscriptions/plans
 * List all subscription plans with administration metadata and subscriber counts
 */
const getAdminPlans = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
         sp.id,
         sp.name,
         sp.slug,
         sp.code,
         sp.description,
         sp.price,
         sp.monthly_price AS monthlyPrice,
         sp.yearly_price AS yearlyPrice,
         sp.max_video_uploads AS maxVideoUploads,
         sp.max_storage_gb AS maxStorageGb,
         sp.max_playlists AS maxPlaylists,
         sp.download_limit AS downloadLimit,
         sp.duration_days AS durationDays,
         sp.premium_access AS premiumAccess,
         sp.priority_support AS prioritySupport,
         sp.status,
         sp.created_at AS createdAt,
         sp.updated_at AS updatedAt,
         COUNT(us.id) AS activeSubscriberCount
       FROM subscription_plans sp
       LEFT JOIN user_subscriptions us ON sp.id = us.plan_id AND us.status = 'ACTIVE'
       GROUP BY sp.id
       ORDER BY sp.monthly_price ASC, sp.id ASC`
    );

    const plans = rows.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      code: p.code,
      description: p.description,
      price: Number(p.price || 0),
      monthlyPrice: Number(p.monthlyPrice || 0),
      yearlyPrice: Number(p.yearlyPrice || 0),
      maxVideoUploads: Number(p.maxVideoUploads || 0),
      maxStorageGb: Number(p.maxStorageGb || 0),
      maxPlaylists: Number(p.maxPlaylists || 0),
      downloadLimit: Number(p.downloadLimit || 0),
      durationDays: Number(p.durationDays || 30),
      premiumAccess: Boolean(p.premiumAccess),
      prioritySupport: Boolean(p.prioritySupport),
      status: p.status,
      activeSubscriberCount: Number(p.activeSubscriberCount || 0),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      plans,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/subscriptions/plans/:planId
 * Update plan limits, descriptions, pricing, or status (ACTIVE/DISABLED/HIDDEN)
 */
const updateAdminPlan = async (req, res, next) => {
  let connection = null;
  try {
    const planId = parseInt(req.params.planId, 10);
    if (isNaN(planId) || planId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid plan ID' });
    }

    const {
      name,
      description,
      monthlyPrice,
      yearlyPrice,
      maxVideoUploads,
      maxStorageGb,
      maxPlaylists,
      downloadLimit,
      premiumAccess,
      prioritySupport,
      status,
    } = req.body || {};

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `SELECT id, name, code, status FROM subscription_plans WHERE id = ? FOR UPDATE`,
      [planId]
    );

    if (existingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Subscription plan not found' });
    }

    const currentPlan = existingRows[0];

    // Status validation
    if (status && !['ACTIVE', 'DISABLED', 'HIDDEN'].includes(status)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Status must be 'ACTIVE', 'DISABLED', or 'HIDDEN'",
      });
    }

    // Update fields dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(String(name).trim().slice(0, 50));
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(String(description).trim());
    }
    if (monthlyPrice !== undefined) {
      const p = Math.max(0, parseFloat(monthlyPrice) || 0);
      updates.push('monthly_price = ?', 'price = ?');
      values.push(p, p);
    }
    if (yearlyPrice !== undefined) {
      const yp = Math.max(0, parseFloat(yearlyPrice) || 0);
      updates.push('yearly_price = ?');
      values.push(yp);
    }
    if (maxVideoUploads !== undefined) {
      updates.push('max_video_uploads = ?');
      values.push(Math.max(0, parseInt(maxVideoUploads, 10) || 0));
    }
    if (maxStorageGb !== undefined) {
      updates.push('max_storage_gb = ?');
      values.push(Math.max(0, parseInt(maxStorageGb, 10) || 0));
    }
    if (maxPlaylists !== undefined) {
      updates.push('max_playlists = ?');
      values.push(Math.max(0, parseInt(maxPlaylists, 10) || 0));
    }
    if (downloadLimit !== undefined) {
      updates.push('download_limit = ?');
      values.push(Math.max(0, parseInt(downloadLimit, 10) || 0));
    }
    if (premiumAccess !== undefined) {
      updates.push('premium_access = ?');
      values.push(premiumAccess ? 1 : 0);
    }
    if (prioritySupport !== undefined) {
      updates.push('priority_support = ?');
      values.push(prioritySupport ? 1 : 0);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length > 0) {
      values.push(planId);
      await connection.query(
        `UPDATE subscription_plans SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      );
    }

    // Log admin action in admin_actions
    await connection.query(
      `INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, reason, description, ip_address, created_at)
       VALUES (?, 'UPDATE_SUBSCRIPTION_PLAN', 'PLAN', ?, 'Admin updated plan configuration', ?, ?, NOW())`,
      [req.user.id, planId, JSON.stringify(req.body || {}), req.ip || null]
    );

    await connection.commit();

    // Fetch updated row
    const [updatedRows] = await pool.query(
      `SELECT * FROM subscription_plans WHERE id = ?`,
      [planId]
    );

    return res.status(200).json({
      success: true,
      message: `Plan '${currentPlan.name}' updated successfully`,
      plan: updatedRows[0],
    });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

/**
 * GET /api/admin/subscriptions/stats
 * Overview metrics: subscribers per tier, active counts, estimated recurring revenue
 */
const getAdminSubscriptionStats = async (req, res, next) => {
  try {
    const [tierRows] = await pool.query(
      `SELECT 
         sp.code,
         sp.name,
         sp.monthly_price AS monthlyPrice,
         COUNT(us.id) AS subscriberCount
       FROM subscription_plans sp
       LEFT JOIN user_subscriptions us ON sp.id = us.plan_id AND us.status = 'ACTIVE'
       GROUP BY sp.id
       ORDER BY sp.monthly_price ASC`
    );

    let totalSubscribers = 0;
    let paidSubscribers = 0;
    let estimatedMonthlyRevenue = 0;

    const breakdown = tierRows.map((t) => {
      const count = Number(t.subscriberCount || 0);
      const price = Number(t.monthlyPrice || 0);
      totalSubscribers += count;
      if (t.code !== 'FREE') {
        paidSubscribers += count;
        estimatedMonthlyRevenue += count * price;
      }
      return {
        code: t.code,
        name: t.name,
        monthlyPrice: price,
        subscriberCount: count,
      };
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalSubscribers,
        paidSubscribers,
        freeSubscribers: totalSubscribers - paidSubscribers,
        estimatedMonthlyRevenue: parseFloat(estimatedMonthlyRevenue.toFixed(2)),
        breakdown,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/subscriptions/users
 * Paginated list of users and their current subscription status
 */
const getAdminUserSubscriptions = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;

    const [countRows] = await pool.query(
      `SELECT COUNT(DISTINCT u.id) AS total FROM users u WHERE u.status = 'ACTIVE'`
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await pool.query(
      `SELECT 
         u.id AS userId,
         u.username,
         u.email,
         up.display_name AS displayName,
         COALESCE(sp.code, 'FREE') AS planCode,
         COALESCE(sp.name, 'Free Plan') AS planName,
         COALESCE(us.status, 'ACTIVE') AS subscriptionStatus,
         us.start_date AS startDate,
         us.end_date AS endDate,
         us.auto_renew AS autoRenew,
         us.payment_provider AS paymentProvider
       FROM users u
       LEFT JOIN user_profiles up ON u.id = up.user_id
       LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'ACTIVE'
       LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE u.status = 'ACTIVE'
       ORDER BY u.id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return res.status(200).json({
      success: true,
      users: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAdminPlans,
  updateAdminPlan,
  getAdminSubscriptionStats,
  getAdminUserSubscriptions,
};
