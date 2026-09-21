import api from './api';

/**
 * Fetch supported comment report reasons
 * GET /api/reports/reasons
 * @returns {Promise<{success: boolean, reasons: Array<{code: string, label: string, description: string}>}>}
 */
export const getReportReasons = async () => {
  const response = await api.get('/reports/reasons');
  return response.data;
};

/**
 * Submit a moderation report against a comment or reply
 * POST /api/comments/:commentId/reports
 * @param {number|string} commentId
 * @param {{reason: string, description?: string}} data
 * @returns {Promise<{success: boolean, message: string, report: Object}>}
 */
export const submitCommentReport = async (commentId, data) => {
  const response = await api.post(`/comments/${commentId}/reports`, data);
  return response.data;
};

/**
 * Fetch moderation reports queue for admin review
 * GET /api/admin/reports
 * @param {Object} params - { page, limit, status, reason, search, sort }
 * @returns {Promise<{success: boolean, reports: Array, pagination: Object}>}
 */
export const getAdminReports = async (params = {}) => {
  const response = await api.get('/admin/reports', { params });
  return response.data;
};

/**
 * Fetch single report details
 * GET /api/admin/reports/:reportId
 * @param {number|string} reportId
 * @returns {Promise<{success: boolean, report: Object}>}
 */
export const getAdminReport = async (reportId) => {
  const response = await api.get(`/admin/reports/${reportId}`);
  return response.data;
};

/**
 * Dismiss a report without moderating the comment
 * POST /api/admin/reports/:reportId/dismiss
 * @param {number|string} reportId
 * @param {string} [note]
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const dismissReport = async (reportId, note = '') => {
  const response = await api.post(`/admin/reports/${reportId}/dismiss`, { note });
  return response.data;
};

/**
 * Mark a report as reviewed
 * POST /api/admin/reports/:reportId/review
 * @param {number|string} reportId
 * @param {string} [note]
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const reviewReport = async (reportId, note = '') => {
  const response = await api.post(`/admin/reports/${reportId}/review`, { note });
  return response.data;
};

/**
 * Execute moderation action on a reported comment (HIDE_COMMENT, REMOVE_COMMENT, NO_ACTION)
 * POST /api/admin/reports/:reportId/action
 * @param {number|string} reportId
 * @param {'HIDE_COMMENT'|'REMOVE_COMMENT'|'NO_ACTION'} action
 * @param {string} [note]
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const takeModerationAction = async (reportId, action, note = '') => {
  const response = await api.post(`/admin/reports/${reportId}/action`, { action, note });
  return response.data;
};

/**
 * Fetch administrative moderation audit history
 * GET /api/admin/audit-logs
 * @param {Object} params - { page, limit }
 * @returns {Promise<{success: boolean, logs: Array, pagination: Object}>}
 */
export const getAdminAuditLogs = async (params = {}) => {
  const response = await api.get('/admin/audit-logs', { params });
  return response.data;
};
