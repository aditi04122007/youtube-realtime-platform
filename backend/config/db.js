const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

// Build connection options supporting local MySQL and Cloud SSL (TiDB, Aiven, etc.)
const isCloudDb =
  process.env.DB_SSL === 'true' ||
  (process.env.DB_HOST && (process.env.DB_HOST.includes('tidbcloud.com') || process.env.DB_HOST.includes('aivencloud.com')));

const poolConfig = process.env.DATABASE_URL
  ? {
      uri: process.env.DATABASE_URL,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      ssl: isCloudDb ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'video_platform',
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      ssl: isCloudDb ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
    };

const pool = mysql.createPool(poolConfig);


/**
 * Startup database connection verification.
 * Clearly reports status to terminal without crashing process on unhandled connection errors.
 */
const testDbConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Database connected successfully');
    connection.release();
    return { success: true };
  } catch (error) {
    console.error(`Database connection failed: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Health check query utility for /api/health/db.
 * Safely executes test query without exposing passwords or credentials.
 */
const checkDbHealth = async () => {
  try {
    const [rows] = await pool.query('SELECT 1 AS alive');
    const isAlive = Array.isArray(rows) && rows.length > 0 && rows[0].alive === 1;
    return {
      connected: isAlive,
      message: isAlive ? 'Database connection is healthy' : 'Database query did not return expected result',
    };
  } catch (error) {
    return {
      connected: false,
      message: 'Database connection failed',
    };
  }
};

module.exports = {
  pool,
  testDbConnection,
  checkDbHealth,
};
