const { pool } = require('../config/db');

/**
 * Plan Rank Hierarchy
 * FREE (0) < BRONZE (1) < SILVER (2) < GOLD (3)
 */
const PLAN_RANKS = {
  FREE: 0,
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
};

/**
 * Fetch a user's active subscription, or auto-resolve to active FREE tier
 * @param {number|string} userId
 * @returns {Promise<Object>} Active subscription record with plan details
 */
const getUserActiveSubscription = async (userId) => {
  const [rows] = await pool.query(
    `SELECT 
       us.id AS subscriptionId,
       us.user_id AS userId,
       us.status AS subscriptionStatus,
       us.start_date AS startDate,
       us.end_date AS endDate,
       us.auto_renew AS autoRenew,
       us.payment_provider AS paymentProvider,
       us.payment_reference AS paymentReference,
       sp.id AS planId,
       sp.code AS planCode,
       sp.slug AS planSlug,
       sp.name AS planName,
       sp.description AS planDescription,
       sp.monthly_price AS monthlyPrice,
       sp.yearly_price AS yearlyPrice,
       sp.max_video_uploads AS maxVideoUploads,
       sp.max_storage_gb AS maxStorageGb,
       sp.max_playlists AS maxPlaylists,
       sp.download_limit AS downloadLimit,
       sp.premium_access AS premiumAccess,
       sp.priority_support AS prioritySupport,
       sp.status AS planStatus
     FROM user_subscriptions us
     INNER JOIN subscription_plans sp ON us.plan_id = sp.id
     WHERE us.user_id = ? AND us.status = 'ACTIVE'
     ORDER BY us.id DESC
     LIMIT 1`,
    [userId]
  );

  if (rows.length > 0) {
    return rows[0];
  }

  // If no active subscription row exists, fetch FREE plan defaults
  const [freePlanRows] = await pool.query(
    `SELECT 
       id AS planId,
       code AS planCode,
       slug AS planSlug,
       name AS planName,
       description AS planDescription,
       monthly_price AS monthlyPrice,
       yearly_price AS yearlyPrice,
       max_video_uploads AS maxVideoUploads,
       max_storage_gb AS maxStorageGb,
       max_playlists AS maxPlaylists,
       download_limit AS downloadLimit,
       premium_access AS premiumAccess,
       priority_support AS prioritySupport,
       status AS planStatus
     FROM subscription_plans
     WHERE code = 'FREE'
     LIMIT 1`
  );

  const freePlan = freePlanRows[0] || {
    planId: 1,
    planCode: 'FREE',
    planSlug: 'FREE',
    planName: 'Free Plan',
    monthlyPrice: 0.00,
    yearlyPrice: 0.00,
    maxVideoUploads: 10,
    maxStorageGb: 5,
    maxPlaylists: 10,
    downloadLimit: 0,
    premiumAccess: 0,
    prioritySupport: 0,
    planStatus: 'ACTIVE',
  };

  return {
    subscriptionId: null,
    userId,
    subscriptionStatus: 'ACTIVE',
    startDate: new Date(),
    endDate: null,
    autoRenew: 0,
    paymentProvider: 'DEFAULT',
    paymentReference: null,
    ...freePlan,
  };
};

/**
 * Require a minimum subscription plan tier
 * @param {'FREE'|'BRONZE'|'SILVER'|'GOLD'} minPlanCode
 * @returns {Function} Express middleware
 */
const requirePlan = (minPlanCode) => {
  const normalizedMin = String(minPlanCode || 'FREE').toUpperCase();
  const requiredRank = PLAN_RANKS[normalizedMin] ?? 0;

  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to check subscription permissions',
        });
      }

      // Admins bypass plan restrictions
      if (req.user.role === 'ADMIN') {
        return next();
      }

      const activeSub = await getUserActiveSubscription(req.user.id);
      req.subscription = activeSub;

      const userPlanCode = (activeSub.planCode || 'FREE').toUpperCase();
      const userRank = PLAN_RANKS[userPlanCode] ?? 0;

      if (userRank < requiredRank) {
        return res.status(403).json({
          success: false,
          code: 'SUBSCRIPTION_REQUIRED',
          message: `This feature requires a ${normalizedMin} subscription plan or higher.`,
          requiredPlan: normalizedMin,
          currentPlan: userPlanCode,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Require a specific subscription plan feature
 * @param {'premium_access'|'priority_support'|'downloads'} featureName
 * @returns {Function} Express middleware
 */
const requireFeature = (featureName) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to check feature permissions',
        });
      }

      // Admins bypass plan restrictions
      if (req.user.role === 'ADMIN') {
        return next();
      }

      const activeSub = await getUserActiveSubscription(req.user.id);
      req.subscription = activeSub;

      let hasAccess = false;
      if (featureName === 'premium_access') {
        hasAccess = Boolean(activeSub.premiumAccess);
      } else if (featureName === 'priority_support') {
        hasAccess = Boolean(activeSub.prioritySupport);
      } else if (featureName === 'downloads') {
        hasAccess = Number(activeSub.downloadLimit) > 0 || activeSub.planCode === 'GOLD';
      }

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          code: 'FEATURE_NOT_PERMITTED',
          message: `Your current plan does not grant access to ${featureName}.`,
          currentPlan: activeSub.planCode,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = {
  PLAN_RANKS,
  getUserActiveSubscription,
  requirePlan,
  requireFeature,
};
