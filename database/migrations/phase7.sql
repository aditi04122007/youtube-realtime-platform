-- =====================================================================
-- YouTube-Style Real-Time Video Platform
-- Phase 7 Migration: Extend Video Status Enum for Publishing
-- =====================================================================

USE video_platform;

-- Safely extend videos status ENUM to include 'PUBLISHED'
ALTER TABLE videos 
  MODIFY COLUMN status ENUM('PROCESSING', 'READY', 'PUBLISHED', 'FAILED', 'DELETED') NOT NULL DEFAULT 'PROCESSING';
