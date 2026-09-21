import api from './api';

/**
 * Fetch paginated Watch Later videos for authenticated user
 * GET /api/watch-later?page=1&limit=20
 */
export const getWatchLater = async ({ page = 1, limit = 20 } = {}) => {
  const response = await api.get('/watch-later', {
    params: { page, limit },
  });
  return response.data;
};

/**
 * Add a video to Watch Later queue
 * POST /api/watch-later/:videoId
 */
export const addToWatchLater = async (videoId) => {
  const response = await api.post(`/watch-later/${videoId}`);
  return response.data;
};

/**
 * Remove a video from Watch Later queue
 * DELETE /api/watch-later/:videoId
 */
export const removeFromWatchLater = async (videoId) => {
  const response = await api.delete(`/watch-later/${videoId}`);
  return response.data;
};

/**
 * Check if a video is in user's Watch Later queue
 * GET /api/watch-later/check/:videoId
 */
export const checkWatchLater = async (videoId) => {
  const response = await api.get(`/watch-later/check/${videoId}`);
  return response.data;
};
