import api from './api';

/**
 * Fetch all available active subscription plans
 * GET /api/subscriptions/plans
 * @returns {Promise<{success: boolean, plans: Array}>}
 */
export const getSubscriptionPlans = async () => {
  const response = await api.get('/subscriptions/plans');
  return response.data;
};

/**
 * Fetch authenticated user's current subscription and usage stats
 * GET /api/subscriptions/current
 * @returns {Promise<{success: boolean, subscription: Object}>}
 */
export const getCurrentSubscription = async () => {
  const response = await api.get('/subscriptions/current');
  return response.data;
};

/**
 * Fetch comprehensive subscription dashboard data
 * GET /api/subscriptions/dashboard
 * @returns {Promise<{success: boolean, currentSubscription: Object, usage: Object, limits: Object}>}
 */
export const getSubscriptionDashboard = async () => {
  const response = await api.get('/subscriptions/dashboard');
  return response.data;
};

/**
 * Toggle auto-renew preference on current active subscription
 * PUT /api/subscriptions/auto-renew
 * @param {boolean} autoRenew
 * @returns {Promise<{success: boolean, autoRenew: boolean, message: string}>}
 */
export const updateAutoRenew = async (autoRenew) => {
  const response = await api.put('/subscriptions/auto-renew', { autoRenew });
  return response.data;
};

/**
 * Change / Upgrade / Downgrade subscription plan (Demo Sandbox)
 * POST /api/subscriptions/change
 * @param {string} planCode - e.g. 'FREE', 'BRONZE', 'SILVER', 'GOLD'
 * @returns {Promise<{success: boolean, message: string, action: string, subscription: Object}>}
 */
export const changeSubscription = async (planCode) => {
  const response = await api.post('/subscriptions/change', { planCode });
  return response.data;
};

/**
 * Fetch user's subscription transition history
 * GET /api/subscriptions/history
 * @param {Object} [params] - { page, limit }
 * @returns {Promise<{success: boolean, history: Array, pagination: Object}>}
 */
export const getSubscriptionHistory = async (params = {}) => {
  const response = await api.get('/subscriptions/history', { params });
  return response.data;
};

/**
 * Fetch all plans for administration
 * GET /api/admin/subscriptions/plans
 * @returns {Promise<{success: boolean, plans: Array}>}
 */
export const getAdminSubscriptionPlans = async () => {
  const response = await api.get('/admin/subscriptions/plans');
  return response.data;
};

/**
 * Update plan metadata or limits
 * PUT /api/admin/subscriptions/plans/:planId
 * @param {number|string} planId
 * @param {Object} data
 * @returns {Promise<{success: boolean, message: string, plan: Object}>}
 */
export const updateAdminSubscriptionPlan = async (planId, data) => {
  const response = await api.put(`/admin/subscriptions/plans/${planId}`, data);
  return response.data;
};

/**
 * Fetch subscription telemetry and stats for admin dashboard
 * GET /api/admin/subscriptions/stats
 * @returns {Promise<{success: boolean, stats: Object}>}
 */
export const getAdminSubscriptionStats = async () => {
  const response = await api.get('/admin/subscriptions/stats');
  return response.data;
};

/**
 * Fetch users with subscription statuses
 * GET /api/admin/subscriptions/users
 * @param {Object} [params]
 * @returns {Promise<{success: boolean, users: Array, pagination: Object}>}
 */
export const getAdminUserSubscriptions = async (params = {}) => {
  const response = await api.get('/admin/subscriptions/users', { params });
  return response.data;
};
