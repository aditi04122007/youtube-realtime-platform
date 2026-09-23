-- =====================================================================
-- YouTube-Style Real-Time Video Platform
-- Phase 2: MySQL Relational Database Architecture
-- Engine: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =====================================================================

CREATE DATABASE IF NOT EXISTS video_platform
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE video_platform;

SET FOREIGN_KEY_CHECKS = 0;

-- Drop tables in reverse dependency order for safe idempotent execution
DROP TABLE IF EXISTS call_shared_files;
DROP TABLE IF EXISTS call_room_blocks;
DROP TABLE IF EXISTS call_moderation_actions;
DROP TABLE IF EXISTS call_message_reads;
DROP TABLE IF EXISTS call_messages;
DROP TABLE IF EXISTS call_room_participants;
DROP TABLE IF EXISTS call_participants;
DROP TABLE IF EXISTS call_rooms;
DROP TABLE IF EXISTS video_calls;
DROP TABLE IF EXISTS admin_actions;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS comment_translations;
DROP TABLE IF EXISTS download_history;
DROP TABLE IF EXISTS downloads;
DROP TABLE IF EXISTS payment_webhooks;
DROP TABLE IF EXISTS payment_transactions;
DROP TABLE IF EXISTS payment_orders;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS subscription_history;
DROP TABLE IF EXISTS user_subscriptions;
DROP TABLE IF EXISTS subscription_plans;
DROP TABLE IF EXISTS video_access_rules;
DROP TABLE IF EXISTS security_events;
DROP TABLE IF EXISTS otp_codes;
DROP TABLE IF EXISTS login_attempts;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS playlist_videos;
DROP TABLE IF EXISTS playlists;
DROP TABLE IF EXISTS watch_later;
DROP TABLE IF EXISTS watch_history;
DROP TABLE IF EXISTS search_history;
DROP TABLE IF EXISTS channel_subscriptions;
DROP TABLE IF EXISTS video_reactions;
DROP TABLE IF EXISTS comment_likes;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS video_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS video_category_map;
DROP TABLE IF EXISTS videos;
DROP TABLE IF EXISTS video_categories;
DROP TABLE IF EXISTS channels;
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS users;


