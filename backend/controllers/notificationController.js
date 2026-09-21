const notificationService = require('../services/notificationService');

/**
 * GET /api/notifications
 * Get paginated list of notifications for authenticated user
 */
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page, limit, unreadOnly } = req.query;

    const result = await notificationService.getNotifications({
      userId,
      page,
      limit,
      unreadOnly,
    });

    return res.status(200).json({
      success: true,
      data: result.notifications,
      pagination: result.pagination,
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/notifications/unread-count
 * Fast endpoint for polling or refreshing unread counter
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const unreadCount = await notificationService.getUnreadCount(userId);

    return res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read
 */
const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const result = await notificationService.markAsRead({
      notificationId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * PUT /api/notifications/read-all
 * Mark all unread notifications as read
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await notificationService.markAllAsRead(userId);

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: result,
      unreadCount: 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/notifications/:id
 * Delete a specific notification
 */
const deleteNotification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const result = await notificationService.deleteNotification({
      notificationId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
