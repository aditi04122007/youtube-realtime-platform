-- Phase 24 Migration: Group / One-to-One Call Rooms & Participants

CREATE TABLE IF NOT EXISTS call_rooms (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_code VARCHAR(64) NOT NULL UNIQUE,
  created_by BIGINT UNSIGNED NOT NULL,
  room_type ENUM('ONE_TO_ONE', 'GROUP') NOT NULL DEFAULT 'ONE_TO_ONE',
  status ENUM('WAITING', 'ACTIVE', 'ENDED') NOT NULL DEFAULT 'WAITING',
  max_participants INT NOT NULL DEFAULT 6,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME NULL,
  ended_at DATETIME NULL,
  CONSTRAINT fk_call_rooms_creator
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE CASCADE,
  INDEX idx_call_rooms_creator (created_by, created_at),
  INDEX idx_call_rooms_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS call_room_participants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('HOST', 'PARTICIPANT') NOT NULL DEFAULT 'PARTICIPANT',
  status ENUM('INVITED', 'JOINED', 'LEFT', 'REMOVED') NOT NULL DEFAULT 'INVITED',
  joined_at DATETIME NULL,
  left_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_room_participants_room
    FOREIGN KEY (room_id)
    REFERENCES call_rooms(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_room_participants_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  UNIQUE KEY unique_room_user (room_id, user_id),
  INDEX idx_room_participants_room (room_id),
  INDEX idx_room_participants_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
