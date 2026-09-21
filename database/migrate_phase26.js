const { pool } = require('../backend/config/db');

async function runMigration() {
  const conn = await pool.getConnection();
  try {
    console.log('--- Applying Phase 26 In-Call Chat & File Sharing Migration ---');

    // 1. Create call_shared_files table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS call_shared_files (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        room_id BIGINT UNSIGNED NOT NULL,
        uploader_id BIGINT UNSIGNED NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        stored_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(150) NOT NULL,
        file_size BIGINT UNSIGNED NOT NULL,
        storage_path VARCHAR(1000) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        CONSTRAINT fk_call_files_room
          FOREIGN KEY (room_id)
          REFERENCES call_rooms(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_call_files_uploader
          FOREIGN KEY (uploader_id)
          REFERENCES users(id)
          ON DELETE CASCADE,
        INDEX idx_call_files_room (room_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ call_shared_files table created/verified successfully');

    // 2. Check and migrate call_messages table
    const [existingTables] = await conn.query(`SHOW TABLES LIKE 'call_messages'`);
    if (existingTables.length === 0) {
      await conn.query(`
        CREATE TABLE call_messages (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          room_id BIGINT UNSIGNED NOT NULL,
          sender_id BIGINT UNSIGNED NOT NULL,
          message_type ENUM('TEXT', 'FILE') NOT NULL DEFAULT 'TEXT',
          message_text TEXT NULL,
          file_id BIGINT UNSIGNED NULL,
          reply_to_message_id BIGINT UNSIGNED NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NULL,
          deleted_at DATETIME NULL,
          CONSTRAINT fk_call_messages_room
            FOREIGN KEY (room_id)
            REFERENCES call_rooms(id)
            ON DELETE CASCADE,
          CONSTRAINT fk_call_messages_sender
            FOREIGN KEY (sender_id)
            REFERENCES users(id)
            ON DELETE CASCADE,
          CONSTRAINT fk_call_messages_file
            FOREIGN KEY (file_id)
            REFERENCES call_shared_files(id)
            ON DELETE SET NULL,
          CONSTRAINT fk_call_messages_reply
            FOREIGN KEY (reply_to_message_id)
            REFERENCES call_messages(id)
            ON DELETE SET NULL,
          INDEX idx_call_messages_room (room_id, created_at),
          INDEX idx_call_messages_sender (sender_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('✓ call_messages table created successfully');
    } else {
      // Alter existing call_messages table to align with Phase 26 requirements
      const [cols] = await conn.query(`DESCRIBE call_messages`);
      const colNames = cols.map((c) => c.Field);

      if (colNames.includes('user_id') && !colNames.includes('sender_id')) {
        await conn.query(`ALTER TABLE call_messages CHANGE user_id sender_id BIGINT UNSIGNED NOT NULL`);
        console.log('✓ Changed user_id to sender_id in call_messages');
      }
      if (colNames.includes('message') && !colNames.includes('message_text')) {
        await conn.query(`ALTER TABLE call_messages CHANGE message message_text TEXT NULL`);
        console.log('✓ Changed message to message_text in call_messages');
      }
      if (!colNames.includes('message_type')) {
        await conn.query(`ALTER TABLE call_messages ADD COLUMN message_type ENUM('TEXT', 'FILE') NOT NULL DEFAULT 'TEXT' AFTER sender_id`);
        console.log('✓ Added message_type column to call_messages');
      }
      if (!colNames.includes('file_id')) {
        await conn.query(`ALTER TABLE call_messages ADD COLUMN file_id BIGINT UNSIGNED NULL AFTER message_text`);
        await conn.query(`ALTER TABLE call_messages ADD CONSTRAINT fk_call_messages_file FOREIGN KEY (file_id) REFERENCES call_shared_files(id) ON DELETE SET NULL`);
        console.log('✓ Added file_id column and foreign key to call_messages');
      }
      if (!colNames.includes('reply_to_message_id')) {
        await conn.query(`ALTER TABLE call_messages ADD COLUMN reply_to_message_id BIGINT UNSIGNED NULL AFTER file_id`);
        await conn.query(`ALTER TABLE call_messages ADD CONSTRAINT fk_call_messages_reply FOREIGN KEY (reply_to_message_id) REFERENCES call_messages(id) ON DELETE SET NULL`);
        console.log('✓ Added reply_to_message_id column and foreign key to call_messages');
      }
      if (!colNames.includes('updated_at')) {
        await conn.query(`ALTER TABLE call_messages ADD COLUMN updated_at DATETIME NULL AFTER created_at`);
        console.log('✓ Added updated_at column to call_messages');
      }
      if (!colNames.includes('deleted_at')) {
        await conn.query(`ALTER TABLE call_messages ADD COLUMN deleted_at DATETIME NULL AFTER updated_at`);
        console.log('✓ Added deleted_at column to call_messages');
      }
      console.log('✓ call_messages table successfully verified & updated');
    }

    // 3. Create call_message_reads table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS call_message_reads (
        message_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (message_id, user_id),
        CONSTRAINT fk_call_reads_message
          FOREIGN KEY (message_id)
          REFERENCES call_messages(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_call_reads_user
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ call_message_reads table created/verified successfully');

    console.log('--- Phase 26 In-Call Chat Migration Completed Successfully ---');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    conn.release();
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
