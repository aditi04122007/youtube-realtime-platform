-- Phase 26 Migration: In-Call Text Chat, File Sharing, and Message Persistence

-- 1. Create Call Shared Files Table
CREATE TABLE IF NOT EXISTS call_shared_files (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT UNSIGNED NOT NULL,
    uploader_id BIGINT UNSIGNED NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(150) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL,
    storage_path VARCHAR(1000) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    CONSTRAINT fk_call_files_room
        FOREIGN KEY (room_id)
        REFERENCES call_rooms(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_call_files_uploader
        FOREIGN KEY (uploader_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_call_files_room (room_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create Call Messages Table
CREATE TABLE IF NOT EXISTS call_messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT UNSIGNED NOT NULL,
    sender_id BIGINT UNSIGNED NOT NULL,
    message_type ENUM('TEXT', 'FILE') NOT NULL DEFAULT 'TEXT',
    message_text TEXT NULL,
    file_id BIGINT UNSIGNED NULL,
    reply_to_message_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL,
    deleted_at DATETIME NULL,
    CONSTRAINT fk_call_messages_room
        FOREIGN KEY (room_id)
        REFERENCES call_rooms(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_call_messages_sender
        FOREIGN KEY (sender_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_call_messages_file
        FOREIGN KEY (file_id)
        REFERENCES call_shared_files(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_call_messages_reply
        FOREIGN KEY (reply_to_message_id)
        REFERENCES call_messages(id)
        ON DELETE SET NULL,
    INDEX idx_call_messages_room (room_id, created_at),
    INDEX idx_call_messages_sender (sender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create Call Message Reads Table
CREATE TABLE IF NOT EXISTS call_message_reads (
    message_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id),
    CONSTRAINT fk_call_reads_message
        FOREIGN KEY (message_id)
        REFERENCES call_messages(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_call_reads_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
