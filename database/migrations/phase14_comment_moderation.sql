-- =====================================================================
-- Phase 14: Comment Moderation + Reporting Migration
-- Database: video_platform
-- =====================================================================

USE video_platform;

-- 1. Extend comments.status with 'REMOVED'
ALTER TABLE comments 
  MODIFY COLUMN status ENUM('VISIBLE', 'HIDDEN', 'DELETED', 'REPORTED', 'REMOVED') NOT NULL DEFAULT 'VISIBLE';

-- 2. Extend reports table:
-- Expand status ENUM to include REVIEWED, DISMISSED, ACTION_TAKEN
ALTER TABLE reports
  MODIFY COLUMN status ENUM('PENDING', 'REVIEWING', 'REVIEWED', 'DISMISSED', 'ACTION_TAKEN', 'RESOLVED', 'REJECTED') NOT NULL DEFAULT 'PENDING';

-- Conditionally add resolution_note to reports
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'video_platform' AND table_name = 'reports' AND column_name = 'resolution_note');
SET @query = IF(@col_exists = 0, 'ALTER TABLE reports ADD COLUMN resolution_note TEXT DEFAULT NULL AFTER reviewed_at', 'SELECT 1');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Conditionally add updated_at to reports
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'video_platform' AND table_name = 'reports' AND column_name = 'updated_at');
SET @query = IF(@col_exists = 0, 'ALTER TABLE reports ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at', 'SELECT 1');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Indexes for reports table
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = 'video_platform' AND table_name = 'reports' AND index_name = 'idx_reports_reporter_comment');
SET @query = IF(@idx_exists = 0, 'ALTER TABLE reports ADD INDEX idx_reports_reporter_comment (reporter_id, comment_id)', 'SELECT 1');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = 'video_platform' AND table_name = 'reports' AND index_name = 'idx_reports_comment_id');
SET @query = IF(@idx_exists = 0, 'ALTER TABLE reports ADD INDEX idx_reports_comment_id (comment_id)', 'SELECT 1');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Extend admin_actions table with reason and metadata
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'video_platform' AND table_name = 'admin_actions' AND column_name = 'reason');
SET @query = IF(@col_exists = 0, 'ALTER TABLE admin_actions ADD COLUMN reason VARCHAR(255) DEFAULT NULL AFTER target_id', 'SELECT 1');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'video_platform' AND table_name = 'admin_actions' AND column_name = 'metadata');
SET @query = IF(@col_exists = 0, 'ALTER TABLE admin_actions ADD COLUMN metadata JSON DEFAULT NULL AFTER description', 'SELECT 1');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