-- =====================================================================
-- 1. USERS TABLE
-- Primary identity, authentication credentials, roles, and status
-- =====================================================================
CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('USER', 'CREATOR', 'ADMIN') NOT NULL DEFAULT 'USER',
  status ENUM('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until TIMESTAMP NULL DEFAULT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL DEFAULT NULL,

  CONSTRAINT uq_users_username UNIQUE (username),
  CONSTRAINT uq_users_email UNIQUE (email),
  INDEX idx_users_role (role),
  INDEX idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 2. USER PROFILES TABLE
-- 1-to-1 relationship with users for public and biography details
-- =====================================================================
CREATE TABLE user_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  display_name VARCHAR(100) DEFAULT NULL,
  bio TEXT DEFAULT NULL,
  avatar_url VARCHAR(500) DEFAULT NULL,
  banner_url VARCHAR(500) DEFAULT NULL,
  location VARCHAR(100) DEFAULT NULL,
  website VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_user_profiles_user_id UNIQUE (user_id),
  CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 3. CHANNELS TABLE
-- Creator channels with unique handle and metric counters
-- =====================================================================
CREATE TABLE channels (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  channel_name VARCHAR(100) NOT NULL,
  handle VARCHAR(50) NOT NULL,
  description TEXT DEFAULT NULL,
  avatar_url VARCHAR(500) DEFAULT NULL,
  banner_url VARCHAR(500) DEFAULT NULL,
  subscriber_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  video_count INT UNSIGNED NOT NULL DEFAULT 0,
  view_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_channels_user_id UNIQUE (user_id),
  CONSTRAINT uq_channels_handle UNIQUE (handle),
  CONSTRAINT fk_channels_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX idx_channels_handle (handle)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 4. VIDEO CATEGORIES TABLE
-- Fixed taxonomy for video categorization
-- =====================================================================
CREATE TABLE video_categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(60) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_categories_name UNIQUE (name),
  CONSTRAINT uq_categories_slug UNIQUE (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 5. VIDEOS TABLE
-- Master video metadata, status, visibility, duration, and metrics
-- =====================================================================
CREATE TABLE videos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  channel_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  video_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500) DEFAULT NULL,
  duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  visibility ENUM('PUBLIC', 'UNLISTED', 'PRIVATE') NOT NULL DEFAULT 'PUBLIC',
  status ENUM('PROCESSING', 'READY', 'FAILED', 'DELETED') NOT NULL DEFAULT 'PROCESSING',
  view_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  like_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  dislike_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  comment_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
  mime_type VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  published_at TIMESTAMP NULL DEFAULT NULL,

  CONSTRAINT fk_videos_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_videos_channel FOREIGN KEY (channel_id)
    REFERENCES channels (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_videos_channel_id (channel_id),
  INDEX idx_videos_user_id (user_id),
  INDEX idx_videos_title (title),
  INDEX idx_videos_created_at (created_at),
  INDEX idx_videos_published_at (published_at),
  INDEX idx_videos_visibility (visibility),
  INDEX idx_videos_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 6. VIDEO CATEGORY RELATIONSHIP TABLE
-- Many-to-many relationship mapping videos to multiple categories
-- =====================================================================
CREATE TABLE video_category_map (
  video_id BIGINT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NOT NULL,

  PRIMARY KEY (video_id, category_id),
  CONSTRAINT fk_vcm_video FOREIGN KEY (video_id)
    REFERENCES videos (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_vcm_category FOREIGN KEY (category_id)
    REFERENCES video_categories (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 7. TAGS TABLE
-- Global discovery keywords
-- =====================================================================
CREATE TABLE tags (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(60) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_tags_name UNIQUE (name),
  CONSTRAINT uq_tags_slug UNIQUE (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 8. VIDEO TAGS TABLE
-- Associative table joining videos and tags
-- =====================================================================
CREATE TABLE video_tags (
  video_id BIGINT UNSIGNED NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,

  PRIMARY KEY (video_id, tag_id),
  CONSTRAINT fk_vt_video FOREIGN KEY (video_id)
    REFERENCES videos (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_vt_tag FOREIGN KEY (tag_id)
    REFERENCES tags (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 9. COMMENTS TABLE
-- Hierarchical comments supporting nested replies via parent_comment_id
-- =====================================================================
CREATE TABLE comments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  video_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  parent_comment_id BIGINT UNSIGNED DEFAULT NULL,
  content TEXT NOT NULL,
  status ENUM('VISIBLE', 'HIDDEN', 'DELETED', 'REPORTED', 'REMOVED') NOT NULL DEFAULT 'VISIBLE',
  like_count INT UNSIGNED NOT NULL DEFAULT 0,
  reply_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_comments_video FOREIGN KEY (video_id)
    REFERENCES videos (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_comments_parent FOREIGN KEY (parent_comment_id)
    REFERENCES comments (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_comments_video_id (video_id),
  INDEX idx_comments_user_id (user_id),
  INDEX idx_comments_parent_id (parent_comment_id),
  INDEX idx_comments_created_at (created_at),
  INDEX idx_comments_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 10. COMMENT LIKES TABLE
-- User reactions to comments with duplicate prevention
-- =====================================================================
CREATE TABLE comment_likes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  comment_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_comment_likes UNIQUE (comment_id, user_id),
  CONSTRAINT fk_cl_comment FOREIGN KEY (comment_id)
    REFERENCES comments (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_cl_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 11. VIDEO REACTIONS TABLE
-- Like / Dislike reactions on videos (one reaction per user per video)
-- =====================================================================
CREATE TABLE video_reactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  video_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  reaction_type ENUM('LIKE', 'DISLIKE') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_video_reactions UNIQUE (video_id, user_id),
  CONSTRAINT fk_vr_video FOREIGN KEY (video_id)
    REFERENCES videos (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_vr_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 12. CHANNEL SUBSCRIPTIONS TABLE
-- Follow relationships between subscribers and creator channels
-- =====================================================================
CREATE TABLE channel_subscriptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subscriber_id BIGINT UNSIGNED NOT NULL,
  channel_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_channel_subscriptions UNIQUE (subscriber_id, channel_id),
  CONSTRAINT fk_cs_subscriber FOREIGN KEY (subscriber_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_cs_channel FOREIGN KEY (channel_id)
    REFERENCES channels (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_cs_channel_id (channel_id),
  INDEX idx_cs_subscriber_id (subscriber_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 13. WATCH HISTORY TABLE
-- Playback tracking with resume position and deduplication per video
-- =====================================================================
CREATE TABLE watch_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  video_id BIGINT UNSIGNED NOT NULL,
  progress_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  last_watched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_watch_history UNIQUE (user_id, video_id),
  CONSTRAINT fk_wh_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_wh_video FOREIGN KEY (video_id)
    REFERENCES videos (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_wh_user_id (user_id),
  INDEX idx_wh_last_watched_at (last_watched_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 14. WATCH LATER TABLE
-- User queued videos with uniqueness per user/video
-- =====================================================================
CREATE TABLE watch_later (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  video_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_watch_later UNIQUE (user_id, video_id),
  CONSTRAINT fk_wl_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_wl_video FOREIGN KEY (video_id)
    REFERENCES videos (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 15. PLAYLISTS TABLE
-- User created video playlists
-- =====================================================================
CREATE TABLE playlists (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT DEFAULT NULL,
  visibility ENUM('PUBLIC', 'UNLISTED', 'PRIVATE') NOT NULL DEFAULT 'PUBLIC',
  thumbnail_url VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_playlists_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX idx_playlists_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 16. PLAYLIST VIDEOS TABLE
-- Associative table for ordered playlist entries
-- =====================================================================
CREATE TABLE playlist_videos (
  playlist_id BIGINT UNSIGNED NOT NULL,
  video_id BIGINT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (playlist_id, video_id),
  CONSTRAINT fk_pv_playlist FOREIGN KEY (playlist_id)
    REFERENCES playlists (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_pv_video FOREIGN KEY (video_id)
    REFERENCES videos (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 17. NOTIFICATIONS TABLE
-- Real-time notification events with flexible JSON payloads
-- =====================================================================
CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data_json JSON DEFAULT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX idx_notifications_user_id (user_id),
  INDEX idx_notifications_is_read (is_read),
  INDEX idx_notifications_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 18. DEVICES TABLE
-- Device fingerprinting and session management
-- =====================================================================
CREATE TABLE devices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  device_name VARCHAR(100) DEFAULT NULL,
  device_type VARCHAR(50) DEFAULT NULL,
  browser VARCHAR(50) DEFAULT NULL,
  operating_system VARCHAR(50) DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  refresh_token_hash VARCHAR(255) DEFAULT NULL,
  last_active_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_devices_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX idx_devices_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 19. LOGIN ATTEMPTS TABLE
-- Security logging for brute-force protection and suspicious activity
-- =====================================================================
CREATE TABLE login_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED DEFAULT NULL,
  email VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT DEFAULT NULL,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_la_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  INDEX idx_la_email (email),
  INDEX idx_la_ip (ip_address),
  INDEX idx_la_attempted_at (attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 20. OTP CODES TABLE
-- One-time passwords for registration, login, and reset verification
-- =====================================================================
CREATE TABLE otp_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED DEFAULT NULL,
  email VARCHAR(255) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  purpose ENUM('REGISTRATION', 'LOGIN', 'PASSWORD_RESET', 'EMAIL_VERIFICATION') NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP NULL DEFAULT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_otp_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX idx_otp_email (email),
  INDEX idx_otp_purpose (purpose),
  INDEX idx_otp_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 21. SUBSCRIPTION PLANS TABLE (Phase 15)
-- Tier configurations (FREE, BRONZE, SILVER, GOLD) with limits and pricing
-- =====================================================================
CREATE TABLE subscription_plans (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug ENUM('FREE', 'BRONZE', 'SILVER', 'GOLD') NOT NULL,
  code VARCHAR(20) NOT NULL,
  description TEXT DEFAULT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  monthly_price DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  yearly_price DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  max_video_uploads INT UNSIGNED NOT NULL DEFAULT 10,
  max_storage_gb INT UNSIGNED NOT NULL DEFAULT 5,
  max_playlists INT UNSIGNED NOT NULL DEFAULT 10,
  download_limit INT UNSIGNED NOT NULL DEFAULT 0,
  duration_days INT UNSIGNED NOT NULL DEFAULT 30,
  max_downloads INT UNSIGNED NOT NULL DEFAULT 0,
  max_storage_mb INT UNSIGNED NOT NULL DEFAULT 0,
  premium_access TINYINT(1) NOT NULL DEFAULT 0,
  priority_support TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('ACTIVE', 'DISABLED', 'HIDDEN') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_subscription_plans_slug UNIQUE (slug),
  CONSTRAINT uq_subscription_plans_code UNIQUE (code),
  INDEX idx_sub_plans_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 22. USER SUBSCRIPTIONS TABLE (Phase 15)
-- User active subscription memberships
-- =====================================================================
CREATE TABLE user_subscriptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  plan_id INT UNSIGNED NOT NULL,
  status ENUM('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING') NOT NULL DEFAULT 'PENDING',
  start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP NULL DEFAULT NULL,
  auto_renew TINYINT(1) NOT NULL DEFAULT 0,
  billing_cycle ENUM('MONTHLY', 'YEARLY') NOT NULL DEFAULT 'MONTHLY',
  payment_provider VARCHAR(50) NOT NULL DEFAULT 'DEMO',
  payment_reference VARCHAR(255) DEFAULT NULL,
  razorpay_subscription_id VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_user_sub_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_user_sub_plan FOREIGN KEY (plan_id)
    REFERENCES subscription_plans (id) ON DELETE RESTRICT ON UPDATE CASCADE,

  INDEX idx_user_subscriptions_user (user_id),
  INDEX idx_user_subscriptions_plan (plan_id),
  INDEX idx_user_subscriptions_status (status),
  INDEX idx_user_subscriptions_user_status (user_id, status),
  INDEX idx_user_sub_user_status_end (user_id, status, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- =====================================================================
-- 23. PAYMENTS TABLE
-- Gateway payment ledger (Razorpay Test Mode Integration - Phase 16)
-- =====================================================================
CREATE TABLE payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  subscription_id BIGINT UNSIGNED DEFAULT NULL,
  plan_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  payment_gateway VARCHAR(50) NOT NULL DEFAULT 'RAZORPAY',
  provider VARCHAR(50) NOT NULL DEFAULT 'RAZORPAY',
  gateway_payment_id VARCHAR(100) DEFAULT NULL,
  gateway_order_id VARCHAR(100) DEFAULT NULL,
  provider_order_id VARCHAR(100) DEFAULT NULL,
  provider_payment_id VARCHAR(100) DEFAULT NULL,
  provider_signature VARCHAR(255) DEFAULT NULL,
  payment_method VARCHAR(50) DEFAULT NULL,
  receipt VARCHAR(100) DEFAULT NULL,
  billing_cycle ENUM('MONTHLY', 'YEARLY') NOT NULL DEFAULT 'MONTHLY',
  status ENUM(
    'CREATED',
    'PENDING',
    'PAID',
    'SUCCESS',
    'FAILED',
    'VERIFICATION_FAILED',
    'REFUNDED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'CREATED',
  failure_reason VARCHAR(255) DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  paid_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_payments_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_payments_sub FOREIGN KEY (subscription_id)
    REFERENCES user_subscriptions (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_payments_plan FOREIGN KEY (plan_id)
    REFERENCES subscription_plans (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  INDEX idx_payments_user_id (user_id),
  INDEX idx_payments_status (status),
  INDEX idx_payments_user_status (user_id, status),
  INDEX idx_payments_gateway_id (gateway_payment_id),
  INDEX idx_payments_receipt (receipt),
  UNIQUE INDEX uq_payments_provider_order (provider_order_id),
  UNIQUE INDEX uq_payments_provider_payment (provider_payment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 24. PREMIUM VIDEO ACCESS RULES TABLE
-- Restricts specific videos to minimum required subscription tier
-- =====================================================================
CREATE TABLE video_access_rules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  video_id BIGINT UNSIGNED NOT NULL,
  access_type ENUM('FREE', 'PREMIUM') NOT NULL DEFAULT 'FREE',
  required_plan_id INT UNSIGNED NULL,
  minimum_plan_code VARCHAR(20) NULL DEFAULT 'BRONZE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_video_id UNIQUE (video_id),
  CONSTRAINT fk_var_video FOREIGN KEY (video_id)
    REFERENCES videos (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_var_plan FOREIGN KEY (required_plan_id)
    REFERENCES subscription_plans (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 25. DOWNLOADS TABLE
-- Controlled video downloads and lifecycle tracking (Phase 19)
-- =====================================================================
CREATE TABLE downloads (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  video_id BIGINT UNSIGNED NOT NULL,
  status ENUM('REQUESTED', 'STARTED', 'COMPLETED', 'FAILED', 'CANCELLED', 'PROCESSING', 'READY', 'EXPIRED') NOT NULL DEFAULT 'REQUESTED',
  file_name VARCHAR(255) NULL,
  file_size BIGINT UNSIGNED NULL,
  mime_type VARCHAR(100) NULL,
  download_url VARCHAR(500) DEFAULT NULL,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_downloads_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_downloads_video FOREIGN KEY (video_id)
    REFERENCES videos (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_downloads_user_id (user_id),
  INDEX idx_downloads_video_id (video_id),
  INDEX idx_downloads_status (status),
  INDEX idx_downloads_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 26. DOWNLOAD HISTORY TABLE
-- Historical audit trail for user download quotas
-- =====================================================================
CREATE TABLE download_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  video_id BIGINT UNSIGNED NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
  downloaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_dh_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_dh_video FOREIGN KEY (video_id)
    REFERENCES videos (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_dh_user_id (user_id),
  INDEX idx_dh_video_id (video_id),
  INDEX idx_dh_downloaded_at (downloaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 27. CALL ROOMS TABLE
-- WebRTC room sessions (One-to-One and Group Rooms)
-- =====================================================================
CREATE TABLE call_rooms (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_code VARCHAR(64) NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  room_type ENUM('ONE_TO_ONE', 'GROUP') NOT NULL DEFAULT 'ONE_TO_ONE',
  status ENUM('WAITING', 'ACTIVE', 'ENDED') NOT NULL DEFAULT 'WAITING',
  max_participants INT UNSIGNED NOT NULL DEFAULT 2,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL DEFAULT NULL,
  ended_at TIMESTAMP NULL DEFAULT NULL,

  CONSTRAINT uq_call_rooms_code UNIQUE (room_code),
  CONSTRAINT fk_cr_creator FOREIGN KEY (created_by)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_cr_code (room_code),
  INDEX idx_cr_created_by (created_by),
  INDEX idx_cr_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 28. CALL PARTICIPANTS TABLE
-- Members inside WebRTC rooms and assigned conference roles
-- =====================================================================
CREATE TABLE call_participants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP NULL DEFAULT NULL,
  role ENUM('HOST', 'PARTICIPANT', 'MODERATOR') NOT NULL DEFAULT 'PARTICIPANT',

  CONSTRAINT fk_cp_room FOREIGN KEY (room_id)
    REFERENCES call_rooms (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_cp_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_cp_room_id (room_id),
  INDEX idx_cp_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 29. CALL MESSAGES TABLE
-- In-call real-time text chat and shared attachment URLs
-- =====================================================================
CREATE TABLE call_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  message TEXT NOT NULL,
  attachment_url VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_cm_room FOREIGN KEY (room_id)
    REFERENCES call_rooms (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_cm_user FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_cm_room_id (room_id),
  INDEX idx_cm_user_id (user_id),
  INDEX idx_cm_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 30. REPORTS TABLE
-- Content and user moderation reporting
-- =====================================================================
CREATE TABLE reports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reporter_id BIGINT UNSIGNED NOT NULL,
  reported_user_id BIGINT UNSIGNED DEFAULT NULL,
  video_id BIGINT UNSIGNED DEFAULT NULL,
  comment_id BIGINT UNSIGNED DEFAULT NULL,
  reason VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  status ENUM('PENDING', 'REVIEWING', 'REVIEWED', 'DISMISSED', 'ACTION_TAKEN', 'RESOLVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  reviewed_by BIGINT UNSIGNED DEFAULT NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  resolution_note TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_rep_reporter FOREIGN KEY (reporter_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_rep_reported_user FOREIGN KEY (reported_user_id)
    REFERENCES users (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_rep_video FOREIGN KEY (video_id)
    REFERENCES videos (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_rep_comment FOREIGN KEY (comment_id)
    REFERENCES comments (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_rep_reviewer FOREIGN KEY (reviewed_by)
    REFERENCES users (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  INDEX idx_reports_reporter_id (reporter_id),
  INDEX idx_reports_status (status),
  INDEX idx_reports_video_id (video_id),
  INDEX idx_reports_comment_id (comment_id),
  INDEX idx_reports_reporter_comment (reporter_id, comment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 31. ADMIN ACTIONS TABLE
-- Administrative audit log for policy enforcements, moderation, bans
-- =====================================================================
CREATE TABLE admin_actions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id BIGINT UNSIGNED NOT NULL,
  action_type VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(255) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_aa_admin FOREIGN KEY (admin_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_aa_admin_id (admin_id),
  INDEX idx_aa_action_type (action_type),
  INDEX idx_aa_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 32. COMMENT TRANSLATIONS TABLE (Phase 13)
-- Multilingual cached translations for comments and replies
-- =====================================================================
CREATE TABLE comment_translations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  comment_id BIGINT UNSIGNED NOT NULL,
  target_language VARCHAR(20) NOT NULL,
  source_language VARCHAR(20) NULL,
  translated_content TEXT NOT NULL,
  provider VARCHAR(100) NULL,
  source_content_hash VARCHAR(128) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_comment_translation_comment
    FOREIGN KEY (comment_id)
    REFERENCES comments (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  UNIQUE KEY unique_comment_language (comment_id, target_language),
  INDEX idx_translation_comment (comment_id),
  INDEX idx_translation_language (target_language)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;





-- =====================================================================
-- 35. SUBSCRIPTION HISTORY TABLE (Phase 15)
-- Audit history of plan upgrades, downgrades, cancellations, assignments
-- =====================================================================
CREATE TABLE subscription_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  previous_plan_id INT UNSIGNED NULL,
  new_plan_id INT UNSIGNED NOT NULL,
  action ENUM('ASSIGNED', 'UPGRADED', 'DOWNGRADED', 'CANCELLED', 'RENEWED', 'EXPIRED') NOT NULL DEFAULT 'ASSIGNED',
  reason VARCHAR(255) DEFAULT NULL,
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


-- =====================================================================
-- 36. SEARCH HISTORY TABLE (Phase 8)
-- User search queries for autocomplete and personalized discovery
-- =====================================================================
CREATE TABLE IF NOT EXISTS search_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  query VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_search_history_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,

  INDEX idx_search_history_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 37. SECURITY EVENTS TABLE (Phase 5)
-- Audit trail for security anomalies, password changes, and OTP checks
-- =====================================================================
CREATE TABLE IF NOT EXISTS security_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED DEFAULT NULL,
  event_type VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT DEFAULT NULL,
  device_id BIGINT UNSIGNED DEFAULT NULL,
  metadata_json JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_se_device FOREIGN KEY (device_id)
    REFERENCES devices (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_se_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,

  INDEX idx_se_user_id (user_id),
  INDEX idx_se_event_type (event_type),
  INDEX idx_se_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 38. VIDEO CALLS TABLE (Phase 23)
-- Real-time 1:1 video call sessions and state lifecycle
-- =====================================================================
CREATE TABLE IF NOT EXISTS video_calls (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  caller_id BIGINT UNSIGNED NOT NULL,
  receiver_id BIGINT UNSIGNED NOT NULL,
  status ENUM('RINGING','ACCEPTED','REJECTED','MISSED','ENDED','FAILED') NOT NULL DEFAULT 'RINGING',
  started_at DATETIME DEFAULT NULL,
  answered_at DATETIME DEFAULT NULL,
  ended_at DATETIME DEFAULT NULL,
  end_reason VARCHAR(100) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_video_calls_caller FOREIGN KEY (caller_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_video_calls_receiver FOREIGN KEY (receiver_id)
    REFERENCES users (id) ON DELETE CASCADE,

  INDEX idx_video_calls_caller (caller_id, created_at DESC),
  INDEX idx_video_calls_receiver (receiver_id, created_at DESC),
  INDEX idx_video_calls_status (status),
  INDEX idx_video_calls_active (caller_id, receiver_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 39. CALL ROOM PARTICIPANTS TABLE (Phase 24)
-- Multi-party WebRTC room memberships and roles
-- =====================================================================
CREATE TABLE IF NOT EXISTS call_room_participants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('HOST','PARTICIPANT') NOT NULL DEFAULT 'PARTICIPANT',
  status ENUM('INVITED','JOINED','LEFT','REMOVED') NOT NULL DEFAULT 'INVITED',
  joined_at DATETIME DEFAULT NULL,
  left_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  server_muted TINYINT(1) NOT NULL DEFAULT 0,
  server_camera_disabled TINYINT(1) NOT NULL DEFAULT 0,

  CONSTRAINT fk_room_participants_room FOREIGN KEY (room_id)
    REFERENCES call_rooms (id) ON DELETE CASCADE,
  CONSTRAINT fk_room_participants_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,

  UNIQUE KEY unique_room_user (room_id, user_id),
  INDEX idx_room_participants_room (room_id),
  INDEX idx_room_participants_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 40. CALL MESSAGE READS TABLE (Phase 26)
-- Read receipts for in-call chat messages
-- =====================================================================
CREATE TABLE IF NOT EXISTS call_message_reads (
  message_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (message_id, user_id),
  CONSTRAINT fk_call_reads_message FOREIGN KEY (message_id)
    REFERENCES call_messages (id) ON DELETE CASCADE,
  CONSTRAINT fk_call_reads_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,

  INDEX fk_call_reads_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 41. CALL MODERATION & SECURITY TABLES (Phase 25 & 26)
-- Host room actions, block lists, and shared room files
-- =====================================================================
CREATE TABLE IF NOT EXISTS call_moderation_actions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  moderator_id BIGINT UNSIGNED NOT NULL,
  target_user_id BIGINT UNSIGNED DEFAULT NULL,
  action_type ENUM('MUTE','UNMUTE','CAMERA_DISABLE','CAMERA_ENABLE','REMOVE','BLOCK_REJOIN','UNBLOCK_REJOIN','REPORT','END_ROOM') NOT NULL,
  reason VARCHAR(500) DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_moderation_moderator FOREIGN KEY (moderator_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_moderation_room FOREIGN KEY (room_id)
    REFERENCES call_rooms (id) ON DELETE CASCADE,
  CONSTRAINT fk_moderation_target FOREIGN KEY (target_user_id)
    REFERENCES users (id) ON DELETE SET NULL,

  INDEX idx_moderation_room (room_id, created_at),
  INDEX idx_moderation_target (target_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS call_room_blocks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  blocked_by BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(500) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_room_blocks_admin FOREIGN KEY (blocked_by)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_room_blocks_room FOREIGN KEY (room_id)
    REFERENCES call_rooms (id) ON DELETE CASCADE,
  CONSTRAINT fk_room_blocks_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,

  UNIQUE KEY unique_room_block (room_id, user_id),
  INDEX idx_room_blocks_room (room_id),
  INDEX idx_room_blocks_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  deleted_at DATETIME DEFAULT NULL,

  CONSTRAINT fk_call_files_room FOREIGN KEY (room_id)
    REFERENCES call_rooms (id) ON DELETE CASCADE,
  CONSTRAINT fk_call_files_uploader FOREIGN KEY (uploader_id)
    REFERENCES users (id) ON DELETE CASCADE,

  INDEX idx_call_files_room (room_id, created_at),
  INDEX fk_call_files_uploader (uploader_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;



