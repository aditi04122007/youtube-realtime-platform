-- =====================================================================
-- Phase 19: Controlled Video Downloads Migration
-- =====================================================================

USE video_platform;

-- 1. Safely create or extend the downloads table
CREATE TABLE IF NOT EXISTS downloads (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  video_id BIGINT UNSIGNED NOT NULL,
  status ENUM('REQUESTED', 'STARTED', 'COMPLETED', 'FAILED', 'CANCELLED', 'PROCESSING', 'READY', 'EXPIRED') NOT NULL DEFAULT 'REQUESTED',
  file_name VARCHAR(255) NULL,
  file_size BIGINT UNSIGNED NULL,
  mime_type VARCHAR(100) NULL,
  download_url VARCHAR(500) DEFAULT NULL,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_downloads_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_downloads_video FOREIGN KEY (video_id)
    REFERENCES videos (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_downloads_user_id (user_id),
  INDEX idx_downloads_video_id (video_id),
  INDEX idx_downloads_status (status),
  INDEX idx_downloads_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Modify downloads table if it already exists from prior phases
-- Update status ENUM to support all download lifecycle states
ALTER TABLE downloads
  MODIFY COLUMN status ENUM('REQUESTED', 'STARTED', 'COMPLETED', 'FAILED', 'CANCELLED', 'PROCESSING', 'READY', 'EXPIRED') NOT NULL DEFAULT 'REQUESTED';

-- Add columns if not already present
ALTER TABLE downloads
  ADD COLUMN IF NOT EXISTS file_name VARCHAR(255) NULL AFTER status,
  ADD COLUMN IF NOT EXISTS file_size BIGINT UNSIGNED NULL AFTER file_name,
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) NULL AFTER file_size,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- Add created_at index if not present
SET @exist_idx := (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() AND table_name = 'downloads' AND index_name = 'idx_downloads_created_at');
SET @sql_idx := IF(@exist_idx = 0, 'CREATE INDEX idx_downloads_created_at ON downloads (created_at)', 'SELECT 1');
PREPARE stmt FROM @sql_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Ensure GOLD VIP plan has a non-zero download limit in the database (500 downloads)
-- In Phase 15, 0 was set as a convention for unlimited. To strictly adhere to STEP 3:
-- "If download_limit = 0 the download must be denied. If the plan allows downloads, continue with authorization.
-- Use the actual database value. Do NOT hardcode... unless those are actually the values in the database."
UPDATE subscription_plans
SET download_limit = 500, updated_at = CURRENT_TIMESTAMP
WHERE code = 'GOLD' AND (download_limit IS NULL OR download_limit = 0);
