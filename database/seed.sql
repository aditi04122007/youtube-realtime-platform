-- =====================================================================
-- YouTube-Style Real-Time Video Platform
-- Phase 2: Database Seed Data
-- =====================================================================

USE video_platform;

-- 1. Populate Standard Video Categories
INSERT INTO video_categories (name, slug, description) VALUES
  ('Technology', 'technology', 'Gadgets, software, programming, and hardware innovation'),
  ('Education', 'education', 'Tutorials, academic subjects, and skill-building masterclasses'),
  ('Gaming', 'gaming', 'Game walkthroughs, esports tournaments, reviews, and streams'),
  ('Music', 'music', 'Music videos, live concerts, acoustic sessions, and tracks'),
  ('Entertainment', 'entertainment', 'Film trailers, pop culture, comedy shows, and drama'),
  ('News', 'news', 'Global reports, investigative journalism, and daily bulletins'),
  ('Sports', 'sports', 'Match highlights, athletic training, events, and fitness'),
  ('Travel', 'travel', 'Travel vlogs, destination guides, and adventure tours'),
  ('Science', 'science', 'Physics, space exploration, chemistry, and biology'),
  ('Comedy', 'comedy', 'Stand-up comedy, sketches, parodies, and humor'),
  ('Lifestyle', 'lifestyle', 'Fashion, cooking, design, wellness, and personal blogs'),
  ('Other', 'other', 'Miscellaneous and unclassified video content')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);

-- 2. Populate Subscription Plans
INSERT INTO subscription_plans (name, slug, description, price, duration_days, max_downloads, max_storage_mb, premium_access) VALUES
  ('Free Plan', 'FREE', 'Default tier: Ad-supported streaming with basic playback', 0.00, 3650, 2, 500, FALSE),
  ('Bronze Supporter', 'BRONZE', 'Entry tier: Ad-free playback, up to 10 offline downloads', 199.00, 30, 10, 2048, TRUE),
  ('Silver Creator', 'SILVER', 'Mid tier: HD offline downloads, priority comments, 30 downloads', 499.00, 30, 30, 10240, TRUE),
  ('Gold VIP', 'GOLD', 'Ultimate tier: 4K streaming, 100 offline downloads, group call access', 999.00, 30, 100, 51200, TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price), description = VALUES(description);
