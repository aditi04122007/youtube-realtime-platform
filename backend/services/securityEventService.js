const { pool } = require('../config/db');
const deviceService = require('./deviceService');

/**
 * Service to record security audit trail events
 */
class SecurityEventService {
  /**
   * Log a security event
   * @param {Object} params
   * @param {number|null} params.userId
   * @param {string} params.eventType
   * @param {Object} [params.req] - Express request object for IP and User Agent extraction
   * @param {string} [params.ipAddress]
   * @param {string} [params.userAgent]
   * @param {number|null} [params.deviceId]
   * @param {Object} [params.metadata]
   */
  async logEvent({
    userId = null,
    eventType,
    req = null,
    ipAddress = null,
    userAgent = null,
    deviceId = null,
    metadata = null,
  }) {
    try {
      const resolvedIp = ipAddress || (req ? deviceService.getClientIp(req) : '127.0.0.1');
      const resolvedUa = userAgent || (req ? req.headers['user-agent'] : null);
      const safeUa = resolvedUa ? String(resolvedUa).slice(0, 500) : null;
      const metadataJson = metadata ? JSON.stringify(metadata) : null;

      await pool.execute(
        `INSERT INTO security_events (
          user_id, event_type, ip_address, user_agent, device_id, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId || null,
          eventType,
          resolvedIp.slice(0, 45),
          safeUa,
          deviceId || null,
          metadataJson,
        ]
      );
    } catch (err) {
      console.error('[SecurityEventService] Failed to record event:', err.message);
    }
  }
}

module.exports = new SecurityEventService();
