-- Phase 21: Playlists and Watch Later Migration
-- Safe idempotent migration extending playlists, playlist_videos, and watch_later tables

-- 1. Ensure playlists table has all required columns and indexes
CREATE TABLE IF NOT EXISTS playlists (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  name VARCHAR(255) NULL,
  description TEXT NULL,
  visibility ENUM('PRIVATE', 'UNLISTED', 'PUBLIC') NOT NULL DEFAULT 'PRIVATE',
  thumbnail_url VARCHAR(500) NULL,
  video_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_playlists_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_playlists_user (user_id),
  INDEX idx_playlists_visibility (visibility),
  INDEX idx_playlists_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Safely add missing columns to playlists if table already existed
SET @exist_name := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'playlists' AND COLUMN_NAME = 'name');
SET @query_name := IF(@exist_name = 0, 'ALTER TABLE playlists ADD COLUMN name VARCHAR(255) NULL AFTER user_id', 'SELECT 1');
PREPARE stmt_name FROM @query_name;
EXECUTE stmt_name;
DEALLOCATE PREPARE stmt_name;

SET @exist_vc := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'playlists' AND COLUMN_NAME = 'video_count');
SET @query_vc := IF(@exist_vc = 0, 'ALTER TABLE playlists ADD COLUMN video_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER thumbnail_url', 'SELECT 1');
PREPARE stmt_vc FROM @query_vc;
EXECUTE stmt_vc;
DEALLOCATE PREPARE stmt_vc;

-- Synchronize name and title
UPDATE playlists SET name = title WHERE name IS NULL AND title IS NOT NULL;
UPDATE playlists SET title = name WHERE title IS NULL AND name IS NOT NULL;

-- Ensure indexes on playlists
SET @exist_idx_vis := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'playlists' AND INDEX_NAME = 'idx_playlists_visibility');
SET @query_idx_vis := IF(@exist_idx_vis = 0, 'ALTER TABLE playlists ADD INDEX idx_playlists_visibility (visibility)', 'SELECT 1');
PREPARE stmt_idx_vis FROM @query_idx_vis;
EXECUTE stmt_idx_vis;
DEALLOCATE PREPARE stmt_idx_vis;

SET @exist_idx_upd := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'playlists' AND INDEX_NAME = 'idx_playlists_updated');
SET @query_idx_upd := IF(@exist_idx_upd = 0, 'ALTER TABLE playlists ADD INDEX idx_playlists_updated (updated_at)', 'SELECT 1');
PREPARE stmt_idx_upd FROM @query_idx_upd;
EXECUTE stmt_idx_upd;
DEALLOCATE PREPARE stmt_idx_upd;


-- 2. Ensure playlist_videos table has proper structure, keys, and indexes
CREATE TABLE IF NOT EXISTS playlist_videos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  playlist_id BIGINT UNSIGNED NOT NULL,
  video_id BIGINT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_playlist_videos_playlist FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  CONSTRAINT fk_playlist_videos_video FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  UNIQUE KEY uq_playlist_video (playlist_id, video_id),
  INDEX idx_playlist_videos_playlist_position (playlist_id, position),
  INDEX idx_playlist_videos_video (video_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Check if playlist_videos has id column
SET @exist_pv_id := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'playlist_videos' AND COLUMN_NAME = 'id');
-- If playlist_videos was created with composite PRIMARY KEY (playlist_id, video_id), add id if needed or maintain unique key
SET @exist_pv_uq := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'playlist_videos' AND INDEX_NAME = 'uq_playlist_video');
SET @query_pv_uq := IF(@exist_pv_uq = 0 AND @exist_pv_id > 0, 'ALTER TABLE playlist_videos ADD UNIQUE KEY uq_playlist_video (playlist_id, video_id)', 'SELECT 1');
PREPARE stmt_pv_uq FROM @query_pv_uq;
EXECUTE stmt_pv_uq;
DEALLOCATE PREPARE stmt_pv_uq;

SET @exist_pv_pos := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'playlist_videos' AND INDEX_NAME = 'idx_playlist_videos_playlist_position');
SET @query_pv_pos := IF(@exist_pv_pos = 0, 'ALTER TABLE playlist_videos ADD INDEX idx_playlist_videos_playlist_position (playlist_id, position)', 'SELECT 1');
PREPARE stmt_pv_pos FROM @query_pv_pos;
EXECUTE stmt_pv_pos;
DEALLOCATE PREPARE stmt_pv_pos;


-- 3. Ensure watch_later table has added_at, foreign keys, and indexes
CREATE TABLE IF NOT EXISTS watch_later (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  video_id BIGINT UNSIGNED NOT NULL,
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_watch_later_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_watch_later_video FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  UNIQUE KEY uq_watch_later_user_video (user_id, video_id),
  INDEX idx_watch_later_user_date (user_id, added_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @exist_wl_added := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'watch_later' AND COLUMN_NAME = 'added_at');
SET @query_wl_added := IF(@exist_wl_added = 0, 'ALTER TABLE watch_later ADD COLUMN added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER video_id', 'SELECT 1');
PREPARE stmt_wl_added FROM @query_wl_added;
EXECUTE stmt_wl_added;
DEALLOCATE PREPARE stmt_wl_added;

-- If created_at exists in watch_later, backfill added_at
SET @exist_wl_created := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'watch_later' AND COLUMN_NAME = 'created_at');
SET @query_wl_bf := IF(@exist_wl_created > 0, 'UPDATE watch_later SET added_at = created_at WHERE added_at IS NULL OR added_at = CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt_wl_bf FROM @query_wl_bf;
EXECUTE stmt_wl_bf;
DEALLOCATE PREPARE stmt_wl_bf;

SET @exist_wl_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'watch_later' AND INDEX_NAME = 'idx_watch_later_user_date');
SET @query_wl_idx := IF(@exist_wl_idx = 0, 'ALTER TABLE watch_later ADD INDEX idx_watch_later_user_date (user_id, added_at)', 'SELECT 1');
PREPARE stmt_wl_idx FROM @query_wl_idx;
EXECUTE stmt_wl_idx;
DEALLOCATE PREPARE stmt_wl_idx;

-- Recalculate video_count on playlists
UPDATE playlists p 
SET video_count = (SELECT COUNT(*) FROM playlist_videos pv JOIN videos v ON pv.video_id = v.id WHERE pv.playlist_id = p.id AND v.status != 'DELETED');
