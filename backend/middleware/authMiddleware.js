const jwt = require('jsonwebtoken');
const config = require('../config');
const { pool } = require('../config/db');

/**
 * Enhanced Authentication Middleware (Phase 5)
 * Validates JWT, verifies account status, checks database-backed session/device state,
 * ensures session has not been revoked, and updates last_active_at.
 */
const authMiddleware = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check HTTP-only cookie first
    if (req.cookies && req.cookies[config.cookieName]) {
      token = req.cookies[config.cookieName];
    }
    // 2. Fallback to Authorization Bearer header
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // 3. Verify JWT signature
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // 4. Verify user exists in database and is ACTIVE
    const [rows] = await pool.execute(
      'SELECT id, username, email, role, status, email_verified FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const user = rows[0];

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: user.status === 'BANNED' ? 'Account is permanently banned' : 'Account is suspended or deactivated',
        status: user.status,
      });
    }

    // 5. Database-Backed Session & Device Validation (Phase 5)
    let deviceId = null;
    let sessionId = null;

    if (decoded.sessionId) {
      const [deviceRows] = await pool.execute(
        'SELECT id, is_revoked, last_active_at FROM devices WHERE session_id = ? AND user_id = ? LIMIT 1',
        [decoded.sessionId, user.id]
      );

      if (deviceRows.length === 0 || deviceRows[0].is_revoked) {
        return res.status(401).json({
          success: false,
          message: 'Session has been revoked or expired. Please sign in again.',
          sessionRevoked: true,
        });
      }

      deviceId = deviceRows[0].id;
      sessionId = decoded.sessionId;

      // Throttle last_active_at updates (update at most once every 60 seconds)
      const lastActive = deviceRows[0].last_active_at ? new Date(deviceRows[0].last_active_at).getTime() : 0;
      if (Date.now() - lastActive > 60 * 1000) {
        pool.execute(
          'UPDATE devices SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?',
          [deviceId]
        ).catch(() => {});
      }
    }

    // 6. Attach authenticated user payload to request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      email_verified: Boolean(user.email_verified),
      sessionId,
      deviceId,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }
};

/**
 * Optional Authentication Middleware
 * Populates req.user if a valid token is present, but allows the request to continue if not.
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;

    if (req.cookies && req.cookies[config.cookieName]) {
      token = req.cookies[config.cookieName];
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      req.user = null;
      return next();
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      req.user = null;
      return next();
    }

    if (!decoded || !decoded.id) {
      req.user = null;
      return next();
    }

    const [rows] = await pool.execute(
      'SELECT id, username, email, role, status, email_verified FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );

    if (rows.length === 0 || rows[0].status !== 'ACTIVE') {
      req.user = null;
      return next();
    }

    const user = rows[0];
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      email_verified: Boolean(user.email_verified),
    };

    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.optionalAuth = optionalAuth;
