const crypto = require('crypto');

// Clear alphanumeric characters without ambiguous chars (e.g. 0, O, 1, I)
const CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generate a random room code string in format ROOM-XXXXXX
 * @param {number} length
 * @returns {string}
 */
const generateRawCode = (length = 6) => {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return `ROOM-${code}`;
};

/**
 * Generate a unique room code verified against MySQL call_rooms table
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} db
 * @param {number} [maxAttempts=5]
 * @returns {Promise<string>}
 */
const generateUniqueRoomCode = async (db, maxAttempts = 5) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateRawCode(6);
    const [existing] = await db.query(
      'SELECT id FROM call_rooms WHERE room_code = ? LIMIT 1',
      [code]
    );
    if (existing.length === 0) {
      return code;
    }
  }
  // Fallback to longer code if collision limit reached
  return `ROOM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

module.exports = {
  generateRawCode,
  generateUniqueRoomCode,
};
