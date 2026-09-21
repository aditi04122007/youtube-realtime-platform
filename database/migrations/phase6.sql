-- =====================================================================
-- YouTube-Style Real-Time Video Platform
-- Phase 6 Migration: Optimize Videos Table for Homepage Feed
-- =====================================================================

USE video_platform;

-- Create indexes if they do not already exist
DROP PROCEDURE IF EXISTS AddPhase6Indexes;

DELIMITER //
CREATE PROCEDURE AddPhase6Indexes()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics 
    WHERE table_schema = 'video_platform' AND table_name = 'videos' AND index_name = 'idx_videos_feed'
  ) THEN
    ALTER TABLE videos ADD INDEX idx_videos_feed (status, visibility, published_at DESC);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics 
    WHERE table_schema = 'video_platform' AND table_name = 'videos' AND index_name = 'idx_videos_views'
  ) THEN
    ALTER TABLE videos ADD INDEX idx_videos_views (status, visibility, view_count DESC);
  END IF;
END //
DELIMITER ;

CALL AddPhase6Indexes();
DROP PROCEDURE IF EXISTS AddPhase6Indexes;
