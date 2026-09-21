const { pool } = require('../config/db');
const config = require('../config');
const { PLAN_RANKS } = require('../middleware/subscriptionMiddleware');
const downloadQuotaService = require('../services/downloadQuotaService');
const notificationService = require('../services/notificationService');

/**
 * Format plan row for client-safe public response
 */
const formatPlan = (plan) => {
  const code = (plan.code || plan.slug || '').toUpperCase();
  const maxUploads = Number(plan.max_video_uploads ?? 10);
  const maxStorage = Number(plan.max_storage_gb ?? 5);
  const maxPlaylists = Number(plan.max_playlists ?? 10);
  const downloadLimit = Number(plan.download_limit ?? 0);

  // Generate highlight feature strings for UI display
  const features = [];
  if (code === 'FREE') {
    features.push('Up to 10 video uploads');
    features.push('5 GB cloud storage');
    features.push('Standard SD/HD playback');
    features.push('Ad-supported experience');
    features.push('Community support');
  } else if (code === 'BRONZE') {
    features.push('Up to 100 video uploads');
    features.push('50 GB cloud storage');
    features.push('Ad-free video viewing');
    features.push('20 offline downloads/month');
    features.push('Standard creator support');
  } else if (code === 'SILVER') {
    features.push('Up to 500 video uploads');
    features.push('250 GB high-speed storage');
    features.push('Full HD 1080p downloads');
    features.push('100 offline downloads/month');
    features.push('Priority comments & badges');
    features.push('Creator analytics');
  } else if (code === 'GOLD') {
    features.push('Unlimited video uploads');
    features.push('Unlimited cloud storage');
    features.push('Unlimited offline downloads');
    features.push('4K Ultra HD playback');
    features.push('Full premium video access');
    features.push('VIP 24/7 priority support');
  }

  return {
    id: plan.id,
    code,
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    monthlyPrice: Number(plan.monthly_price ?? plan.price ?? 0),
    yearlyPrice: Number(plan.yearly_price ?? 0),
    maxVideoUploads: maxUploads,
    maxStorageGb: maxStorage,
    maxPlaylists: maxPlaylists,
    downloadLimit,
    premiumAccess: Boolean(plan.premium_access),
    prioritySupport: Boolean(plan.priority_support),
    features,
  };
};

/**
 * GET /api/subscriptions/plans
 * Public endpoint to list all currently active subscription plans
 */
