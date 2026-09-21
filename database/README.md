# Database Architecture & Preparation Guide

This directory contains planning, schema specifications, and future migration documentation for the **Video Platform** relational database.

> [!NOTE]
> **Phase 2 Status**: Completed. Full 31-table relational schema (`schema.sql`) and initial seed data (`seed.sql`) have been designed and implemented in MySQL 8+.

---

## Database Configuration

- **Engine**: MySQL 8.0+
- **Default Storage Engine**: `InnoDB`
- **Default Charset**: `utf8mb4`
- **Default Collation**: `utf8mb4_unicode_ci`
- **Database Name**: `video_platform`

---

## Executing Schema & Seed

To set up or re-initialize the database locally:

### 1. Create Database & Run Schema
```powershell
# In PowerShell (Windows):
Get-Content "database\schema.sql" | & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p
```
```bash
# In Linux / macOS / Git Bash:
mysql -u root -p < database/schema.sql
```

### 2. Run Seed Data
```powershell
# In PowerShell (Windows):
Get-Content "database\seed.sql" | & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p video_platform
```
```bash
# In Linux / macOS / Git Bash:
mysql -u root -p video_platform < database/seed.sql
```

---

## Implemented Schema (41 Production Tables)

The production database is organized into the following 7 domains:

### 1. Identity, Authentication & Security
- `users`: Core account identity, login credentials, global roles (`USER`, `ADMIN`), account status, email verification.
- `user_profiles`: Extended profile metadata (display name, biography, avatar URL, banner URL, location, website).
- `devices`: Device fingerprinting, trusted browser sessions, IP addresses, refresh tokens.
- `login_attempts`: Rate limiting, IP logging, and brute-force prevention tracking.
- `otp_codes`: Temporary one-time passwords for verification with TTL expiration.
- `security_events`: Detailed security audit trail (login anomalies, password changes, device registrations).

### 2. Channels & Content Management
- `channels`: Creator channels, unique handles, subscriber/video/view metrics.
- `video_categories`: Standard category taxonomy for browsing and recommendation.
- `videos`: Master video records, storage URLs, thumbnail, duration, visibility, status, engagement metrics, file size.
- `video_category_map`: Many-to-many relationship mapping videos to categories.
- `tags`: Video discovery tags with unique slugs.
- `video_tags`: Many-to-many relationship mapping videos to tags.
- `search_history`: User search queries for autocomplete and personalized discovery.

### 3. Engagement & Community
- `comments`: Threaded comments with self-referencing `parent_comment_id`, status, and metrics.
- `comment_likes`: Comment reactions with unique `(comment_id, user_id)`.
- `comment_translations`: Multilingual cached comment translations with SHA-256 content hashes.
- `video_reactions`: Video reactions (`LIKE`, `DISLIKE`) with unique `(video_id, user_id)`.
- `channel_subscriptions`: Channel subscriptions with unique `(subscriber_id, channel_id)`.
- `reports`: Community reporting on videos, comments, or users with moderation review status.

### 4. Monetization & Subscriptions
- `subscription_plans`: Creator tiers (`FREE`, `BRONZE`, `SILVER`, `GOLD`) with pricing and perks.
- `user_subscriptions`: User plan subscriptions with start/end dates and auto-renewal.
- `subscription_history`: Audit history of plan upgrades, downgrades, cancellations, and renewals.
- `payments`: Razorpay transaction logs, payment verification IDs, and status tracking.
- `video_access_rules`: Enforces minimum subscription plan requirements per premium video.

### 5. Playback & Playlists
- `watch_history`: Playback resume progress in seconds, completed flag, and timestamps.
- `playlists`: User-created video collections with custom visibility.
- `playlist_videos`: Ordered associative table mapping videos within playlists.
- `watch_later`: Dedicated user queue for saved videos.
- `downloads`: Download authorizations with temporary signed URLs.
- `download_history`: Audit trail for user download quotas and device limits.

### 6. Notifications & Real-Time Rooms
- `notifications`: User notification events with JSON metadata and read flags.
- `video_calls`: 1:1 real-time video call sessions and state lifecycle.
- `call_rooms`: WebRTC video calling rooms (`ONE_TO_ONE`, `GROUP`) with lifecycle status.
- `call_participants`: Legacy room session participants and peer IDs.
- `call_room_participants`: Multi-party WebRTC room memberships and roles (host, participant).
- `call_messages`: In-call chat messages and file attachment links.
- `call_message_reads`: Read receipts for in-call chat messages.
- `call_moderation_actions`: Host room moderation actions (mute, camera disable, kick, block).
- `call_room_blocks`: Active block list preventing removed participants from rejoining.
- `call_shared_files`: In-call shared files and secure download references.

### 7. Moderation & Auditing
- `admin_actions`: Comprehensive audit log of administrative actions, moderations, and plan changes.

---

## Connection Setup

The backend connects via the `mysql2/promise` connection pool using the following environment variables in `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=video_platform
```
