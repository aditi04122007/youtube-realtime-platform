-- =====================================================================
-- PHASE 23 DATABASE MIGRATION: Real-Time Video Calling
-- =====================================================================

CREATE TABLE IF NOT EXISTS video_calls (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  caller_id BIGINT UNSIGNED NOT NULL,
  receiver_id BIGINT UNSIGNED NOT NULL,
  status ENUM(
    'RINGING',
    'ACCEPTED',
    'REJECTED',
    'MISSED',
    'ENDED',
    'FAILED'
  ) NOT NULL DEFAULT 'RINGING',
  started_at DATETIME NULL,
  answered_at DATETIME NULL,
  ended_at DATETIME NULL,
  end_reason VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_video_calls_caller
    FOREIGN KEY (caller_id)
    REFERENCES users (id)
    ON DELETE CASCADE,

  CONSTRAINT fk_video_calls_receiver
    FOREIGN KEY (receiver_id)
    REFERENCES users (id)
    ON DELETE CASCADE,

  INDEX idx_video_calls_caller (caller_id, created_at DESC),
  INDEX idx_video_calls_receiver (receiver_id, created_at DESC),
  INDEX idx_video_calls_status (status),
  INDEX idx_video_calls_active (caller_id, receiver_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
