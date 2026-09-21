const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const config = require('../config');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const adminController = require('../controllers/adminController');
const {
  getAdminReports,
  getAdminReportById,
  dismissReport,
  reviewReport,
  takeModerationAction,
  getAdminAuditLogs,
} = require('../controllers/adminModerationController');
const {
  getAdminPlans,
  updateAdminPlan,
  getAdminSubscriptionStats,
  getAdminUserSubscriptions,
} = require('../controllers/adminSubscriptionController');
const {
  getAdminPayments,
  getAdminPaymentById,
} = require('../controllers/paymentController');

// All admin endpoints strictly require authentication and ADMIN role verification
router.use(authMiddleware);
router.use(adminMiddleware);

// Dedicated rate limiter for sensitive admin state mutations (Phase 30)
const adminActionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.nodeEnv === 'production' ? 60 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many administrative requests, please slow down',
  },
});

// --- 1. Dashboard Overview, Metrics, and System Health ---
router.get('/', adminController.getAdminPlaceholder);
router.get('/metrics', adminController.getAdminPlaceholder);
router.get('/stats', adminController.getDashboardStats);
router.get('/charts', adminController.getDashboardCharts);
router.get('/system', adminController.getSystemInfo);

// --- 2. User Management ---
router.get('/users', adminController.getUsers);
router.get('/users/:userId', adminController.getUserById);
router.post('/users/:userId/suspend', adminActionLimiter, adminController.suspendUser);
router.post('/users/:userId/unsuspend', adminActionLimiter, adminController.unsuspendUser);
router.post('/users/:userId/ban', adminActionLimiter, adminController.banUser);
router.put('/users/:userId/role', adminActionLimiter, adminController.updateUserRole);
router.post('/users/:userId/revoke-sessions', adminActionLimiter, adminController.revokeUserSessions);

// --- 3. Channel Management ---
router.get('/channels', adminController.getChannels);
router.post('/channels/:channelId/suspend', adminActionLimiter, adminController.suspendChannel);
router.post('/channels/:channelId/restore', adminActionLimiter, adminController.restoreChannel);

// --- 4. Video Management & Moderation ---
router.get('/videos', adminController.getVideos);
router.get('/videos/:videoId', adminController.getVideoById);
router.put('/videos/:videoId/status', adminActionLimiter, adminController.updateVideoStatus);
router.put('/videos/:videoId/visibility', adminActionLimiter, adminController.updateVideoVisibility);

// --- 5. Comment Moderation ---
router.get('/comments', adminController.getComments);
router.put('/comments/:commentId/status', adminActionLimiter, adminController.updateCommentStatus);

// --- 6. Content Reports (Unified & Legacy) ---
router.get('/unified-reports', adminController.getUnifiedReports);
router.post('/reports/:reportId/resolve', adminActionLimiter, adminController.resolveReport);
router.post('/reports/:reportId/dismiss-unified', adminActionLimiter, adminController.dismissReport);

// Phase 14 Legacy Comment Moderation Queue & Actions (preserved for 100% compatibility)
router.get('/reports', getAdminReports);
router.get('/reports/:reportId', getAdminReportById);
router.post('/reports/:reportId/dismiss', dismissReport);
router.post('/reports/:reportId/review', reviewReport);
router.post('/reports/:reportId/action', takeModerationAction);

// --- 7. Subscriptions & Plans (Phase 15 preserved) ---
router.get('/subscriptions/plans', getAdminPlans);
router.put('/subscriptions/plans/:planId', updateAdminPlan);
router.get('/subscriptions/stats', getAdminSubscriptionStats);
router.get('/subscriptions/users', getAdminUserSubscriptions);

// --- 8. Payments & Ledger (Phase 16 preserved) ---
router.get('/payments', getAdminPayments);
router.get('/payments/:id', getAdminPaymentById);

// --- 9. Downloads Telemetry ---
router.get('/downloads/stats', adminController.getDownloadStats);
router.get('/downloads', adminController.getDownloads);

// --- 10. Video Call Monitoring & Termination ---
router.get('/calls', adminController.getCallRooms);
router.post('/calls/:roomCode/end', adminController.endCallRoom);

// --- 11. Immutable Audit Trail & Activity Logs ---
router.get('/activity', adminController.getActivityLogs);
router.get('/audit-logs', getAdminAuditLogs); // Phase 14 alias preserved

module.exports = router;