const getSubscriptionPlans = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
         id, name, slug, code, description, price, monthly_price, yearly_price,
         max_video_uploads, max_storage_gb, max_playlists, download_limit,
         premium_access, priority_support, status
       FROM subscription_plans
       WHERE status = 'ACTIVE'
       ORDER BY monthly_price ASC, id ASC`
    );

    const plans = rows.map(formatPlan);

    return res.status(200).json({
      success: true,
      plans,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/subscriptions/current
 * Authenticated endpoint to retrieve user's current subscription and usage stats
 */
const getCurrentSubscription = async (req, res, next) => {
  let connection = null;
  try {
    const userId = req.user.id;

    connection = await pool.getConnection();

    // 1. Fetch user's active subscription
    const [subRows] = await connection.query(
      `SELECT 
         us.id,
         us.user_id,
         us.plan_id,
         us.status,
         us.start_date,
         us.end_date,
         us.auto_renew,
         us.payment_provider,
         us.payment_reference,
         sp.id AS plan_id,
         sp.name AS plan_name,
         sp.slug AS plan_slug,
         sp.code AS plan_code,
         sp.description AS plan_description,
         sp.price AS plan_price,
         sp.monthly_price AS plan_monthly_price,
         sp.yearly_price AS plan_yearly_price,
         sp.max_video_uploads,
         sp.max_storage_gb,
         sp.max_playlists,
         sp.download_limit,
         sp.premium_access,
         sp.priority_support
       FROM user_subscriptions us
       INNER JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = ? AND us.status = 'ACTIVE'
       ORDER BY us.id DESC
       LIMIT 1`,
      [userId]
    );

    let activeSub = subRows[0];

    // 2. If no subscription found, auto-assign FREE tier
    if (!activeSub) {
      await connection.beginTransaction();

      const [freePlanRows] = await connection.query(
        `SELECT id, name, slug, code, description, price, monthly_price, yearly_price,
                max_video_uploads, max_storage_gb, max_playlists, download_limit,
                premium_access, priority_support
         FROM subscription_plans
         WHERE code = 'FREE'
         LIMIT 1`
      );

      const freePlan = freePlanRows[0];
      if (!freePlan) {
        await connection.rollback();
        throw new Error('Default FREE plan not found in database');
      }

      // Create default active subscription for 10 years (3650 days)
      const [insertRes] = await connection.query(
        `INSERT INTO user_subscriptions 
           (user_id, plan_id, status, start_date, end_date, auto_renew, payment_provider, payment_reference)
         VALUES 
           (?, ?, 'ACTIVE', NOW(), DATE_ADD(NOW(), INTERVAL 3650 DAY), 1, 'SYSTEM', 'AUTO_FREE_ASSIGN')`,
        [userId, freePlan.id]
      );

      // Record in subscription_history
      await connection.query(
        `INSERT INTO subscription_history 
           (user_id, previous_plan_id, new_plan_id, action, reason, created_at)
         VALUES 
           (?, NULL, ?, 'ASSIGNED', 'Initial free plan auto-assignment', NOW())`,
        [userId, freePlan.id]
      );

      await connection.commit();

      activeSub = {
        id: insertRes.insertId,
        user_id: userId,
        plan_id: freePlan.id,
        status: 'ACTIVE',
        start_date: new Date(),
        end_date: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000),
        auto_renew: 1,
        payment_provider: 'SYSTEM',
        payment_reference: 'AUTO_FREE_ASSIGN',
        plan_id: freePlan.id,
        plan_name: freePlan.name,
        plan_slug: freePlan.slug,
        plan_code: freePlan.code,
        plan_description: freePlan.description,
        plan_price: freePlan.price,
        plan_monthly_price: freePlan.monthly_price,
        plan_yearly_price: freePlan.yearly_price,
        max_video_uploads: freePlan.max_video_uploads,
        max_storage_gb: freePlan.max_storage_gb,
        max_playlists: freePlan.max_playlists,
        download_limit: freePlan.download_limit,
        premium_access: freePlan.premium_access,
        priority_support: freePlan.priority_support,
      };
    }

    // 3. Query usage data (videos uploaded, storage estimation)
    const [videoStats] = await connection.query(
      `SELECT COUNT(*) AS totalVideos 
       FROM videos 
       WHERE user_id = ? AND status != 'DELETED'`,
      [userId]
    );
    const totalVideos = Number(videoStats[0]?.totalVideos || 0);

    // Approximate storage: 250MB per video average for estimated meter
    const estimatedStorageGb = parseFloat(((totalVideos * 250) / 1024).toFixed(2));

    const planData = formatPlan({
      id: activeSub.plan_id,
      name: activeSub.plan_name,
      slug: activeSub.plan_slug,
      code: activeSub.plan_code,
      description: activeSub.plan_description,
      monthly_price: activeSub.plan_monthly_price,
      yearly_price: activeSub.plan_yearly_price,
      max_video_uploads: activeSub.max_video_uploads,
      max_storage_gb: activeSub.max_storage_gb,
      max_playlists: activeSub.max_playlists,
      download_limit: activeSub.download_limit,
      premium_access: activeSub.premium_access,
      priority_support: activeSub.priority_support,
    });

    return res.status(200).json({
      success: true,
      subscription: {
        id: activeSub.id,
        status: activeSub.status,
        startDate: activeSub.start_date,
        endDate: activeSub.end_date,
        autoRenew: Boolean(activeSub.auto_renew),
        paymentProvider: activeSub.payment_provider,
        plan: planData,
        usage: {
          uploadsUsed: totalVideos,
          uploadsMax: planData.maxVideoUploads,
          storageUsedGb: estimatedStorageGb,
          storageMaxGb: planData.maxStorageGb,
          downloadsUsed: 0,
          downloadsMax: planData.downloadLimit,
          isEstimated: true,
        },
      },
    });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

/**
 * POST /api/subscriptions/change
 * Authenticated demo endpoint to test plan upgrades and downgrades
 * TODO: Replace with Razorpay flow in Phase 16
 */
const changeSubscription = async (req, res, next) => {
  let connection = null;
  try {
    // 1. Verify demo mode setting
    const demoMode = process.env.SUBSCRIPTION_DEMO_MODE === 'true' || config.subscription?.demoMode;
    if (!demoMode && process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Direct subscription changes are disabled. Please complete payment checkout.',
      });
    }

    const planCode = req.body?.planCode || req.body?.plan_code;
    if (!planCode || typeof planCode !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'A valid planCode is required (e.g. FREE, BRONZE, SILVER, GOLD)',
      });
    }

    const normalizedTargetCode = planCode.trim().toUpperCase();
    const userId = req.user.id;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 2. Lookup target plan
    const [targetPlanRows] = await connection.query(
      `SELECT id, name, slug, code, description, price, monthly_price, yearly_price,
              max_video_uploads, max_storage_gb, max_playlists, download_limit,
              duration_days, premium_access, priority_support, status
       FROM subscription_plans
       WHERE code = ?
       LIMIT 1`,
      [normalizedTargetCode]
    );

    if (targetPlanRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Plan '${normalizedTargetCode}' does not exist`,
      });
    }

    const targetPlan = targetPlanRows[0];
    if (targetPlan.status !== 'ACTIVE') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Plan '${targetPlan.name}' is currently unavailable for new subscriptions`,
      });
    }

    // 3. Fetch user's current active subscription (locking row)
    const [currentSubRows] = await connection.query(
      `SELECT us.id, us.plan_id, us.status, sp.code AS current_code
       FROM user_subscriptions us
       INNER JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = ? AND us.status = 'ACTIVE'
       ORDER BY us.id DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    const currentSub = currentSubRows[0];
    const currentCode = currentSub ? currentSub.current_code.toUpperCase() : 'FREE';

    // 4. Duplicate subscription rejection
    if (currentSub && currentSub.plan_id === targetPlan.id) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `You are already subscribed to the ${targetPlan.name}`,
      });
    }

    // 5. Determine transition action
    const currentRank = PLAN_RANKS[currentCode] ?? 0;
    const targetRank = PLAN_RANKS[normalizedTargetCode] ?? 0;

    let action = 'UPGRADED';
    if (targetRank < currentRank) {
      action = 'DOWNGRADED';
    } else if (!currentSub) {
      action = 'ASSIGNED';
    }

    // 6. Deactivate existing active subscriptions
    await connection.query(
      `UPDATE user_subscriptions 
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE user_id = ? AND status = 'ACTIVE'`,
      [userId]
    );

    // 7. Calculate new expiration date (3650 days for free, 30 days for paid tiers)
    const durationDays = normalizedTargetCode === 'FREE' ? 3650 : (Number(targetPlan.duration_days) || 30);
    const demoRef = `DEMO_${action}_${Date.now()}`;

    const [insertResult] = await connection.query(
      `INSERT INTO user_subscriptions 
         (user_id, plan_id, status, start_date, end_date, auto_renew, payment_provider, payment_reference)
       VALUES 
         (?, ?, 'ACTIVE', NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), 1, 'DEMO', ?)`,
      [userId, targetPlan.id, durationDays, demoRef]
    );

    // 8. Record in subscription_history
    const reasonText = `User ${action.toLowerCase()} to ${targetPlan.name} in demo mode`;
    await connection.query(
      `INSERT INTO subscription_history 
         (user_id, previous_plan_id, new_plan_id, action, reason, created_at)
       VALUES 
         (?, ?, ?, ?, ?, NOW())`,
      [userId, currentSub ? currentSub.plan_id : null, targetPlan.id, action, reasonText]
    );

    await connection.commit();

    // Dispatch SUBSCRIPTION_CHANGED notification
    notificationService.createNotification({
      userId,
      actorUserId: null,
      type: notificationService.NOTIFICATION_TYPES.SUBSCRIPTION_CHANGED,
      title: 'Subscription Updated',
      message: `You have successfully ${action.toLowerCase()} to the ${targetPlan.name} plan.`,
      entityType: 'subscription',
      entityId: insertResult.insertId,
      dataJson: {
        subscription_id: insertResult.insertId,
        plan_name: targetPlan.name,
        plan_code: normalizedTargetCode,
        action,
      },
    }).catch((e) => console.error('[Notification] Failed to send subscription change notification:', e.message));

    const formattedPlan = formatPlan(targetPlan);

    return res.status(200).json({
      success: true,
      message: `Successfully ${action.toLowerCase()} to ${targetPlan.name}!`,
      action,
      subscription: {
        id: insertResult.insertId,
        status: 'ACTIVE',
        plan: formattedPlan,
        paymentProvider: 'DEMO',
        paymentReference: demoRef,
      },
    });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

