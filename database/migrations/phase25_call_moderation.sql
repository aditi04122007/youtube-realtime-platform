-- Phase 25 Migration: Video Call Moderation, Safety Controls & Room Blocks

-- 1. Create Call Moderation Actions Table
CREATE TABLE IF NOT EXISTS call_moderation_actions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  moderator_id BIGINT UNSIGNED NOT NULL,
  target_user_id BIGINT UNSIGNED NULL,
  action_type ENUM(
    'MUTE',
    'UNMUTE',
    'CAMERA_DISABLE',
    'CAMERA_ENABLE',
    'REMOVE',
    'BLOCK_REJOIN',
    'UNBLOCK_REJOIN',
    'REPORT',
    'END_ROOM'
  ) NOT NULL,
  reason VARCHAR(500) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_moderation_room
    FOREIGN KEY (room_id)
    REFERENCES call_rooms(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_moderation_moderator
    FOREIGN KEY (moderator_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_moderation_target
    FOREIGN KEY (target_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,
  INDEX idx_moderation_room (room_id, created_at),
  INDEX idx_moderation_target (target_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create Call Room Blocks Table
CREATE TABLE IF NOT EXISTS call_room_blocks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  blocked_by BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_room_blocks_room
    FOREIGN KEY (room_id)
    REFERENCES call_rooms(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_room_blocks_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_room_blocks_admin
    FOREIGN KEY (blocked_by)
    REFERENCES users(id)
    ON DELETE CASCADE,
  UNIQUE KEY unique_room_block (room_id, user_id),
  INDEX idx_room_blocks_room (room_id),
  INDEX idx_room_blocks_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Extend call_room_participants table with server moderation state flags
ALTER TABLE call_room_participants
  ADD COLUMN IF NOT EXISTS server_muted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS server_camera_disabled BOOLEAN NOT NULL DEFAULT FALSE;
