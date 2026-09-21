const { pool } = require('../backend/config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const conn = await pool.getConnection();
  try {
    console.log('--- Applying Phase 23 Video Calls Migration ---');
    const sqlPath = path.join(__dirname, 'migrations', 'phase23_video_calls.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await conn.query(sql);
    console.log('✓ video_calls table created successfully');

    const [cols] = await conn.query('DESCRIBE video_calls');
    console.log('video_calls columns:', cols.map((c) => `${c.Field} (${c.Type})`).join(', '));
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    conn.release();
    process.exit(0);
  }
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
