import api from './api';

/**
 * Upload a video with optional thumbnail and metadata
 * Tracks upload progress via Axios onUploadProgress
 *
 * @param {FormData} formData - Multipart form data
 * @param {Function} onProgress - Callback receiving percentage number (0-100)
 * @param {AbortSignal} signal - Optional abort signal for cancellation
 */
export const uploadVideo = async (formData, onProgress = null, signal = null) => {
  const response = await api.post('/videos/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    signal,
    timeout: 0,
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted, progressEvent.loaded, progressEvent.total);
      }
    },
  });
  return response.data;
};

/**
 * Fetch authenticated creator's videos
 * GET /api/videos/my
 */
export const getMyVideos = async (params = {}) => {
  const response = await api.get('/videos/my', { params });
  return response.data;
};

/**
 * Get video details by ID
 * GET /api/videos/:id
 */
export const getVideoById = async (id) => {
  const response = await api.get(`/videos/${id}`);
  return response.data;
};

/**
 * Get direct stream URL for a video ID
 * @param {string|number} videoId
 * @returns {string} Absolute streaming URL
 */
export const getVideoStreamUrl = (videoId) => {
  if (!videoId) return '';
  const rootBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  return `${rootBase}/api/videos/${videoId}/stream`;
};

/**
 * Update video metadata and optional thumbnail
 * PUT /api/videos/:id
 */
export const updateVideo = async (id, data) => {
  const isFormData = data instanceof FormData;
  const config = isFormData
    ? { headers: { 'Content-Type': 'multipart/form-data' } }
    : {};
  const response = await api.put(`/videos/${id}`, data, config);
  return response.data;
};

/**
 * Delete a video by ID
 * DELETE /api/videos/:id
 */
export const deleteVideo = async (id) => {
  const response = await api.delete(`/videos/${id}`);
  return response.data;
};

/**
 * Fetch public videos for a channel
 * GET /api/videos/channel/:channelId
 */
export const getChannelVideos = async (channelId, params = {}) => {
  const response = await api.get(`/videos/channel/${channelId}`, { params });
  return response.data;
};

/**
 * Fetch available video categories
 * GET /api/categories (with fallback /videos/categories)
 */
export const getVideoCategories = async () => {
  try {
    const response = await api.get('/categories');
    return {
      success: true,
      data: response.data.categories || response.data.data || [],
      categories: response.data.categories || response.data.data || [],
    };
  } catch {
    const response = await api.get('/videos/categories');
    return response.data;
  }
};

export const getCategories = getVideoCategories;

// ==========================================
// Video Search & Catalog Endpoints (Phase 8)
// ==========================================

/**
 * Search video catalog with filters, sorting, and pagination
 * GET /api/videos/search
 *
 * @param {Object} params - { q, category, tag, channel, sort, date, duration, page, limit }
 * @param {AbortSignal} signal - Optional abort signal
 */
export const searchVideos = async (params = {}, signal = null) => {
  const response = await api.get('/videos/search', {
    params,
    signal,
  });
  return response.data;
};

/**
 * Fetch search autocomplete suggestions
 * GET /api/videos/suggestions?q=...
 *
 * @param {string} query - Keyword prefix
 * @param {AbortSignal} signal - Optional abort signal
 */
export const getSearchSuggestions = async (query = '', signal = null) => {
  const response = await api.get('/videos/suggestions', {
    params: { q: query },
    signal,
  });
  return response.data;
};

/**
 * Fetch related videos for a video
 * GET /api/videos/related/:videoId
 *
 * @param {number|string} videoId
 * @param {number} limit
 */
export const getRelatedVideos = async (videoId, limit = 10) => {
  const response = await api.get(`/videos/related/${videoId}`, {
    params: { limit },
  });
  return response.data;
};

// ==========================================
// Search History Endpoints (Phase 8)
// ==========================================

/**
 * Fetch current user's search history
 * GET /api/search-history
 */
export const getSearchHistory = async () => {
  const response = await api.get('/search-history');
  return response.data;
};

/**
 * Record a search query in user's history
 * POST /api/search-history
 */
export const addSearchHistory = async (query) => {
  const response = await api.post('/search-history', { query });
  return response.data;
};

