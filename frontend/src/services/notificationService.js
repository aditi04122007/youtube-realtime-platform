import api from './api';

/**
 * Fetch paginated notifications for current user
 * @param {object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {boolean} [params.unreadOnly=false]
 */
export const fetchNotifications = async ({ page = 1, limit = 20, unreadOnly = false } = {}) => {
  const res = await api.get('/notifications', {
    params: { page, limit, unreadOnly },
  });
  return res.data;
};

/**
 * Fetch current unread notifications count
 */
export const fetchUnreadCount = async () => {
  const res = await api.get('/notifications/unread-count');
  return res.data;
};

/**
 * Mark a single notification as read
 * @param {number|string} id
 */
export const markNotificationAsRead = async (id) => {
  const res = await api.put(`/notifications/${id}/read`);
  return res.data;
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async () => {
  const res = await api.put('/notifications/read-all');
  return res.data;
};

/**
 * Delete a single notification
 * @param {number|string} id
 */
export const deleteNotification = async (id) => {
  const res = await api.delete(`/notifications/${id}`);
  return res.data;
};

/**
 * Subscribe to a channel
 * @param {number|string} channelId
 */
export const subscribeToChannel = async (channelId) => {
  const res = await api.post(`/channels/${channelId}/subscribe`);
  return res.data;
};

/**
 * Unsubscribe from a channel
 * @param {number|string} channelId
 */
export const unsubscribeFromChannel = async (channelId) => {
  const res = await api.delete(`/channels/${channelId}/subscribe`);
  return res.data;
};

/**
 * Get channel subscription status for current user
 * @param {number|string} channelId
 */
export const getChannelSubscriptionStatus = async (channelId) => {
  const res = await api.get(`/channels/${channelId}/subscription-status`);
  return res.data;
};

export default {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  subscribeToChannel,
  unsubscribeFromChannel,
  getChannelSubscriptionStatus,
};
