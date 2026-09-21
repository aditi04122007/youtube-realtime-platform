const { pool } = require('../config/db');
const config = require('../config');
const deviceService = require('../services/deviceService');
const securityEventService = require('../services/securityEventService');

/**
 * Security & Session Management Controller (Phase 5)
 */

/**
 * Get Active Devices for Authenticated User
 * GET /api/security/devices
 */
const getActiveDevices = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, session_id, device_name, device_type, browser, operating_system,
              ip_address, last_active_at, created_at
       FROM devices
       WHERE user_id = ? AND is_revoked = FALSE
       ORDER BY last_active_at DESC`,
      [req.user.id]
    );

    const devices = rows.map((row) => ({
      id: row.id,
      device_name: row.device_name || `${row.operating_system} (${row.browser})`,
      device_type: row.device_type || 'desktop',
      browser: row.browser,
      operating_system: row.operating_system,
      ip_address: deviceService.maskIp(row.ip_address),
      last_active_at: row.last_active_at,
      created_at: row.created_at,
      is_current: Boolean(req.user.sessionId && row.session_id === req.user.sessionId),
    }));

    return res.status(200).json({
      success: true,
      devices,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout Current Device Session
 * POST /api/security/logout-device
 */
const logoutCurrentDevice = async (req, res, next) => {
  try {
    if (req.user.sessionId) {
      await pool.execute(
        'UPDATE devices SET is_revoked = TRUE, revoked_at = CURRENT_TIMESTAMP WHERE session_id = ? AND user_id = ?',
        [req.user.sessionId, req.user.id]
      );
    }

    await securityEventService.logEvent({
      userId: req.user.id,
      eventType: 'DEVICE_REVOKED',
      req,
      deviceId: req.user.deviceId,
      metadata: { reason: 'user_initiated_device_logout' },
    });

    const isProduction = config.nodeEnv === 'production';
    res.clearCookie(config.cookieName, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
    });

    return res.status(200).json({
      success: true,
      message: 'Current device logged out',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout Another Device Session
 * POST /api/security/devices/:deviceId/logout
 */
const logoutDeviceById = async (req, res, next) => {
  try {
    const targetDeviceId = Number(req.params.deviceId);
    if (!targetDeviceId || isNaN(targetDeviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid device ID is required',
      });
    }

    // Verify ownership: Device must belong to authenticated user
    const [rows] = await pool.execute(
      'SELECT id, user_id, session_id, device_name FROM devices WHERE id = ? LIMIT 1',
      [targetDeviceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    const device = rows[0];

    // Strict user ID check to prevent IDOR attacks
    if (device.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only revoke your own devices.',
      });
    }

    // Revoke device session
    await pool.execute(
      'UPDATE devices SET is_revoked = TRUE, revoked_at = CURRENT_TIMESTAMP WHERE id = ?',
      [targetDeviceId]
    );

    await securityEventService.logEvent({
      userId: req.user.id,
      eventType: 'DEVICE_REVOKED',
      req,
      deviceId: targetDeviceId,
      metadata: { device_name: device.device_name },
    });

    // If the user revoked their currently active device, clear their cookie
    if (req.user.sessionId && device.session_id === req.user.sessionId) {
      const isProduction = config.nodeEnv === 'production';
      res.clearCookie(config.cookieName, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Device has been logged out',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout All Active Devices for User
 * POST /api/security/logout-all
 */
const logoutAllDevices = async (req, res, next) => {
  try {
    // Revoke all devices for this user
    await pool.execute(
      'UPDATE devices SET is_revoked = TRUE, revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_revoked = FALSE',
      [req.user.id]
    );

    await securityEventService.logEvent({
      userId: req.user.id,
      eventType: 'LOGOUT_ALL',
      req,
      metadata: { reason: 'user_initiated_logout_all' },
    });

    const isProduction = config.nodeEnv === 'production';
    res.clearCookie(config.cookieName, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
    });

    return res.status(200).json({
      success: true,
      message: 'All devices have been logged out',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Recent Security Events for User
 * GET /api/security/events
 */
const getSecurityEvents = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT se.id, se.event_type, se.ip_address, se.metadata_json, se.created_at,
              d.device_name, d.browser, d.operating_system
       FROM security_events se
       LEFT JOIN devices d ON se.device_id = d.id
       WHERE se.user_id = ?
       ORDER BY se.created_at DESC
       LIMIT 40`,
      [req.user.id]
    );

    const events = rows.map((row) => ({
      id: row.id,
      event_type: row.event_type,
      ip_address: deviceService.maskIp(row.ip_address),
      device: row.device_name || (row.operating_system ? `${row.operating_system} (${row.browser})` : 'System'),
      metadata: typeof row.metadata_json === 'string' ? JSON.parse(row.metadata_json) : row.metadata_json,
      created_at: row.created_at,
    }));

    return res.status(200).json({
      success: true,
      events,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActiveDevices,
  logoutCurrentDevice,
  logoutDeviceById,
  logoutAllDevices,
  getSecurityEvents,
};
