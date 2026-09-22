import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT token from localStorage if available
api.interceptors.request.use(
  (config) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // Ignore localStorage access issues
    }
    return config;
  },
  (error) => Promise.reject(error)
);


// Response Interceptor: Unified error logging & handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const customError = {
      message: error.response?.data?.message || error.message || 'An unexpected error occurred',
      status: error.response?.status,
      data: error.response?.data,
    };
    return Promise.reject(customError);
  }
);

/**
 * Health check helper
 * GET /api/health
 */
export const checkHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

/**
 * Database health check helper
 * GET /api/health/db
 */
export const checkDbHealth = async () => {
  const response = await api.get('/health/db');
  return response.data;
};

/**
 * Root status check helper
 * GET /
 */
export const checkRootApi = async () => {
  const rootBase = API_BASE_URL.replace(/\/api\/?$/, '');
  const response = await axios.get(rootBase || 'http://localhost:5000');
  return response.data;
};

// ==========================================
// Authentication Endpoints (Phase 3)
// ==========================================

/**
 * Register a new user
 * POST /api/auth/register
 */
export const registerUser = async (userData) => {
  const response = await api.post('/auth/register', userData);
  return response.data;
};

/**
 * Log in an existing user
 * POST /api/auth/login
 */
export const loginUser = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  if (response.data && response.data.token) {
    try {
      localStorage.setItem('token', response.data.token);
    } catch (e) {}
  }
  return response.data;
};

/**
 * Log out the current user
 * POST /api/auth/logout
 */
export const logoutUser = async () => {
  try {
    localStorage.removeItem('token');
  } catch (e) {}
  const response = await api.post('/auth/logout');
  return response.data;
};

/**
 * Fetch the authenticated user's profile
 * GET /api/auth/me
 */
export const getCurrentUser = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

/**
 * Test authentication on protected endpoint
 * GET /api/auth/protected
 */
export const checkProtected = async () => {
  const response = await api.get('/auth/protected');
  return response.data;
};

// ==========================================
// Media Asset Helper (Phase 4)
// ==========================================

/**
 * Resolves relative /uploads/... paths to full backend URL
 */
export const getMediaUrl = (relativePath) => {
  if (!relativePath) return null;
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  const rootBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  return `${rootBase}${relativePath}`;
};

// ==========================================
// User Profile Endpoints (Phase 4)
// ==========================================

/**
 * Get public profile of a user
 * GET /api/users/:id
 */
export const getPublicProfile = async (userId) => {
  const response = await api.get(`/users/${userId}`);
  return response.data;
};

/**
 * Get authenticated user profile
 * GET /api/users/me
 */
export const getCurrentUserProfile = async () => {
  const response = await api.get('/users/me');
  return response.data;
};

/**
 * Update authenticated user's profile details
 * PUT /api/users/me
 */
export const updateProfile = async (profileData) => {
  const response = await api.put('/users/me', profileData);
  return response.data;
};

/**
 * Upload profile avatar image
 * POST /api/users/me/avatar
 */
