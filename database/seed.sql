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
INSERT INTO subscription_plans (name, slug, code, description, price, monthly_price, yearly_price, max_video_uploads, max_storage_gb, max_playlists, download_limit, duration_days, max_downloads, max_storage_mb, premium_access, priority_support, status) VALUES
  ('Free Plan', 'FREE', 'FREE', 'Default tier: Ad-supported streaming with basic playback and standard storage', 0.00, 0.00, 0.00, 10, 5, 10, 0, 3650, 0, 500, FALSE, 0, 'ACTIVE'),
  ('Bronze Supporter', 'BRONZE', 'BRONZE', 'Entry tier: Ad-free playback, 20 monthly offline downloads, and 50 GB storage', 199.00, 199.00, 1990.00, 100, 50, 50, 20, 30, 20, 2048, TRUE, 0, 'ACTIVE'),
  ('Silver Creator', 'SILVER', 'SILVER', 'Mid tier: HD offline downloads, priority comments, 100 downloads, 250 GB storage', 499.00, 499.00, 4990.00, 500, 250, 100, 100, 30, 100, 10240, TRUE, 1, 'ACTIVE'),
  ('Gold VIP', 'GOLD', 'GOLD', 'Ultimate tier: 4K streaming, unlimited offline downloads, group call access, priority support', 999.00, 999.00, 9990.00, 0, 0, 0, 0, 30, 0, 51200, TRUE, 1, 'ACTIVE')
ON DUPLICATE KEY UPDATE name = VALUES(name), code = VALUES(code), price = VALUES(price), monthly_price = VALUES(monthly_price), yearly_price = VALUES(yearly_price), description = VALUES(description), download_limit = VALUES(download_limit), max_video_uploads = VALUES(max_video_uploads), max_storage_gb = VALUES(max_storage_gb), max_playlists = VALUES(max_playlists), status = VALUES(status);

