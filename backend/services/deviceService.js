const crypto = require('crypto');
const { pool } = require('../config/db');

/**
 * Service for IP extraction, User-Agent classification, device tracking,
 * and cryptographic session binding.
 */
class DeviceService {
  /**
   * Safely extract client IP address from Express request
   */
  getClientIp(req) {
    let ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';

    // Normalize IPv6 mapped IPv4 address (e.g. ::ffff:127.0.0.1)
    if (ip.startsWith('::ffff:')) {
      ip = ip.replace('::ffff:', '');
    } else if (ip === '::1') {
      ip = '127.0.0.1';
    }

    return String(ip).slice(0, 45);
  }

  /**
   * Parse user agent into structured browser, operating system, and device type
   */
  parseUserAgent(userAgentString = '') {
    const ua = String(userAgentString);

    let browser = 'Unknown Browser';
    let operating_system = 'Unknown OS';
    let device_type = 'desktop';

    // 1. Operating System detection
    if (/windows phone/i.test(ua)) {
      operating_system = 'Windows Phone';
      device_type = 'mobile';
    } else if (/windows nt 10/i.test(ua)) {
      operating_system = 'Windows 10/11';
    } else if (/windows nt 6\.3/i.test(ua)) {
      operating_system = 'Windows 8.1';
    } else if (/windows/i.test(ua)) {
      operating_system = 'Windows';
    } else if (/ipad/i.test(ua)) {
      operating_system = 'iPadOS';
      device_type = 'tablet';
    } else if (/iphone|ipod/i.test(ua)) {
      operating_system = 'iOS';
      device_type = 'mobile';
    } else if (/android/i.test(ua)) {
      operating_system = 'Android';
      device_type = /mobile/i.test(ua) ? 'mobile' : 'tablet';
    } else if (/mac os x|macintosh/i.test(ua)) {
      operating_system = 'macOS';
    } else if (/linux/i.test(ua)) {
      operating_system = 'Linux';
    }

    // 2. Browser detection
    if (/edg\//i.test(ua)) {
      browser = 'Microsoft Edge';
    } else if (/opr\/|opera/i.test(ua)) {
      browser = 'Opera';
    } else if (/chrome|crios/i.test(ua)) {
      browser = 'Chrome';
    } else if (/firefox|fxios/i.test(ua)) {
      browser = 'Firefox';
    } else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) {
      browser = 'Safari';
    } else if (/postmanruntime/i.test(ua)) {
      browser = 'Postman API Client';
    } else if (/curl/i.test(ua)) {
      browser = 'cURL';
    }

    // 3. User friendly device name
    let device_name = `${operating_system} (${browser})`;
    if (device_type === 'mobile') {
      device_name = `${operating_system} Mobile (${browser})`;
    } else if (device_type === 'tablet') {
      device_name = `${operating_system} Tablet (${browser})`;
    }

    return {
      browser,
      operating_system,
      device_type,
      device_name,
    };
  }

  /**
   * Mask an IP address for safe presentation in user security settings
   */
  maskIp(ipAddress = '') {
    const ip = String(ipAddress);
    if (!ip) return 'Hidden';

    // IPv4 masking
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.***.***`;
      }
    }

    // IPv6 masking
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length >= 2) {
        return `${parts[0]}:${parts[1]}:****:****`;
      }
    }

    return '***.***.***';
  }

  /**
   * Register or update a device session upon successful login
   */
  async registerDeviceSession({ userId, req }) {
    const ipAddress = this.getClientIp(req);
    const rawUserAgent = req.headers['user-agent'] || 'Unknown';
    const parsed = this.parseUserAgent(rawUserAgent);

    // Cryptographically random 32-byte session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    // 1. Check if an active/known device exists for this user and environment
    const [existing] = await pool.execute(
      `SELECT id FROM devices
       WHERE user_id = ? AND browser = ? AND operating_system = ? AND device_type = ?
       LIMIT 1`,
      [userId, parsed.browser, parsed.operating_system, parsed.device_type]
    );

    let deviceId;
    let isNewDevice = false;

    if (existing.length > 0) {
      deviceId = existing[0].id;
      // Update device record with current session ID and active timestamp
      await pool.execute(
        `UPDATE devices
         SET session_id = ?,
             ip_address = ?,
             user_agent = ?,
             last_active_at = CURRENT_TIMESTAMP,
             is_revoked = FALSE,
             revoked_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [sessionId, ipAddress, rawUserAgent.slice(0, 500), deviceId]
      );
    } else {
      isNewDevice = true;
      const [insertResult] = await pool.execute(
        `INSERT INTO devices (
          user_id, session_id, device_name, device_type, browser,
          operating_system, ip_address, user_agent, is_revoked, last_active_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE, CURRENT_TIMESTAMP)`,
        [
          userId,
          sessionId,
          parsed.device_name,
          parsed.device_type,
          parsed.browser,
          parsed.operating_system,
          ipAddress,
          rawUserAgent.slice(0, 500),
        ]
      );
      deviceId = insertResult.insertId;
    }

    return {
      deviceId,
      sessionId,
      isNewDevice,
      deviceInfo: parsed,
      ipAddress,
    };
  }

  /**
   * Evaluate if a login attempt is suspicious (e.g. unknown device or multiple recent failures)
   */
  async evaluateLoginRisk({ userId, req }) {
    const rawUserAgent = req.headers['user-agent'] || '';
    const parsed = this.parseUserAgent(rawUserAgent);

    // 1. Check if user has any verified sessions from this browser/OS
    const [knownDevices] = await pool.execute(
      `SELECT id FROM devices
       WHERE user_id = ? AND browser = ? AND operating_system = ?
       LIMIT 1`,
      [userId, parsed.browser, parsed.operating_system]
    );

    // 2. Check failed attempts in the last 30 minutes
    const [failures] = await pool.execute(
      `SELECT COUNT(*) AS count FROM login_attempts
       WHERE user_id = ? AND success = 0 AND attempted_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE)`,
      [userId]
    );

    const failureCount = failures[0]?.count || 0;

    // Condition A: Brand new device AND there were prior failed attempts
    if (knownDevices.length === 0 && failureCount >= 2) {
      return {
        isSuspicious: true,
        reason: 'New device detected following failed login attempts',
      };
    }

    return {
      isSuspicious: false,
    };
  }
}

module.exports = new DeviceService();
