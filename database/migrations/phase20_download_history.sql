-- =====================================================================
-- Phase 20: Download History and Monthly Quota System Migration
-- =====================================================================

USE video_platform;

-- 1. Safely create or extend the download_history table
CREATE TABLE IF NOT EXISTS download_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    video_id BIGINT UNSIGNED NOT NULL,
    download_id BIGINT UNSIGNED NULL,
    status ENUM(
        'STARTED',
        'COMPLETED',
        'FAILED',
        'CANCELLED'
    ) NOT NULL DEFAULT 'STARTED',
    file_name VARCHAR(255) NULL,
    file_size BIGINT UNSIGNED NULL,
    mime_type VARCHAR(100) NULL,
    downloaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    failure_reason VARCHAR(500) NULL,
    is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    deleted_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_download_history_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_download_history_video
        FOREIGN KEY (video_id)
        REFERENCES videos(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_download_history_download
        FOREIGN KEY (download_id)
        REFERENCES downloads(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
