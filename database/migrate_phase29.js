const { pool } = require('../backend/config/db');

async function runMigration() {
  const conn = await pool.getConnection();
  try {
    console.log('--- Applying Phase 29 Admin Dashboard Migration ---');

    // 1. Expand users.status to include 'BANNED'
    console.log('1. Updating users.status enum to include BANNED...');
    await conn.query(`
      ALTER TABLE users 
      MODIFY COLUMN status ENUM('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED') NOT NULL DEFAULT 'ACTIVE'
    `);
    console.log('✓ users.status enum successfully updated');

    // 1.1 Expand users.role to include 'CREATOR'
    console.log('1.1 Updating users.role enum to include CREATOR...');
    await conn.query(`
      ALTER TABLE users 
      MODIFY COLUMN role ENUM('USER', 'CREATOR', 'ADMIN') NOT NULL DEFAULT 'USER'
    `);
    console.log('✓ users.role enum successfully updated');

    // 2. Add status column to channels if not present
    console.log('2. Checking channels.status column...');
    const [channelCols] = await conn.query(`SHOW COLUMNS FROM channels LIKE 'status'`);
    if (channelCols.length === 0) {
      await conn.query(`
        ALTER TABLE channels 
        ADD COLUMN status ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE'
      `);
      console.log('✓ Added status column to channels table');
    } else {
      console.log('✓ channels.status already exists');
    }

    // Check index on channels.status
    const [channelIndexes] = await conn.query(`SHOW INDEX FROM channels WHERE Key_name = 'idx_channels_status'`);
    if (channelIndexes.length === 0) {
      await conn.query(`CREATE INDEX idx_channels_status ON channels (status)`);
      console.log('✓ Created idx_channels_status on channels(status)');
    }

    // 3. Expand videos.status to include 'REMOVED' and 'HIDDEN'
    console.log('3. Updating videos.status enum to include REMOVED and HIDDEN...');
    await conn.query(`
      ALTER TABLE videos 
      MODIFY COLUMN status ENUM('PROCESSING', 'READY', 'PUBLISHED', 'FAILED', 'DELETED', 'REMOVED', 'HIDDEN') NOT NULL DEFAULT 'PROCESSING'
    `);
    console.log('✓ videos.status enum successfully updated');

    // 4. Index on admin_actions (target_type, target_id)
    const [actionIndexes] = await conn.query(`SHOW INDEX FROM admin_actions WHERE Key_name = 'idx_aa_target'`);
    if (actionIndexes.length === 0) {
      await conn.query(`CREATE INDEX idx_aa_target ON admin_actions (target_type, target_id)`);
      console.log('✓ Created idx_aa_target on admin_actions(target_type, target_id)');
    }

    console.log('--- Phase 29 Admin Dashboard Migration Completed Successfully ---');
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
