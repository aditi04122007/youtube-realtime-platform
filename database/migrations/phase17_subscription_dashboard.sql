-- =====================================================================
-- Phase 17: Subscription Dashboard Migration
-- Database: video_platform
-- Engine: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =====================================================================

USE video_platform;

-- 1. Add billing_cycle to user_subscriptions if it doesn't already exist
SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'video_platform'
    AND TABLE_NAME = 'user_subscriptions'
    AND COLUMN_NAME = 'billing_cycle'
);

SET @sql = IF(
  @col_exists = 0,
  "ALTER TABLE user_subscriptions ADD COLUMN billing_cycle ENUM('MONTHLY', 'YEARLY') NOT NULL DEFAULT 'MONTHLY' AFTER auto_renew",
  "SELECT 'Column billing_cycle already exists on user_subscriptions' AS notice"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Add composite index for fast expiration queries: (user_id, status, end_date)
SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'video_platform'
    AND TABLE_NAME = 'user_subscriptions'
    AND INDEX_NAME = 'idx_user_sub_user_status_end'
);

SET @sql_idx = IF(
  @idx_exists = 0,
  "ALTER TABLE user_subscriptions ADD INDEX idx_user_sub_user_status_end (user_id, status, end_date)",
  "SELECT 'Index idx_user_sub_user_status_end already exists' AS notice"
);

PREPARE stmt_idx FROM @sql_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

-- 3. Expand action ENUM in subscription_history to include 'EXPIRED'
ALTER TABLE subscription_history 
  MODIFY COLUMN action ENUM('ASSIGNED', 'UPGRADED', 'DOWNGRADED', 'CANCELLED', 'RENEWED', 'EXPIRED') NOT NULL DEFAULT 'ASSIGNED';

