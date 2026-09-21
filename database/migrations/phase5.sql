-- =====================================================================
-- YouTube-Style Real-Time Video Platform
-- Phase 5 Migration: Login Security, Device/IP Tracking, Security Events
-- =====================================================================

USE video_platform;

-- 1. Create security_events table for structured audit logging
CREATE TABLE IF NOT EXISTS security_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED DEFAULT NULL,
  event_type VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT DEFAULT NULL,
  device_id BIGINT UNSIGNED DEFAULT NULL,
  metadata_json JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_se_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_se_device FOREIGN KEY (device_id)
    REFERENCES devices (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  INDEX idx_se_user_id (user_id),
  INDEX idx_se_event_type (event_type),
  INDEX idx_se_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Alter devices table to support cryptographic session tracking & revocation
-- Check and add session_id
SET @dbname = DATABASE();
SET @tablename = "devices";
SET @columnname = "session_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE devices ADD COLUMN session_id VARCHAR(64) NULL UNIQUE AFTER user_id"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add is_revoked
SET @columnname = "is_revoked";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE devices ADD COLUMN is_revoked BOOLEAN NOT NULL DEFAULT FALSE AFTER refresh_token_hash"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add revoked_at
SET @columnname = "revoked_at";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE devices ADD COLUMN revoked_at TIMESTAMP NULL DEFAULT NULL AFTER is_revoked"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add composite index on (user_id, is_revoked) if not exists
SET @indexname = "idx_devices_user_revoked";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND INDEX_NAME = @indexname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE devices ADD INDEX idx_devices_user_revoked (user_id, is_revoked)"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 3. Alter users table to support failed login tracking & temporary account lockout
SET @tablename = "users";

-- Check and add failed_login_attempts
SET @columnname = "failed_login_attempts";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE users ADD COLUMN failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0 AFTER status"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add locked_until
SET @columnname = "locked_until";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE users ADD COLUMN locked_until TIMESTAMP NULL DEFAULT NULL AFTER failed_login_attempts"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