export const uploadAvatar = async (formData) => {
  const response = await api.post('/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

/**
 * Upload profile banner image
 * POST /api/users/me/banner
 */
export const uploadBanner = async (formData) => {
  const response = await api.post('/users/me/banner', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

// ==========================================
// Channel Endpoints (Phase 4)
// ==========================================

/**
 * Create a channel for the authenticated user
 * POST /api/channels
 */
export const createChannel = async (channelData) => {
  const response = await api.post('/channels', channelData);
  return response.data;
};

/**
 * Get authenticated user's channel
 * GET /api/channels/me
 */
export const getCurrentUserChannel = async () => {
  const response = await api.get('/channels/me');
  return response.data;
};

/**
 * Get public channel by ID
 * GET /api/channels/:id
 */
export const getChannelById = async (channelId) => {
  const response = await api.get(`/channels/${channelId}`);
  return response.data;
};

/**
 * Get public channel by handle
 * GET /api/channels/handle/:handle
 */
export const getChannelByHandle = async (handle) => {
  const cleanHandle = String(handle).replace(/^@+/, '');
  const response = await api.get(`/channels/handle/${cleanHandle}`);
  return response.data;
};

/**
 * Update authenticated user's channel
 * PUT /api/channels/me
 */
export const updateChannel = async (channelData) => {
  const response = await api.put('/channels/me', channelData);
  return response.data;
};

/**
 * Upload channel avatar image
 * POST /api/channels/me/avatar
 */
export const uploadChannelAvatar = async (formData) => {
  const response = await api.post('/channels/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

/**
 * Upload channel banner image
 * POST /api/channels/me/banner
 */
export const uploadChannelBanner = async (formData) => {
  const response = await api.post('/channels/me/banner', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

// ==========================================
// Security, OTP & Device Management (Phase 5)
// ==========================================

/**
 * Verify step-up login OTP
 * POST /api/auth/verify-login-otp
 */
export const verifyLoginOtp = async (data) => {
  const response = await api.post('/auth/verify-login-otp', data);
  if (response.data && response.data.token) {
    try {
      localStorage.setItem('token', response.data.token);
    } catch (e) {}
  }
  return response.data;
};

/**
 * Request email verification OTP
 * POST /api/auth/send-verification-otp
 */
export const sendVerificationOtp = async () => {
  const response = await api.post('/auth/send-verification-otp');
  return response.data;
};

/**
 * Verify email address with 6-digit OTP
 * POST /api/auth/verify-email
 */
export const verifyEmail = async (otp) => {
  const response = await api.post('/auth/verify-email', { otp });
  return response.data;
};

/**
 * Request password reset OTP
 * POST /api/auth/forgot-password
 */
export const forgotPassword = async (email) => {
  const response = await api.post('/auth/forgot-password', { email });
  return response.data;
};

/**
 * Verify password reset OTP
 * POST /api/auth/verify-reset-otp
 */
export const verifyResetOtp = async (data) => {
  const response = await api.post('/auth/verify-reset-otp', data);
  return response.data;
};

/**
 * Reset password with verified resetToken
 * POST /api/auth/reset-password
 */
export const resetPassword = async (data) => {
  const response = await api.post('/auth/reset-password', data);
  return response.data;
};

/**
 * Change password for authenticated user
 * POST /api/auth/change-password
 */
export const changePassword = async (data) => {
  const response = await api.post('/auth/change-password', data);
  return response.data;
};

/**
 * Get active devices for authenticated user
 * GET /api/security/devices
 */
export const getSecurityDevices = async () => {
  const response = await api.get('/security/devices');
  return response.data;
};

/**
 * Logout current device session
 * POST /api/security/logout-device
 */
export const logoutCurrentDevice = async () => {
  const response = await api.post('/security/logout-device');
  return response.data;
};

/**
 * Logout specific device session by device ID
 * POST /api/security/devices/:deviceId/logout
 */
export const logoutDeviceById = async (deviceId) => {
  const response = await api.post(`/security/devices/${deviceId}/logout`);
  return response.data;
};

/**
 * Logout all active device sessions for user
 * POST /api/security/logout-all
 */
export const logoutAllDevices = async () => {
  const response = await api.post('/security/logout-all');
  return response.data;
};

/**
 * Get recent security event logs for user
 * GET /api/security/events
 */
export const getSecurityEvents = async () => {
  const response = await api.get('/security/events');
  return response.data;
};

// ==========================================
// Homepage Feed Endpoints (Phase 6)
// ==========================================

/**
 * Fetch homepage video feed (recommended, trending, latest, or category-filtered)
 * GET /api/home
 *
 * @param {Object} params - { category, page, limit }
 */
export const getHomeFeed = async (params = {}) => {
  const response = await api.get('/home', { params });
  return response.data;
};

/**
 * Fetch video categories
 * GET /api/home/categories
 */
export const getHomeCategories = async () => {
  const response = await api.get('/home/categories');
  return response.data;
};

// ==========================================
// Video & Search Endpoints (Phases 7 & 8)
// ==========================================
export {
  uploadVideo,
  getMyVideos,
  getVideoById,
  getVideoStreamUrl,
  updateVideo,
  deleteVideo,
  getChannelVideos,
  getVideoCategories,
  getCategories,
  searchVideos,
  getSearchSuggestions,
  getRelatedVideos,
  getSearchHistory,
  addSearchHistory,
  deleteSearchHistoryItem,
  clearSearchHistory,
  getWatchHistory,
  getContinueWatching,
  getVideoWatchHistory,
  saveWatchProgress,
  deleteWatchHistoryItem,
  clearWatchHistory,
  getVideoReaction,
  setVideoReaction,
  removeVideoReaction,
} from './videoService';

// ==========================================
// Comments & Replies Endpoints (Phase 12)
// ==========================================
export {
  getVideoComments,
  createComment,
  getCommentReplies,
  updateComment,
  deleteComment,
  getCommentLike,
  likeComment,
  unlikeComment,
} from './commentService';

// ==========================================
// Multilingual Translation Endpoints (Phase 13)
// ==========================================
export {
  getSupportedLanguages,
  translateComment,
  getCachedTranslation,
} from './translationService';

// ==========================================
// Comment Moderation & Reporting Endpoints (Phase 14)
// ==========================================
export {
  getReportReasons,
  submitCommentReport,
  getAdminReports,
  getAdminReport,
  dismissReport,
  reviewReport,
  takeModerationAction,
  getAdminAuditLogs,
} from './moderationService';

// ==========================================
// Subscription Endpoints (Phase 15 & 17)
// ==========================================
export {
  getSubscriptionPlans,
  getCurrentSubscription,
  getSubscriptionDashboard,
  updateAutoRenew,
  changeSubscription,
  getSubscriptionHistory,
  getAdminSubscriptionPlans,
  updateAdminSubscriptionPlan,
  getAdminSubscriptionStats,
  getAdminUserSubscriptions,
} from './subscriptionService';

// ==========================================
// Payment Endpoints (Phase 16 - Razorpay Test Mode)
// ==========================================
export {
  createPaymentOrder,
  verifyPayment,
  getPaymentHistory,
  getAdminPayments,
  getAdminPaymentById,
} from './paymentService';

export default api;




