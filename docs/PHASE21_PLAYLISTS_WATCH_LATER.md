# Phase 21 — Playlists & Watch Later

## Overview
Phase 21 introduces a comprehensive **Playlists** and **Watch Later** system for StreamWave. The system enables users to create, view, update, delete, and reorder video collections with privacy controls (`PRIVATE`, `UNLISTED`, `PUBLIC`), enforces subscription-based playlist creation limits (`subscription_plans.max_playlists`), integrates with Phase 18 video access rules and Phase 10 watch history progress, and provides a dedicated Watch Later queue with duplicate protection.

---

## 1. Database Architecture

### `playlists` Table
```sql
CREATE TABLE playlists (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  name VARCHAR(255) NULL,
  description TEXT NULL,
  visibility ENUM('PRIVATE', 'UNLISTED', 'PUBLIC') NOT NULL DEFAULT 'PRIVATE',
  thumbnail_url VARCHAR(500) NULL,
  video_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_playlists_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_playlists_user (user_id),
  INDEX idx_playlists_visibility (visibility),
  INDEX idx_playlists_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### `playlist_videos` Table
```sql
CREATE TABLE playlist_videos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  playlist_id BIGINT UNSIGNED NOT NULL,
  video_id BIGINT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_playlist_videos_playlist FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  CONSTRAINT fk_playlist_videos_video FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  UNIQUE KEY uq_playlist_video (playlist_id, video_id),
  INDEX idx_playlist_videos_playlist_position (playlist_id, position),
  INDEX idx_playlist_videos_video (video_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### `watch_later` Table
```sql
CREATE TABLE watch_later (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  video_id BIGINT UNSIGNED NOT NULL,
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_watch_later_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_watch_later_video FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  UNIQUE KEY uq_watch_later_user_video (user_id, video_id),
  INDEX idx_watch_later_user_date (user_id, added_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 2. Subscription-Based Playlist Limits

Playlist limits are dynamically determined from `subscription_plans.max_playlists`:
- **FREE**: 10 playlists max
- **BRONZE**: 50 playlists max
- **SILVER**: 200 playlists max
- **GOLD**: Unlimited playlists (`max_playlists = 0`)

When a user on a limited tier attempts to create an additional playlist once their quota is exhausted:
- Server responds with HTTP 403 Forbidden:
```json
{
  "success": false,
  "code": "PLAYLIST_LIMIT_REACHED",
  "message": "You have reached the playlist limit for your current plan.",
  "limit": 10,
  "used": 10
}
```
- The frontend displays an upgrade banner linking to `/subscription-dashboard`.

---

## 3. Video Access Security in Playlists

Playlists **never** bypass video access rules:
- **Private Videos**: Unauthorized viewers cannot see private video metadata or stream private media. For the playlist owner, a safe placeholder (`[Private Video]`) is shown to preserve ordering without breaking the playlist layout.
- **Premium Videos**: Videos requiring higher subscription tiers (e.g. BRONZE, SILVER, GOLD) display tier badges and `canWatch: false` to ineligible viewers. Protected stream URLs are never returned in playlist payloads.
- **Deleted Videos**: Videos with status `DELETED` are excluded from all playlist queries.

---

## 4. REST API Specification

### Playlists API

| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/playlists` | Yes | Create a new playlist (checks plan limit). |
| `GET` | `/api/playlists` | Yes | Get authenticated user's playlists (paginated, max 50). |
| `GET` | `/api/playlists/:id` | Optional | Get playlist details & ordered videos (guest allowed for PUBLIC/UNLISTED). |
| `PUT` | `/api/playlists/:id` | Yes | Update playlist name, description, or visibility (owner only). |
| `DELETE` | `/api/playlists/:id` | Yes | Delete playlist (owner only; cascades to `playlist_videos`). |
| `POST` | `/api/playlists/:id/videos` | Yes | Add video to playlist (`position` computed, `video_count` incremented). |
| `DELETE` | `/api/playlists/:id/videos/:videoId` | Yes | Remove video from playlist (positions re-normalized). |
| `PUT` | `/api/playlists/:id/reorder` | Yes | Reorder videos transactionally via ordered `videoIds` array. |
| `GET` | `/api/playlists/check-video/:videoId` | Yes | Check which user playlists contain a given video. |

### Watch Later API

| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/watch-later` | Yes | Get user's Watch Later queue (newest first, paginated). |
| `GET` | `/api/watch-later/check/:videoId` | Yes | Check if a video is in user's Watch Later queue. |
| `POST` | `/api/watch-later/:videoId` | Yes | Add video to Watch Later (duplicate safe). |
| `DELETE` | `/api/watch-later/:videoId` | Yes | Remove video from Watch Later. |

---

## 5. Frontend Features

1. **Watch Page (`Watch.jsx` & `VideoMetadata.jsx`)**:
   - **Save to Playlist Button**: Opens `SaveToPlaylistModal` showing all user playlists with checkboxes indicating video presence, plus inline "Create new playlist" form.
   - **Watch Later Button**: Toggle button with live state checking and optimistic feedback.
2. **Video Cards (`VideoCard.jsx`)**:
   - Hover overlay button on thumbnail allowing quick addition to Watch Later.
3. **Playlists Page (`Playlists.jsx`)**:
   - Grid of playlist cards showing thumbnail preview, video count badge, privacy icons (Lock, Link2, Globe), updated date, and edit/delete actions.
   - "New Playlist" modal with plan limit error handling.
4. **Playlist Detail Page (`PlaylistDetail.jsx`)**:
   - Artwork panel with playlist title, description, visibility, creator info, "Play All" CTA, share button, and edit/delete buttons.
   - Ordered video list with position numbers, thumbnails, durations, channel details, Phase 10 watch progress bar, and owner reordering (`Move Up` / `Move Down`) and removal controls.
5. **Watch Later Page (`WatchLater.jsx`)**:
   - List of saved videos with duration, channel, added date, watch progress bar, "Play All", and quick remove button.
6. **Navigation Integration**:
   - Sidebar links to `/playlists` and `/watch-later`.

---

## 6. Verification Results

Automated test suite (`scratch/test_phase21.js`):
- **54 tests executed, 54 passed, 0 failed**.
- Full regression suites (Phase 16, 17, 18, 19, 20): **All passed**.
- Frontend production build (`npm run build`): **0 errors**.
