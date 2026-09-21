-- =====================================================================
-- PHASE 8 DATABASE MIGRATION
-- Video Catalog, Fulltext Search & Search History
-- =====================================================================

-- 1. Add FULLTEXT Index to videos table for title and description search
-- First check if index already exists to avoid errors on duplicate execution
SET @exist := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'videos'
    AND index_name = 'ft_videos_title_desc'
);

SET @sqlstmt := IF(
  @exist > 0,
  'SELECT "Index ft_videos_title_desc already exists" AS message',
  'ALTER TABLE videos ADD FULLTEXT INDEX ft_videos_title_desc (title, description)'
);

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Create search_history table for authenticated users
CREATE TABLE IF NOT EXISTS search_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  query VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_search_history_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX idx_search_history_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
