import api from './api';

/**
 * Fetch current user's monthly download quota and usage
 * GET /api/download-history/quota
 */
export const getDownloadQuota = async () => {
  const response = await api.get('/download-history/quota');
  return response.data;
};

/**
 * Fetch paginated download history for authenticated user
 * GET /api/download-history?page=1&limit=20
 *
 * @param {Object} params - { page, limit }
 */
export const getDownloadHistory = async ({ page = 1, limit = 20 } = {}) => {
  const response = await api.get('/download-history', {
    params: { page, limit },
  });
  return response.data;
};

/**
 * Fetch download summary metrics
 * GET /api/download-history/summary
 */
export const getDownloadSummary = async () => {
  const response = await api.get('/download-history/summary');
  return response.data;
};

/**
 * Soft delete a download history item
 * DELETE /api/download-history/:id
 *
 * @param {number|string} id - History record ID
 */
export const deleteDownloadHistory = async (id) => {
  const response = await api.delete(`/download-history/${id}`);
  return response.data;
};
