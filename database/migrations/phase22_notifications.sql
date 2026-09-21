-- Phase 22: Real-Time Notifications Migration
-- Safe idempotent migration extending the notifications table with actor, entity, targets, read timestamp, and indexes

-- 1. Ensure notifications table exists
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  entity_type VARCHAR(50) NULL,
  entity_id BIGINT UNSIGNED NULL,
  video_id BIGINT UNSIGNED NULL,
  comment_id BIGINT UNSIGNED NULL,
  channel_id BIGINT UNSIGNED NULL,
  data_json JSON DEFAULT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Safely add missing columns to existing notifications table
SET @exist_actor := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'actor_user_id');
SET @query_actor := IF(@exist_actor = 0, 'ALTER TABLE notifications ADD COLUMN actor_user_id BIGINT UNSIGNED NULL AFTER user_id', 'SELECT 1');
PREPARE stmt_actor FROM @query_actor;
EXECUTE stmt_actor;
DEALLOCATE PREPARE stmt_actor;

SET @exist_ent_type := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'entity_type');
SET @query_ent_type := IF(@exist_ent_type = 0, 'ALTER TABLE notifications ADD COLUMN entity_type VARCHAR(50) NULL AFTER message', 'SELECT 1');
PREPARE stmt_ent_type FROM @query_ent_type;
EXECUTE stmt_ent_type;
DEALLOCATE PREPARE stmt_ent_type;

SET @exist_ent_id := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'entity_id');
SET @query_ent_id := IF(@exist_ent_id = 0, 'ALTER TABLE notifications ADD COLUMN entity_id BIGINT UNSIGNED NULL AFTER entity_type', 'SELECT 1');
PREPARE stmt_ent_id FROM @query_ent_id;
EXECUTE stmt_ent_id;
DEALLOCATE PREPARE stmt_ent_id;

SET @exist_vid := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'video_id');
SET @query_vid := IF(@exist_vid = 0, 'ALTER TABLE notifications ADD COLUMN video_id BIGINT UNSIGNED NULL AFTER entity_id', 'SELECT 1');
PREPARE stmt_vid FROM @query_vid;
EXECUTE stmt_vid;
DEALLOCATE PREPARE stmt_vid;

SET @exist_cid := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'comment_id');
SET @query_cid := IF(@exist_cid = 0, 'ALTER TABLE notifications ADD COLUMN comment_id BIGINT UNSIGNED NULL AFTER video_id', 'SELECT 1');
PREPARE stmt_cid FROM @query_cid;
EXECUTE stmt_cid;
DEALLOCATE PREPARE stmt_cid;

SET @exist_chid := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'channel_id');
SET @query_chid := IF(@exist_chid = 0, 'ALTER TABLE notifications ADD COLUMN channel_id BIGINT UNSIGNED NULL AFTER comment_id', 'SELECT 1');
PREPARE stmt_chid FROM @query_chid;
EXECUTE stmt_chid;
DEALLOCATE PREPARE stmt_chid;

SET @exist_read_at := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'read_at');
SET @query_read_at := IF(@exist_read_at = 0, 'ALTER TABLE notifications ADD COLUMN read_at TIMESTAMP NULL DEFAULT NULL AFTER is_read', 'SELECT 1');
PREPARE stmt_read_at FROM @query_read_at;
EXECUTE stmt_read_at;
DEALLOCATE PREPARE stmt_read_at;

-- 3. Safely add foreign keys if not already present
SET @exist_fk_actor := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND CONSTRAINT_NAME = 'fk_notifications_actor');
SET @query_fk_actor := IF(@exist_fk_actor = 0, 'ALTER TABLE notifications ADD CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE CASCADE', 'SELECT 1');
PREPARE stmt_fk_actor FROM @query_fk_actor;
EXECUTE stmt_fk_actor;
DEALLOCATE PREPARE stmt_fk_actor;

SET @exist_fk_vid := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND CONSTRAINT_NAME = 'fk_notifications_video');
SET @query_fk_vid := IF(@exist_fk_vid = 0, 'ALTER TABLE notifications ADD CONSTRAINT fk_notifications_video FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE', 'SELECT 1');
PREPARE stmt_fk_vid FROM @query_fk_vid;
EXECUTE stmt_fk_vid;
DEALLOCATE PREPARE stmt_fk_vid;

SET @exist_fk_com := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND CONSTRAINT_NAME = 'fk_notifications_comment');
SET @query_fk_com := IF(@exist_fk_com = 0, 'ALTER TABLE notifications ADD CONSTRAINT fk_notifications_comment FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE', 'SELECT 1');
PREPARE stmt_fk_com FROM @query_fk_com;
EXECUTE stmt_fk_com;
DEALLOCATE PREPARE stmt_fk_com;

SET @exist_fk_ch := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND CONSTRAINT_NAME = 'fk_notifications_channel');
SET @query_fk_ch := IF(@exist_fk_ch = 0, 'ALTER TABLE notifications ADD CONSTRAINT fk_notifications_channel FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE', 'SELECT 1');
PREPARE stmt_fk_ch FROM @query_fk_ch;
EXECUTE stmt_fk_ch;
DEALLOCATE PREPARE stmt_fk_ch;

-- 4. Safely add performance composite indexes
SET @exist_idx_uc := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'idx_notifications_user_created');
SET @query_idx_uc := IF(@exist_idx_uc = 0, 'ALTER TABLE notifications ADD INDEX idx_notifications_user_created (user_id, created_at DESC)', 'SELECT 1');
PREPARE stmt_idx_uc FROM @query_idx_uc;
EXECUTE stmt_idx_uc;
DEALLOCATE PREPARE stmt_idx_uc;

SET @exist_idx_ur := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'idx_notifications_user_read');
SET @query_idx_ur := IF(@exist_idx_ur = 0, 'ALTER TABLE notifications ADD INDEX idx_notifications_user_read (user_id, is_read, created_at DESC)', 'SELECT 1');
PREPARE stmt_idx_ur FROM @query_idx_ur;
EXECUTE stmt_idx_ur;
DEALLOCATE PREPARE stmt_idx_ur;

SET @exist_idx_act := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'idx_notifications_actor');
SET @query_idx_act := IF(@exist_idx_act = 0, 'ALTER TABLE notifications ADD INDEX idx_notifications_actor (actor_user_id)', 'SELECT 1');
PREPARE stmt_idx_act FROM @query_idx_act;
EXECUTE stmt_idx_act;
DEALLOCATE PREPARE stmt_idx_act;

SET @exist_idx_ent := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'idx_notifications_entity');
SET @query_idx_ent := IF(@exist_idx_ent = 0, 'ALTER TABLE notifications ADD INDEX idx_notifications_entity (entity_type, entity_id)', 'SELECT 1');
PREPARE stmt_idx_ent FROM @query_idx_ent;
EXECUTE stmt_idx_ent;
DEALLOCATE PREPARE stmt_idx_ent;
