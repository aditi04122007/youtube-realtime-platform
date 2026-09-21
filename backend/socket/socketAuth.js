const jwt = require('jsonwebtoken');
const config = require('../config');
const { pool } = require('../config/db');

/**
 * Parses cookies from cookie header string
 * @param {string} cookieHeader
 * @returns {Record<string, string>}
 */
const parseCookies = (cookieHeader) => {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return cookies;

  cookieHeader.split(';').forEach((item) => {
    const parts = item.split('=');
    const key = parts[0]?.trim();
    const val = parts.slice(1).join('=').trim();
    if (key) {
      cookies[key] = decodeURIComponent(val);
    }
  });

  return cookies;
};

/**
 * Socket.IO Handshake Authentication Middleware
 * Validates JWT token passed via auth.token, headers.authorization, or HTTP-only cookies
 */
const socketAuthMiddleware = async (socket, next) => {
  try {
    let token = null;

    // 1. Check handshake.auth.token
    if (socket.handshake?.auth?.token) {
      token = socket.handshake.auth.token;
      if (token.startsWith('Bearer ')) {
        token = token.slice(7).trim();
      }
    }

    // 2. Fallback to authorization header
    if (!token && socket.handshake?.headers?.authorization) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
      } else {
        token = authHeader.trim();
      }
    }

    // 3. Fallback to cookie
    if (!token && socket.handshake?.headers?.cookie) {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      if (cookies[config.cookieName]) {
        token = cookies[config.cookieName];
      }
    }

    if (!token) {
      return next(new Error('Authentication required: Missing token'));
    }

    // 4. Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      return next(new Error('Authentication required: Invalid or expired token'));
    }

    if (!decoded || !decoded.id) {
      return next(new Error('Authentication required: Invalid token payload'));
    }

    // 5. Verify user in database
    const [rows] = await pool.query(
      'SELECT id, username, email, role, status FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );

    if (rows.length === 0) {
      return next(new Error('Authentication required: User not found'));
    }

    const user = rows[0];
    if (user.status !== 'ACTIVE') {
      return next(new Error('Authentication required: User account is inactive or banned'));
    }

    // Attach authenticated user to socket
    socket.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch (err) {
    return next(new Error(`Authentication failed: ${err.message}`));
  }
};

module.exports = {
  socketAuthMiddleware,
  parseCookies,
};
