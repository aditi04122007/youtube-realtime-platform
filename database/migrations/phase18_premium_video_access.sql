-- =====================================================================
-- Migration: Phase 18 — Premium Video Access
-- Enhances video_access_rules to define access types and minimum plan requirements
-- =====================================================================

-- 1. Modify required_plan_id to be nullable (for FREE videos that do not require any plan)
ALTER TABLE video_access_rules
  MODIFY COLUMN required_plan_id INT UNSIGNED NULL;

-- 2. Add access_type column (FREE or PREMIUM)
ALTER TABLE video_access_rules
  ADD COLUMN access_type ENUM('FREE', 'PREMIUM') NOT NULL DEFAULT 'FREE' AFTER video_id;

-- 3. Add minimum_plan_code column (BRONZE, SILVER, GOLD, etc.)
ALTER TABLE video_access_rules
  ADD COLUMN minimum_plan_code VARCHAR(20) NULL DEFAULT 'BRONZE' AFTER required_plan_id;

-- 4. Add updated_at timestamp column
ALTER TABLE video_access_rules
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- 5. Add unique key uq_video_id first so foreign key is maintained, then drop old composite uq_var
ALTER TABLE video_access_rules
  ADD UNIQUE KEY uq_video_id (video_id),
  DROP KEY uq_var;
