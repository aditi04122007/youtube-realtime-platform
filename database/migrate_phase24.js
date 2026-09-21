const { pool } = require('../backend/config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const conn = await pool.getConnection();
  try {
    console.log('--- Applying Phase 24 Call Rooms Migration ---');

    // 1. Create call_rooms table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS call_rooms (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        room_code VARCHAR(64) NOT NULL UNIQUE,
        created_by BIGINT UNSIGNED NOT NULL,
        room_type ENUM('ONE_TO_ONE', 'GROUP') NOT NULL DEFAULT 'ONE_TO_ONE',
        status ENUM('WAITING', 'ACTIVE', 'ENDED') NOT NULL DEFAULT 'WAITING',
        max_participants INT NOT NULL DEFAULT 6,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME NULL,
        ended_at DATETIME NULL,
        CONSTRAINT fk_call_rooms_creator
          FOREIGN KEY (created_by)
          REFERENCES users(id)
          ON DELETE CASCADE,
        INDEX idx_call_rooms_creator (created_by, created_at),
        INDEX idx_call_rooms_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ call_rooms table created/verified successfully');

    // 2. Create call_room_participants table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS call_room_participants (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        room_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        role ENUM('HOST', 'PARTICIPANT') NOT NULL DEFAULT 'PARTICIPANT',
        status ENUM('INVITED', 'JOINED', 'LEFT', 'REMOVED') NOT NULL DEFAULT 'INVITED',
        joined_at DATETIME NULL,
        left_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_room_participants_room
          FOREIGN KEY (room_id)
          REFERENCES call_rooms(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_room_participants_user
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE,
        UNIQUE KEY unique_room_user (room_id, user_id),
        INDEX idx_room_participants_room (room_id),
        INDEX idx_room_participants_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ call_room_participants table created/verified successfully');

    // 3. Update notifications type ENUM to include CALL_ROOM_INVITATION if notifications exists
    try {
      await conn.query(`
        ALTER TABLE notifications MODIFY COLUMN type ENUM(
          'VIDEO_PUBLISHED',
          'NEW_SUBSCRIBER',
          'COMMENT_ON_VIDEO',
          'REPLY_TO_COMMENT',
          'COMMENT_LIKED',
          'VIDEO_LIKED',
          'SUBSCRIPTION_STARTED',
          'SUBSCRIPTION_CHANGED',
          'CALL_ROOM_INVITATION'
        ) NOT NULL;
      `);
      console.log('✓ notifications table type ENUM updated to include CALL_ROOM_INVITATION');
    } catch (notifErr) {
      console.warn('Note on notifications ENUM update:', notifErr.message);
    }

    const [roomCols] = await conn.query('DESCRIBE call_rooms');
    console.log('call_rooms columns:', roomCols.map((c) => `${c.Field} (${c.Type})`).join(', '));

    const [partCols] = await conn.query('DESCRIBE call_room_participants');
    console.log('call_room_participants columns:', partCols.map((c) => `${c.Field} (${c.Type})`).join(', '));
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