/**
 * GET /api/subscriptions/history
 * Authenticated endpoint to view user's past subscription change history
 */
const getSubscriptionHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM subscription_history WHERE user_id = ?`,
      [userId]
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await pool.query(
      `SELECT 
         sh.id,
         sh.action,
         sh.reason,
         sh.created_at AS createdAt,
         prev_p.code AS previousPlanCode,
         prev_p.name AS previousPlanName,
         new_p.code AS newPlanCode,
         new_p.name AS newPlanName
       FROM subscription_history sh
       LEFT JOIN subscription_plans prev_p ON sh.previous_plan_id = prev_p.id
       INNER JOIN subscription_plans new_p ON sh.new_plan_id = new_p.id
       WHERE sh.user_id = ?
       ORDER BY sh.created_at DESC, sh.id DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    return res.status(200).json({
      success: true,
      history: rows,
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

/**
 * GET /api/subscriptions/dashboard
 * Authenticated endpoint returning comprehensive subscription dashboard data:
 * - Current subscription details with authoritative DB values
 * - Real usage metrics from database (videos uploaded, storage in bytes/GB, playlists)
 * - Plan limits and features
 * - Safe handling of expired subscriptions
 */
const getSubscriptionDashboard = async (req, res, next) => {
  let connection = null;
  try {
    const userId = req.user.id;

    connection = await pool.getConnection();

    // 1. Safe expiration evaluation:
    // If user has any ACTIVE subscription whose end_date has passed, update to EXPIRED
    const [expiredRows] = await connection.query(
      `SELECT us.id, us.plan_id, us.end_date, sp.name AS plan_name
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = ? 
         AND us.status = 'ACTIVE' 
         AND us.end_date IS NOT NULL 
         AND us.end_date < NOW()`,
      [userId]
    );

    if (expiredRows.length > 0) {
      for (const exp of expiredRows) {
        await connection.query(
          `UPDATE user_subscriptions SET status = 'EXPIRED', updated_at = NOW() WHERE id = ?`,
          [exp.id]
        );
        await connection.query(
          `INSERT INTO subscription_history 
             (user_id, previous_plan_id, new_plan_id, action, reason, created_at)
           VALUES 
             (?, ?, ?, 'EXPIRED', 'Subscription billing period ended', NOW())`,
          [userId, exp.plan_id, exp.plan_id]
        ).catch(() => {});
      }
    }

    // 2. Query user's current subscription (prioritize ACTIVE, then latest)
    const [subRows] = await connection.query(
      `SELECT 
         us.id,
         us.user_id,
         us.plan_id,
         us.status,
         us.start_date,
         us.end_date,
         us.auto_renew,
         us.billing_cycle,
         us.payment_provider,
         us.payment_reference,
         sp.id AS plan_id,
         sp.name AS plan_name,
         sp.slug AS plan_slug,
         sp.code AS plan_code,
         sp.description AS plan_description,
         sp.price AS plan_price,
         sp.monthly_price AS plan_monthly_price,
         sp.yearly_price AS plan_yearly_price,
         sp.max_video_uploads,
         sp.max_storage_gb,
         sp.max_playlists,
         sp.download_limit,
         sp.premium_access,
         sp.priority_support
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = ?
       ORDER BY (us.status = 'ACTIVE') DESC, us.id DESC
       LIMIT 1`,
      [userId]
    );

    let activeSub = subRows[0];

    // 3. If no subscription row exists at all, auto-assign FREE tier
    if (!activeSub) {
      await connection.beginTransaction();

      const [freePlanRows] = await connection.query(
        `SELECT id, name, slug, code, description, price, monthly_price, yearly_price,
                max_video_uploads, max_storage_gb, max_playlists, download_limit,
                premium_access, priority_support
         FROM subscription_plans
         WHERE code = 'FREE'
         LIMIT 1`
      );

      const freePlan = freePlanRows[0];
      if (!freePlan) {
        await connection.rollback();
        throw new Error('Default FREE plan not found in database');
      }

      const [insertRes] = await connection.query(
        `INSERT INTO user_subscriptions 
           (user_id, plan_id, status, start_date, end_date, auto_renew, billing_cycle, payment_provider, payment_reference)
         VALUES 
           (?, ?, 'ACTIVE', NOW(), DATE_ADD(NOW(), INTERVAL 3650 DAY), 0, 'MONTHLY', 'SYSTEM', 'AUTO_FREE_ASSIGN')`,
        [userId, freePlan.id]
      );

      await connection.query(
        `INSERT INTO subscription_history 
           (user_id, previous_plan_id, new_plan_id, action, reason, created_at)
         VALUES 
           (?, NULL, ?, 'ASSIGNED', 'Initial free plan auto-assignment', NOW())`,
        [userId, freePlan.id]
      );

      await connection.commit();

      activeSub = {
        id: insertRes.insertId,
        user_id: userId,
        plan_id: freePlan.id,
        status: 'ACTIVE',
        start_date: new Date(),
        end_date: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000),
        auto_renew: 0,
        billing_cycle: 'MONTHLY',
        payment_provider: 'SYSTEM',
        payment_reference: 'AUTO_FREE_ASSIGN',
        plan_name: freePlan.name,
        plan_slug: freePlan.slug,
        plan_code: freePlan.code,
        plan_description: freePlan.description,
        plan_price: freePlan.price,
        plan_monthly_price: freePlan.monthly_price,
        plan_yearly_price: freePlan.yearly_price,
        max_video_uploads: freePlan.max_video_uploads,
        max_storage_gb: freePlan.max_storage_gb,
        max_playlists: freePlan.max_playlists,
        download_limit: freePlan.download_limit,
        premium_access: freePlan.premium_access,
        priority_support: freePlan.priority_support,
      };
    }

    // 4. Query REAL usage data directly from MySQL tables
    // (a) Videos uploaded (excluding DELETED)
    const [videoStats] = await connection.query(
      `SELECT COUNT(*) AS totalVideos 
       FROM videos 
       WHERE user_id = ? AND status != 'DELETED'`,
      [userId]
    );
    const videosUploaded = Number(videoStats[0]?.totalVideos || 0);

    // (b) Storage used in bytes (sum of actual file_size in non-deleted videos)
    const [storageStats] = await connection.query(
      `SELECT COALESCE(SUM(file_size), 0) AS totalStorageBytes
       FROM videos
       WHERE user_id = ? AND status != 'DELETED'`,
      [userId]
    );
    const storageUsedBytes = Number(storageStats[0]?.totalStorageBytes || 0);
    const storageUsedGb = parseFloat((storageUsedBytes / (1024 * 1024 * 1024)).toFixed(3));
    const storageUsedMb = parseFloat((storageUsedBytes / (1024 * 1024)).toFixed(2));

    // (c) Playlists created
    const [playlistStats] = await connection.query(
      `SELECT COUNT(*) AS totalPlaylists
       FROM playlists
       WHERE user_id = ?`,
      [userId]
    );
    const playlistsCreated = Number(playlistStats[0]?.totalPlaylists || 0);

    // (d) Real downloads quota and usage from downloadQuotaService (Phase 20)
    let downloadQuota = null;
    try {
      downloadQuota = await downloadQuotaService.getDownloadQuota(userId);
    } catch (qErr) {
      console.error('[SubscriptionController] Quota fetch error:', qErr.message);
    }

    const isGold = (activeSub.plan_code || '').toUpperCase() === 'GOLD';
    const downloadsUsed = downloadQuota ? downloadQuota.used : 0;
    const isUnlimitedDownloads = isGold || Boolean(downloadQuota?.unlimited);

    // 5. Structure authoritative response
    const planLimits = {
      maxVideoUploads: Number(activeSub.max_video_uploads ?? 10),
      maxStorageGb: Number(activeSub.max_storage_gb ?? 5),
      maxPlaylists: Number(activeSub.max_playlists ?? 10),
      downloadLimit: isUnlimitedDownloads ? null : Number(downloadQuota?.limit ?? activeSub.download_limit ?? 0),
      premiumAccess: Boolean(activeSub.premium_access),
      prioritySupport: Boolean(activeSub.priority_support),
    };

    return res.status(200).json({
      success: true,
      currentSubscription: {
        id: activeSub.id,
        plan: {
          id: activeSub.plan_id,
          name: activeSub.plan_name,
          code: (activeSub.plan_code || '').toUpperCase(),
          slug: activeSub.plan_slug,
          description: activeSub.plan_description,
          monthly_price: Number(activeSub.plan_monthly_price ?? activeSub.plan_price ?? 0),
          yearly_price: Number(activeSub.plan_yearly_price ?? 0),
          price: Number(activeSub.plan_price ?? 0),
        },
        status: activeSub.status,
        billingCycle: (activeSub.billing_cycle || 'MONTHLY').toUpperCase(),
        startDate: activeSub.start_date,
        endDate: activeSub.end_date,
        autoRenew: Boolean(activeSub.auto_renew),
        paymentProvider: activeSub.payment_provider || 'SYSTEM',
        paymentReference: activeSub.payment_reference || null,
      },
      usage: {
        videosUploaded,
        storageUsedBytes,
        storageUsedGb,
        storageUsedMb,
        playlistsCreated,
        downloadsUsed,
        downloadsRemaining: isUnlimitedDownloads ? null : (downloadQuota?.remaining ?? Math.max(0, (planLimits.downloadLimit || 0) - downloadsUsed)),
        downloadsLimit: planLimits.downloadLimit,
        downloadStatus: isUnlimitedDownloads ? 'Unlimited offline downloads' : `Offline downloads (${downloadsUsed}/${planLimits.downloadLimit ?? 0})`,
        isUnlimitedDownloads,
        downloadQuota,
      },
      limits: planLimits,
      features: {
        isUnlimitedVideos: isGold || planLimits.maxVideoUploads === 0,
        isUnlimitedStorage: isGold || planLimits.maxStorageGb === 0,
        isUnlimitedPlaylists: isGold || planLimits.maxPlaylists === 0,
        isUnlimitedDownloads,
      },
    });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

/**
 * PUT /api/subscriptions/auto-renew
 * Authenticated endpoint to toggle auto-renewal preference on user's active subscription
 */
const updateAutoRenew = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { autoRenew } = req.body || {};

    if (typeof autoRenew !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'autoRenew must be a boolean (true or false)',
      });
    }

    // 1. Fetch user's current active subscription
    const [subRows] = await pool.query(
      `SELECT us.id, us.status, us.plan_id, sp.code AS plan_code, sp.name AS plan_name
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = ? AND us.status = 'ACTIVE'
       ORDER BY us.id DESC
       LIMIT 1`,
      [userId]
    );

    if (subRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found to update auto-renew.',
      });
    }

    const sub = subRows[0];

    // 2. Free plan check
    if (sub.plan_code === 'FREE') {
      return res.status(400).json({
        success: false,
        message: 'Auto-renew is not applicable for the Free plan.',
      });
    }

    // 3. Update auto_renew flag in MySQL
    await pool.query(
      `UPDATE user_subscriptions SET auto_renew = ?, updated_at = NOW() WHERE id = ?`,
      [autoRenew ? 1 : 0, sub.id]
    );

    return res.status(200).json({
      success: true,
      autoRenew,
      message: autoRenew
        ? 'Auto-renew has been enabled. (Note: In test mode, this records your renewal preference; automated recurring billing is not active).'
        : 'Auto-renew has been turned off. Your subscription will remain active until the end date.',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSubscriptionPlans,
  getCurrentSubscription,
  changeSubscription,
  getSubscriptionHistory,
  getSubscriptionDashboard,
  updateAutoRenew,
};
