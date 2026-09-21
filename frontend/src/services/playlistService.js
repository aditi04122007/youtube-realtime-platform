import api from './api';

/**
 * Fetch authenticated user's playlists with pagination
 * GET /api/playlists?page=1&limit=20
 */
export const getPlaylists = async ({ page = 1, limit = 20 } = {}) => {
  const response = await api.get('/playlists', {
    params: { page, limit },
  });
  return response.data;
};

/**
 * Fetch single playlist details with ordered videos
 * GET /api/playlists/:id
 */
export const getPlaylist = async (id) => {
  const response = await api.get(`/playlists/${id}`);
  return response.data;
};

/**
 * Create a new playlist
 * POST /api/playlists
 */
export const createPlaylist = async ({ name, description = '', visibility = 'PRIVATE' }) => {
  const response = await api.post('/playlists', {
    name,
    description,
    visibility,
  });
  return response.data;
};

/**
 * Update playlist metadata (owner only)
 * PUT /api/playlists/:id
 */
export const updatePlaylist = async (id, { name, description, visibility }) => {
  const response = await api.put(`/playlists/${id}`, {
    name,
    description,
    visibility,
  });
  return response.data;
};

/**
 * Delete a playlist (owner only)
 * DELETE /api/playlists/:id
 */
export const deletePlaylist = async (id) => {
  const response = await api.delete(`/playlists/${id}`);
  return response.data;
};

/**
 * Add a video to a playlist
 * POST /api/playlists/:id/videos
 */
export const addVideoToPlaylist = async (playlistId, videoId) => {
  const response = await api.post(`/playlists/${playlistId}/videos`, {
    videoId,
  });
  return response.data;
};

/**
 * Remove a video from a playlist
 * DELETE /api/playlists/:id/videos/:videoId
 */
export const removeVideoFromPlaylist = async (playlistId, videoId) => {
  const response = await api.delete(`/playlists/${playlistId}/videos/${videoId}`);
  return response.data;
};

/**
 * Reorder videos in a playlist
 * PUT /api/playlists/:id/reorder
 */
export const reorderPlaylist = async (playlistId, videoIds) => {
  const response = await api.put(`/playlists/${playlistId}/reorder`, {
    videoIds,
  });
  return response.data;
};

/**
 * Check which playlists contain a specific video
 * GET /api/playlists/check-video/:videoId
 */
export const checkVideoInPlaylists = async (videoId) => {
  const response = await api.get(`/playlists/check-video/${videoId}`);
  return response.data;
};
