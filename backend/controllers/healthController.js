const { checkDbHealth } = require('../config/db');

/**
 * Health Controller
 * Responds to GET /api/health
 */
const getHealthStatus = (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Backend is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
};

/**
 * Database Health Controller
 * Responds to GET /api/health/db
 */
const getDbHealthStatus = async (req, res) => {
  try {
    const health = await checkDbHealth();
    if (health.connected) {
      return res.status(200).json({
        success: true,
        message: 'Database connection is healthy',
      });
    }
    return res.status(503).json({
      success: false,
      message: 'Database connection failed',
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: 'Database connection failed',
    });
  }
};

module.exports = {
  getHealthStatus,
  getDbHealthStatus,
};
