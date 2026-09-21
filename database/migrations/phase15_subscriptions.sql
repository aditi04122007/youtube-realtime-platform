-- =====================================================================
-- Phase 15: Subscriptions Foundation Migration (FREE, BRONZE, SILVER, GOLD)
-- =====================================================================

USE video_platform;

-- Update subscription_plans columns if not already added
-- 1. Table subscription_plans
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS code VARCHAR(20) NOT NULL DEFAULT 'FREE' AFTER slug,
  ADD COLUMN IF NOT EXISTS monthly_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER price,
  ADD COLUMN IF NOT EXISTS yearly_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER monthly_price,
  ADD COLUMN IF NOT EXISTS max_video_uploads INT UNSIGNED NOT NULL DEFAULT 10 AFTER yearly_price,
  ADD COLUMN IF NOT EXISTS max_storage_gb INT UNSIGNED NOT NULL DEFAULT 5 AFTER max_video_uploads,
  ADD COLUMN IF NOT EXISTS max_playlists INT UNSIGNED NOT NULL DEFAULT 10 AFTER max_storage_gb,
  ADD COLUMN IF NOT EXISTS download_limit INT UNSIGNED NOT NULL DEFAULT 0 AFTER max_playlists,
  ADD COLUMN IF NOT EXISTS priority_support TINYINT(1) NOT NULL DEFAULT 0 AFTER premium_access,
  ADD COLUMN IF NOT EXISTS status ENUM('ACTIVE', 'DISABLED', 'HIDDEN') NOT NULL DEFAULT 'ACTIVE' AFTER priority_support;

UPDATE subscription_plans SET code = slug;

-- 2. Update initial 4 tiers (0 indicates unlimited)
UPDATE subscription_plans 
SET 
  name = 'Free Plan',
  code = 'FREE',
  description = 'Default tier: Ad-supported streaming with basic playback and standard storage',
  monthly_price = 0.00,
  price = 0.00,
  yearly_price = 0.00,
  max_video_uploads = 10,
  max_storage_gb = 5,
  max_playlists = 10,
  download_limit = 0,
  premium_access = 0,
  priority_support = 0,
  status = 'ACTIVE'
WHERE slug = 'FREE';

UPDATE subscription_plans 
SET 
  name = 'Bronze Supporter',
  code = 'BRONZE',
  description = 'Entry tier: Ad-free playback, 20 monthly offline downloads, and 50 GB storage',
  monthly_price = 199.00,
  price = 199.00,
  yearly_price = 1990.00,
  max_video_uploads = 100,
  max_storage_gb = 50,
  max_playlists = 50,
  download_limit = 20,
  premium_access = 1,
  priority_support = 0,
  status = 'ACTIVE'
WHERE slug = 'BRONZE';

UPDATE subscription_plans 
SET 
  name = 'Silver Creator',
  code = 'SILVER',
  description = 'Mid tier: HD offline downloads, priority comments, 500 uploads, and 250 GB storage',
  monthly_price = 499.00,
  price = 499.00,
  yearly_price = 4990.00,
  max_video_uploads = 500,
  max_storage_gb = 250,
  max_playlists = 200,
  download_limit = 100,
  premium_access = 1,
  priority_support = 0,
  status = 'ACTIVE'
WHERE slug = 'SILVER';

UPDATE subscription_plans 
SET 
  name = 'Gold VIP',
  code = 'GOLD',
  description = 'Ultimate tier: 4K streaming, unlimited uploads, unlimited storage, and VIP priority support',
  monthly_price = 999.00,
  price = 999.00,
  yearly_price = 9990.00,
  max_video_uploads = 0,
  max_storage_gb = 0,
  max_playlists = 0,
  download_limit = 0,
  premium_access = 1,
  priority_support = 1,
  status = 'ACTIVE'
WHERE slug = 'GOLD';

-- 3. Table user_subscriptions
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50) NOT NULL DEFAULT 'DEMO' AFTER auto_renew,
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255) NULL AFTER payment_provider;

-- 4. Table subscription_history
CREATE TABLE IF NOT EXISTS subscription_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  previous_plan_id INT UNSIGNED NULL,
  new_plan_id INT UNSIGNED NOT NULL,
  action ENUM('ASSIGNED', 'UPGRADED', 'DOWNGRADED', 'CANCELLED', 'RENEWED') NOT NULL DEFAULT 'ASSIGNED',
  reason VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_sub_hist_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_sub_hist_prev_plan FOREIGN KEY (previous_plan_id)
    REFERENCES subscription_plans (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_sub_hist_new_plan FOREIGN KEY (new_plan_id)
    REFERENCES subscription_plans (id) ON DELETE RESTRICT ON UPDATE CASCADE,

  INDEX idx_sub_hist_user (user_id),
  INDEX idx_sub_hist_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
