-- =====================================================================
-- PHASE 13 MIGRATION: COMMENT TRANSLATIONS TABLE
-- Stores cached multilingual translations for comments and replies
-- =====================================================================

CREATE TABLE IF NOT EXISTS comment_translations (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    comment_id BIGINT UNSIGNED NOT NULL,
    target_language VARCHAR(20) NOT NULL,
    source_language VARCHAR(20) NULL,
    translated_content TEXT NOT NULL,
    provider VARCHAR(100) NULL,
    source_content_hash VARCHAR(128) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_comment_translation_comment
        FOREIGN KEY (comment_id)
        REFERENCES comments(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    UNIQUE KEY unique_comment_language (comment_id, target_language),
    INDEX idx_translation_comment (comment_id),
    INDEX idx_translation_language (target_language)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
