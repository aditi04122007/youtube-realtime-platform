-- Phase 29: Admin Dashboard Schema Enhancements

-- 1. Expand users.status to include BANNED
ALTER TABLE users MODIFY COLUMN status ENUM('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED') NOT NULL DEFAULT 'ACTIVE';

-- 1.1 Expand users.role to include CREATOR
ALTER TABLE users MODIFY COLUMN role ENUM('USER', 'CREATOR', 'ADMIN') NOT NULL DEFAULT 'USER';

-- 2. Add status column to channels
ALTER TABLE channels ADD COLUMN IF NOT EXISTS status ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_channels_status ON channels (status);

-- 3. Expand videos.status to include REMOVED and HIDDEN for administrative moderation
ALTER TABLE videos MODIFY COLUMN status ENUM('PROCESSING', 'READY', 'PUBLISHED', 'FAILED', 'DELETED', 'REMOVED', 'HIDDEN') NOT NULL DEFAULT 'PROCESSING';

-- 4. Add index for target lookup on admin_actions
CREATE INDEX IF NOT EXISTS idx_aa_target ON admin_actions (target_type, target_id);
