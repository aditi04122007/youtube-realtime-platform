import api from './api';

/**
 * Admin API Service
 * Centralized client for all Phase 29 platform management operations
 */

// 1. Dashboard Overview & Telemetry
export const getAdminStats = async (params = {}) => {
  const res = await api.get('/admin/stats', { params });
  return res.data;
};

export const getAdminCharts = async (params = {}) => {
  const res = await api.get('/admin/charts', { params });
  return res.data;
};

export const getAdminSystemInfo = async () => {
  const res = await api.get('/admin/system');
  return res.data;
};

// 2. User Management
export const getAdminUsers = async (params = {}) => {
  const res = await api.get('/admin/users', { params });
  return res.data;
};

export const getAdminUserById = async (userId) => {
  const res = await api.get(`/admin/users/${userId}`);
  return res.data;
};

export const suspendUser = async (userId, reason) => {
  const res = await api.post(`/admin/users/${userId}/suspend`, { reason });
  return res.data;
};

export const unsuspendUser = async (userId, reason) => {
  const res = await api.post(`/admin/users/${userId}/unsuspend`, { reason });
  return res.data;
};

export const banUser = async (userId, reason) => {
  const res = await api.post(`/admin/users/${userId}/ban`, { reason });
  return res.data;
};

export const updateUserRole = async (userId, role, reason) => {
  const res = await api.put(`/admin/users/${userId}/role`, { role, reason });
  return res.data;
};

export const revokeUserSessions = async (userId, reason) => {
  const res = await api.post(`/admin/users/${userId}/revoke-sessions`, { reason });
  return res.data;
};

// 3. Channel Management
export const getAdminChannels = async (params = {}) => {
  const res = await api.get('/admin/channels', { params });
  return res.data;
};

export const suspendChannel = async (channelId, reason) => {
  const res = await api.post(`/admin/channels/${channelId}/suspend`, { reason });
  return res.data;
};

export const restoreChannel = async (channelId, reason) => {
  const res = await api.post(`/admin/channels/${channelId}/restore`, { reason });
  return res.data;
};

// 4. Video Management
export const getAdminVideos = async (params = {}) => {
  const res = await api.get('/admin/videos', { params });
  return res.data;
};

export const getAdminVideoById = async (videoId) => {
  const res = await api.get(`/admin/videos/${videoId}`);
  return res.data;
};

export const updateVideoStatus = async (videoId, status, reason) => {
  const res = await api.put(`/admin/videos/${videoId}/status`, { status, reason });
  return res.data;
};

export const updateVideoVisibility = async (videoId, visibility, reason) => {
  const res = await api.put(`/admin/videos/${videoId}/visibility`, { visibility, reason });
  return res.data;
};

// 5. Comment Moderation
export const getAdminComments = async (params = {}) => {
  const res = await api.get('/admin/comments', { params });
  return res.data;
};

export const updateCommentStatus = async (commentId, status, reason) => {
  const res = await api.put(`/admin/comments/${commentId}/status`, { status, reason });
  return res.data;
};

// 6. Reports Management
export const getAdminReports = async (params = {}) => {
  const res = await api.get('/admin/unified-reports', { params });
  return res.data;
};

export const resolveReport = async (reportId, resolutionNote) => {
  const res = await api.post(`/admin/reports/${reportId}/resolve`, { resolutionNote });
  return res.data;
};

export const dismissReport = async (reportId, resolutionNote) => {
  const res = await api.post(`/admin/reports/${reportId}/dismiss-unified`, { resolutionNote });
  return res.data;
};

// 7. Subscriptions & Payments
export const getAdminPlans = async () => {
  const res = await api.get('/admin/subscriptions/plans');
  return res.data;
};

export const getAdminSubscriptionStats = async () => {
  const res = await api.get('/admin/subscriptions/stats');
  return res.data;
};

export const getAdminUserSubscriptions = async (params = {}) => {
  const res = await api.get('/admin/subscriptions/users', { params });
  return res.data;
};

export const getAdminPayments = async (params = {}) => {
  const res = await api.get('/admin/payments', { params });
  return res.data;
};

// 8. Downloads Telemetry
export const getAdminDownloadStats = async () => {
  const res = await api.get('/admin/downloads/stats');
  return res.data;
};

export const getAdminDownloads = async (params = {}) => {
  const res = await api.get('/admin/downloads', { params });
  return res.data;
};

// 9. Video Calls Monitoring
export const getAdminCalls = async (params = {}) => {
  const res = await api.get('/admin/calls', { params });
  return res.data;
};

export const endAdminCallRoom = async (roomCode, reason) => {
  const res = await api.post(`/admin/calls/${roomCode}/end`, { reason });
  return res.data;
};

// 10. Audit Logs & Activity
export const getAdminActivityLogs = async (params = {}) => {
  const res = await api.get('/admin/activity', { params });
  return res.data;
};
