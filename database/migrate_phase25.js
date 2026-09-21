const { pool } = require('../backend/config/db');

async function runMigration() {
  const conn = await pool.getConnection();
  try {
    console.log('--- Applying Phase 25 Call Moderation Migration ---');

    // 1. Create call_moderation_actions table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS call_moderation_actions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        room_id BIGINT UNSIGNED NOT NULL,
        moderator_id BIGINT UNSIGNED NOT NULL,
        target_user_id BIGINT UNSIGNED NULL,
        action_type ENUM(
          'MUTE',
          'UNMUTE',
          'CAMERA_DISABLE',
          'CAMERA_ENABLE',
          'REMOVE',
          'BLOCK_REJOIN',
          'UNBLOCK_REJOIN',
          'REPORT',
          'END_ROOM'
        ) NOT NULL,
        reason VARCHAR(500) NULL,
        metadata JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_moderation_room
          FOREIGN KEY (room_id)
          REFERENCES call_rooms(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_moderation_moderator
          FOREIGN KEY (moderator_id)
          REFERENCES users(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_moderation_target
          FOREIGN KEY (target_user_id)
          REFERENCES users(id)
          ON DELETE SET NULL,
        INDEX idx_moderation_room (room_id, created_at),
        INDEX idx_moderation_target (target_user_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ call_moderation_actions table created/verified successfully');

    // 2. Create call_room_blocks table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS call_room_blocks (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        room_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        blocked_by BIGINT UNSIGNED NOT NULL,
        reason VARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_room_blocks_room
          FOREIGN KEY (room_id)
          REFERENCES call_rooms(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_room_blocks_user
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_room_blocks_admin
          FOREIGN KEY (blocked_by)
          REFERENCES users(id)
          ON DELETE CASCADE,
        UNIQUE KEY unique_room_block (room_id, user_id),
        INDEX idx_room_blocks_room (room_id),
        INDEX idx_room_blocks_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ call_room_blocks table created/verified successfully');

    // 3. Check and add server_muted and server_camera_disabled columns in call_room_participants
    const [cols] = await conn.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'call_room_participants' 
        AND COLUMN_NAME IN ('server_muted', 'server_camera_disabled')
    `);
    const existingCols = cols.map(c => c.COLUMN_NAME);

    if (!existingCols.includes('server_muted')) {
      await conn.query(`
        ALTER TABLE call_room_participants
        ADD COLUMN server_muted BOOLEAN NOT NULL DEFAULT FALSE
      `);
      console.log('✓ Added server_muted column to call_room_participants');
    } else {
      console.log('✓ server_muted column already exists');
    }

    if (!existingCols.includes('server_camera_disabled')) {
      await conn.query(`
        ALTER TABLE call_room_participants
        ADD COLUMN server_camera_disabled BOOLEAN NOT NULL DEFAULT FALSE
      `);
      console.log('✓ Added server_camera_disabled column to call_room_participants');
    } else {
      console.log('✓ server_camera_disabled column already exists');
    }

    console.log('\n--- Phase 25 Database Migration Completed Successfully ---');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

runMigration();
