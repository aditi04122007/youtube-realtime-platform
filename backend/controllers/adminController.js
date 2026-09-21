const adminService = require('../services/adminService');

// Legacy placeholder
const getAdminPlaceholder = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Admin Dashboard API ready',
  });
};

// 1. Dashboard Overview & Analytics
const getDashboardStats = async (req, res, next) => {
  try {
    const { startDate, endDate, period } = req.query;
    const stats = await adminService.getDashboardStats({ startDate, endDate, period });
    return res.status(200).json({ success: true, stats });
  } catch (err) {
    next(err);
  }
};

const getDashboardCharts = async (req, res, next) => {
  try {
    const { period } = req.query;
    const charts = await adminService.getDashboardCharts({ period });
    return res.status(200).json({ success: true, charts });
  } catch (err) {
    next(err);
  }
};

// 2. User Management
const getUsers = async (req, res, next) => {
  try {
    const { page, limit, search, role, status, sortBy, sortOrder } = req.query;
    const result = await adminService.getUsers({
      page,
      limit,
      search,
      role,
      status,
      sortBy,
      sortOrder,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    const user = await adminService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

const suspendUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    const { reason } = req.body || {};
    const result = await adminService.suspendUser(req.user.id, userId, reason, req.ip);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

const unsuspendUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    const { reason } = req.body || {};
    const result = await adminService.unsuspendUser(req.user.id, userId, reason, req.ip);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

const banUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    const { reason } = req.body || {};
    const result = await adminService.banUser(req.user.id, userId, reason, req.ip);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    const { role, reason } = req.body || {};
    if (!role) {
      return res.status(400).json({ success: false, message: 'Role is required' });
    }
    const result = await adminService.updateUserRole(req.user.id, userId, role, reason, req.ip);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

const revokeUserSessions = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    const { reason } = req.body || {};
    const result = await adminService.revokeUserSessions(req.user.id, userId, reason, req.ip);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// 3. Channel Management
const getChannels = async (req, res, next) => {
  try {
    const { page, limit, search, status, sortBy, sortOrder } = req.query;
    const result = await adminService.getChannels({
      page,
      limit,
      search,
      status,
      sortBy,
      sortOrder,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const suspendChannel = async (req, res, next) => {
  try {
    const channelId = parseInt(req.params.channelId, 10);
    if (isNaN(channelId) || channelId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid channel ID' });
    }
    const { reason } = req.body || {};
    const result = await adminService.suspendChannel(req.user.id, channelId, reason, req.ip);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

const restoreChannel = async (req, res, next) => {
  try {
    const channelId = parseInt(req.params.channelId, 10);
    if (isNaN(channelId) || channelId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid channel ID' });
    }
    const { reason } = req.body || {};
    const result = await adminService.restoreChannel(req.user.id, channelId, reason, req.ip);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

// 4. Video Management
const getVideos = async (req, res, next) => {
  try {
    const { page, limit, search, status, visibility, categoryId, sortBy, sortOrder } = req.query;
    const result = await adminService.getVideos({
      page,
      limit,
      search,
      status,
      visibility,
      categoryId,
      sortBy,
      sortOrder,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const getVideoById = async (req, res, next) => {
  try {
    const videoId = parseInt(req.params.videoId, 10);
    if (isNaN(videoId) || videoId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid video ID' });
    }
    const video = await adminService.getVideoById(videoId);
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
    return res.status(200).json({ success: true, video });
  } catch (err) {
    next(err);
  }
};

const updateVideoStatus = async (req, res, next) => {
  try {
    const videoId = parseInt(req.params.videoId, 10);
    if (isNaN(videoId) || videoId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid video ID' });
    }
    const { status, reason } = req.body || {};
    if (!status) return res.status(400).json({ success: false, message: 'Status is required' });
    const result = await adminService.updateVideoStatus(req.user.id, videoId, status, reason, req.ip);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

const updateVideoVisibility = async (req, res, next) => {
  try {
    const videoId = parseInt(req.params.videoId, 10);
    if (isNaN(videoId) || videoId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid video ID' });
    }
    const { visibility, reason } = req.body || {};
    if (!visibility) return res.status(400).json({ success: false, message: 'Visibility is required' });
    const result = await adminService.updateVideoVisibility(req.user.id, videoId, visibility, reason, req.ip);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

// 5. Comment Moderation
const getComments = async (req, res, next) => {
  try {
    const { page, limit, search, status, videoId, sortBy, sortOrder } = req.query;
    const result = await adminService.getComments({
      page,
      limit,
      search,
      status,
      videoId,
      sortBy,
      sortOrder,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const updateCommentStatus = async (req, res, next) => {
  try {
    const commentId = parseInt(req.params.commentId, 10);
    if (isNaN(commentId) || commentId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID' });
    }
    const { status, reason } = req.body || {};
    if (!status) return res.status(400).json({ success: false, message: 'Status is required' });
    const result = await adminService.updateCommentStatus(req.user.id, commentId, status, reason, req.ip);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

// 6. Reports Management
const getUnifiedReports = async (req, res, next) => {
  try {
    const { page, limit, status, type, search, sortBy, sortOrder } = req.query;
    const result = await adminService.getReports({
      page,
      limit,
      status,
      type,
      search,
      sortBy,
      sortOrder,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const resolveReport = async (req, res, next) => {
  try {
    const reportId = parseInt(req.params.reportId, 10);
    if (isNaN(reportId) || reportId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid report ID' });
    }
    const { resolutionNote } = req.body || {};
    const result = await adminService.resolveReport(req.user.id, reportId, resolutionNote, req.ip);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

const dismissReport = async (req, res, next) => {
  try {
    const reportId = parseInt(req.params.reportId, 10);
    if (isNaN(reportId) || reportId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid report ID' });
    }
    const { resolutionNote } = req.body || {};
    const result = await adminService.dismissReport(req.user.id, reportId, resolutionNote, req.ip);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

// 7. Downloads Management
const getDownloadStats = async (req, res, next) => {
  try {
    const stats = await adminService.getDownloadStats();
    return res.status(200).json({ success: true, stats });
  } catch (err) {
    next(err);
  }
};

const getDownloads = async (req, res, next) => {
  try {
    const { page, limit, search, status } = req.query;
    const result = await adminService.getDownloads({ page, limit, search, status });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// 8. Video Calls Management
const getCallRooms = async (req, res, next) => {
  try {
    const { page, limit, status, roomType, search } = req.query;
    const result = await adminService.getCallRooms({ page, limit, status, roomType, search });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const endCallRoom = async (req, res, next) => {
  try {
    const { roomCode } = req.params;
    if (!roomCode) {
      return res.status(400).json({ success: false, message: 'Room code is required' });
    }
    const { reason } = req.body || {};
    const result = await adminService.endCallRoom(req.user.id, roomCode, reason, req.ip);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

// 9. Activity & Audit Trail
const getActivityLogs = async (req, res, next) => {
  try {
    const { page, limit, adminId, actionType, targetType, search, startDate, endDate } = req.query;
    const result = await adminService.getActivityLogs({
      page,
      limit,
      adminId,
      actionType,
      targetType,
      search,
      startDate,
      endDate,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// 10. System Health
const getSystemInfo = async (req, res, next) => {
  try {
    const info = await adminService.getSystemInfo();
    return res.status(200).json({ success: true, info });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAdminPlaceholder,
  getDashboardStats,
  getDashboardCharts,
  getUsers,
  getUserById,
  suspendUser,
  unsuspendUser,
  banUser,
  updateUserRole,
  revokeUserSessions,
  getChannels,
  suspendChannel,
  restoreChannel,
  getVideos,
  getVideoById,
  updateVideoStatus,
  updateVideoVisibility,
  getComments,
  updateCommentStatus,
  getUnifiedReports,
  resolveReport,
  dismissReport,
  getDownloadStats,
  getDownloads,
  getCallRooms,
  endCallRoom,
  getActivityLogs,
  getSystemInfo,
};