/**
 * Delete single search history item
 * DELETE /api/search-history/:id
 */
export const deleteSearchHistoryItem = async (id) => {
  const response = await api.delete(`/search-history/${id}`);
  return response.data;
};

/**
 * Clear all search history for current user
 * DELETE /api/search-history
 */
export const clearSearchHistory = async () => {
  const response = await api.delete('/search-history');
  return response.data;
};

/**
 * Fetch authenticated user's watch history (paginated, newest first)
 * GET /api/watch-history
 */
export const getWatchHistory = async (params = {}) => {
  const response = await api.get('/watch-history', { params });
  return response.data;
};

/**
 * Fetch incomplete videos for the Continue Watching shelf
 * GET /api/watch-history/continue-watching
 */
export const getContinueWatching = async () => {
  const response = await api.get('/watch-history/continue-watching');
  return response.data;
};

/**
 * Get watch progress / resume point for a single video
 * GET /api/watch-history/:videoId
 */
export const getVideoWatchHistory = async (videoId) => {
  const response = await api.get(`/watch-history/${videoId}`);
  return response.data;
};

/**
 * Save or update watch progress for a video (UPSERT)
 * POST /api/watch-history
 * @param {Object} data - { videoId, progressSeconds, durationSeconds, completed }
 */
export const saveWatchProgress = async (data) => {
  const response = await api.post('/watch-history', data);
  return response.data;
};

/**
 * Remove a single video from watch history
 * DELETE /api/watch-history/:videoId
 */
export const deleteWatchHistoryItem = async (videoId) => {
  const response = await api.delete(`/watch-history/${videoId}`);
  return response.data;
};

/**
 * Clear all watch history for current user
 * DELETE /api/watch-history
 */
export const clearWatchHistory = async () => {
  const response = await api.delete('/watch-history');
  return response.data;
};

/**
 * Fetch current user's reaction for a video and current counts
 * GET /api/videos/:videoId/reaction
 */
export const getVideoReaction = async (videoId) => {
  const response = await api.get(`/videos/${videoId}/reaction`);
  return response.data;
};

/**
 * Set or toggle reaction on a video
 * POST /api/videos/:videoId/reaction
 * @param {string|number} videoId
 * @param {string} reaction - 'LIKE' | 'DISLIKE'
 */
export const setVideoReaction = async (videoId, reaction) => {
  const response = await api.post(`/videos/${videoId}/reaction`, { reaction });
  return response.data;
};

/**
 * Remove user's reaction on a video
 * DELETE /api/videos/:videoId/reaction
 */
export const removeVideoReaction = async (videoId) => {
  const response = await api.delete(`/videos/${videoId}/reaction`);
  return response.data;
};

/**
 * Fetch video access permissions and metadata
 * GET /api/videos/:id/access
 */
export const getVideoAccess = async (id) => {
  const response = await api.get(`/videos/${id}/access`);
  return response.data;
};

/**
 * Fetch download access permissions and metadata for a video (Phase 19)
 * GET /api/videos/:id/download-access
 */
export const getVideoDownloadAccess = async (id) => {
  const response = await api.get(`/videos/${id}/download-access`);
  return response.data;
};

/**
 * Downloads a video using browser fetch with credentials, extracts filename
 * from Content-Disposition header, and triggers a file save dialog.
 *
 * @param {number|string} videoId
 * @returns {Promise<void>}
 */
export const downloadVideo = async (videoId) => {
  const rootBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  const url = `${rootBase}/api/videos/${videoId}/download`;

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    let errMsg = 'Failed to download video';
    try {
      const errData = await response.json();
      errMsg = errData.message || errMsg;
    } catch (e) {}
    const err = new Error(errMsg);
    err.status = response.status;
    throw err;
  }

  // Extract filename from Content-Disposition header if available
  const disposition = response.headers.get('content-disposition');
  let filename = `video-${videoId}.mp4`;
  if (disposition && disposition.indexOf('filename=') !== -1) {
    const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
    if (matches != null && matches[1]) {
      filename = matches[1].replace(/['"]/g, '').trim();
    }
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  }, 1000);
};

export default {
  uploadVideo,
  getMyVideos,
  getVideoById,
  getVideoAccess,
  getVideoDownloadAccess,
  downloadVideo,
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
};
