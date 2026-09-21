const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getActiveDevices,
  logoutCurrentDevice,
  logoutDeviceById,
  logoutAllDevices,
  getSecurityEvents,
} = require('../controllers/securityController');

// All security routes require active authenticated session
// Note: Static routes are defined BEFORE dynamic routes (/:deviceId)

// 1. Get active devices
router.get('/devices', authMiddleware, getActiveDevices);

// 2. Logout current device
router.post('/logout-device', authMiddleware, logoutCurrentDevice);

// 3. Logout all active devices
router.post('/logout-all', authMiddleware, logoutAllDevices);

// 4. Get recent security events
router.get('/events', authMiddleware, getSecurityEvents);

// 5. Logout specific device by ID (Dynamic route after static routes)
router.post('/devices/:deviceId/logout', authMiddleware, logoutDeviceById);

module.exports = router;
