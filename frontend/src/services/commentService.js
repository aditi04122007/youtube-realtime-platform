import api from './api';

/**
 * Get paginated top-level comments for a video
 * @param {number|string} videoId
 * @param {object} params - { page, limit, sort: 'top' | 'newest' | 'oldest' }
 */
export const getVideoComments = async (videoId, params = {}) => {
  const response = await api.get(`/videos/${videoId}/comments`, { params });
  return response.data;
};

/**
 * Post a new top-level comment or reply
 * @param {number|string} videoId
 * @param {object} data - { content: string, parentId?: number }
 */
export const createComment = async (videoId, data) => {
  const response = await api.post(`/videos/${videoId}/comments`, data);
  return response.data;
};

/**
 * Get paginated replies for a comment
 * @param {number|string} commentId
 * @param {object} params - { page, limit }
 */
export const getCommentReplies = async (commentId, params = {}) => {
  const response = await api.get(`/comments/${commentId}/replies`, { params });
  return response.data;
};

/**
 * Update a comment (owner only)
 * @param {number|string} commentId
 * @param {object} data - { content: string }
 */
export const updateComment = async (commentId, data) => {
  const response = await api.put(`/comments/${commentId}`, data);
  return response.data;
};

/**
 * Delete a comment (owner only)
 * @param {number|string} commentId
 */
export const deleteComment = async (commentId) => {
  const response = await api.delete(`/comments/${commentId}`);
  return response.data;
};

/**
 * Get comment like status and count
 * @param {number|string} commentId
 */
export const getCommentLike = async (commentId) => {
  const response = await api.get(`/comments/${commentId}/like`);
  return response.data;
};

/**
 * Like a comment
 * @param {number|string} commentId
 */
export const likeComment = async (commentId) => {
  const response = await api.post(`/comments/${commentId}/like`);
  return response.data;
};

/**
 * Remove like from a comment
 * @param {number|string} commentId
 */
export const unlikeComment = async (commentId) => {
  const response = await api.delete(`/comments/${commentId}/like`);
  return response.data;
};

export default {
  getVideoComments,
  createComment,
  getCommentReplies,
  updateComment,
  deleteComment,
  getCommentLike,
  likeComment,
  unlikeComment,
};
