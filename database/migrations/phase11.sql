-- =====================================================================
-- PHASE 11 DATABASE MIGRATION
-- Video Reactions (Likes & Dislikes)
-- =====================================================================

-- 1. Ensure dislike_count column exists on videos table
SET @exist := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'videos'
    AND column_name = 'dislike_count'
);

SET @sqlstmt := IF(
  @exist > 0,
  'SELECT "Column dislike_count already exists on videos" AS message',
  'ALTER TABLE videos ADD COLUMN dislike_count BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER like_count'
);

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Add composite index idx_vr_user_video on video_reactions for fast user-specific lookups
SET @exist := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'video_reactions'
    AND index_name = 'idx_vr_user_video'
);

SET @sqlstmt := IF(
  @exist > 0,
  'SELECT "Index idx_vr_user_video already exists on video_reactions" AS message',
  'ALTER TABLE video_reactions ADD INDEX idx_vr_user_video (user_id, video_id)'
);

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Add composite index idx_vr_video_reaction on video_reactions for fast count aggregations
SET @exist := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'video_reactions'
    AND index_name = 'idx_vr_video_reaction'
);

SET @sqlstmt := IF(
  @exist > 0,
  'SELECT "Index idx_vr_video_reaction already exists on video_reactions" AS message',
  'ALTER TABLE video_reactions ADD INDEX idx_vr_video_reaction (video_id, reaction_type)'
);

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
