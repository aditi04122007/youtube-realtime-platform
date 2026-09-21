-- =====================================================================
-- PHASE 10 DATABASE MIGRATION
-- Watch History & Resume Playback
-- =====================================================================

-- 1. Add duration_seconds column if not exists
SET @exist := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'watch_history'
    AND column_name = 'duration_seconds'
);

SET @sqlstmt := IF(
  @exist > 0,
  'SELECT "Column duration_seconds already exists" AS message',
  'ALTER TABLE watch_history ADD COLUMN duration_seconds INT UNSIGNED NOT NULL DEFAULT 0 AFTER progress_seconds'
);

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Add created_at column if not exists
SET @exist := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'watch_history'
    AND column_name = 'created_at'
);

SET @sqlstmt := IF(
  @exist > 0,
  'SELECT "Column created_at already exists" AS message',
  'ALTER TABLE watch_history ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'
);

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Add updated_at column if not exists
SET @exist := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'watch_history'
    AND column_name = 'updated_at'
);

SET @sqlstmt := IF(
  @exist > 0,
  'SELECT "Column updated_at already exists" AS message',
  'ALTER TABLE watch_history ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
);

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Add composite index idx_wh_user_last_watched for fast newest-first watch history sorting
SET @exist := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'watch_history'
    AND index_name = 'idx_wh_user_last_watched'
);

SET @sqlstmt := IF(
  @exist > 0,
  'SELECT "Index idx_wh_user_last_watched already exists" AS message',
  'ALTER TABLE watch_history ADD INDEX idx_wh_user_last_watched (user_id, last_watched_at DESC)'
);

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Add composite index idx_wh_user_completed for fast continue watching lookups
SET @exist := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'watch_history'
    AND index_name = 'idx_wh_user_completed'
);

SET @sqlstmt := IF(
  @exist > 0,
  'SELECT "Index idx_wh_user_completed already exists" AS message',
  'ALTER TABLE watch_history ADD INDEX idx_wh_user_completed (user_id, completed)'
);

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
