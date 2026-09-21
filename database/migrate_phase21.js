const { pool } = require('../backend/config/db');

async function runMigration() {
  const conn = await pool.getConnection();
  try {
    console.log('--- Checking and Migrating Phase 21 Tables ---');

    // 1. Playlists columns
    const [pCols] = await conn.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'playlists'"
    );
    const pColNames = pCols.map((c) => c.COLUMN_NAME.toLowerCase());

    if (!pColNames.includes('name')) {
      console.log('Adding column name to playlists...');
      await conn.query('ALTER TABLE playlists ADD COLUMN name VARCHAR(255) NULL AFTER user_id');
    }
    if (!pColNames.includes('video_count')) {
      console.log('Adding column video_count to playlists...');
      await conn.query(
        'ALTER TABLE playlists ADD COLUMN video_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER thumbnail_url'
      );
    }

    await conn.query(
      "UPDATE playlists SET name = title WHERE (name IS NULL OR name = '') AND title IS NOT NULL"
    );
    await conn.query(
      "UPDATE playlists SET title = name WHERE (title IS NULL OR title = '') AND name IS NOT NULL"
    );

    // Indexes on playlists
    const [pIdxs] = await conn.query(
      "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'playlists'"
    );
    const pIdxNames = pIdxs.map((i) => i.INDEX_NAME.toLowerCase());

    if (!pIdxNames.includes('idx_playlists_visibility')) {
      console.log('Adding index idx_playlists_visibility...');
      await conn.query('ALTER TABLE playlists ADD INDEX idx_playlists_visibility (visibility)');
    }
    if (!pIdxNames.includes('idx_playlists_updated')) {
      console.log('Adding index idx_playlists_updated...');
      await conn.query('ALTER TABLE playlists ADD INDEX idx_playlists_updated (updated_at)');
    }

    // 2. Playlist_videos
    const [pvCols] = await conn.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'playlist_videos'"
    );
    const pvColNames = pvCols.map((c) => c.COLUMN_NAME.toLowerCase());

    const [pvIdxs] = await conn.query(
      "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'playlist_videos'"
    );
    const pvIdxNames = pvIdxs.map((i) => i.INDEX_NAME.toLowerCase());

    if (!pvIdxNames.includes('idx_playlist_videos_playlist_position')) {
      console.log('Adding index idx_playlist_videos_playlist_position...');
      await conn.query(
        'ALTER TABLE playlist_videos ADD INDEX idx_playlist_videos_playlist_position (playlist_id, position)'
      );
    }
    if (!pvIdxNames.includes('idx_playlist_videos_video')) {
      console.log('Adding index idx_playlist_videos_video...');
      await conn.query('ALTER TABLE playlist_videos ADD INDEX idx_playlist_videos_video (video_id)');
    }

    // 3. Watch_later
    const [wlCols] = await conn.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'watch_later'"
    );
    const wlColNames = wlCols.map((c) => c.COLUMN_NAME.toLowerCase());

    if (!wlColNames.includes('added_at')) {
      console.log('Adding column added_at to watch_later...');
      await conn.query(
        'ALTER TABLE watch_later ADD COLUMN added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER video_id'
      );
      if (wlColNames.includes('created_at')) {
        await conn.query('UPDATE watch_later SET added_at = created_at WHERE created_at IS NOT NULL');
      }
    }

    const [wlIdxs] = await conn.query(
      "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'watch_later'"
    );
    const wlIdxNames = wlIdxs.map((i) => i.INDEX_NAME.toLowerCase());

    if (!wlIdxNames.includes('idx_watch_later_user_date')) {
      console.log('Adding index idx_watch_later_user_date...');
      await conn.query('ALTER TABLE watch_later ADD INDEX idx_watch_later_user_date (user_id, added_at)');
    }

    // Recalculate video_count on playlists
    await conn.query(
      "UPDATE playlists p SET video_count = (SELECT COUNT(*) FROM playlist_videos pv JOIN videos v ON pv.video_id = v.id WHERE pv.playlist_id = p.id AND v.status != 'DELETED')"
    );

    console.log('Phase 21 Database Migration Completed Successfully!');

    const [finalPCols] = await conn.query('DESCRIBE playlists');
    console.log('Playlists fields:', finalPCols.map((c) => c.Field).join(', '));

    const [finalPVCols] = await conn.query('DESCRIBE playlist_videos');
    console.log('Playlist_videos fields:', finalPVCols.map((c) => c.Field).join(', '));

    const [finalWLCols] = await conn.query('DESCRIBE watch_later');
    console.log('Watch_later fields:', finalWLCols.map((c) => c.Field).join(', '));
  } catch (err) {
    console.error('Migration error:', err);
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
