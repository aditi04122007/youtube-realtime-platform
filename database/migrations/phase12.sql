-- =====================================================================
-- PHASE 12 MIGRATION: ADVANCED COMMENTS & REPLIES INDEXES
-- =====================================================================
ALTER TABLE comments ADD INDEX idx_comments_video_parent_created (video_id, parent_comment_id, created_at);
ALTER TABLE comments ADD INDEX idx_comments_video_parent_likes (video_id, parent_comment_id, like_count);
ALTER TABLE comments ADD INDEX idx_comments_parent_created (parent_comment_id, created_at);
