# Phase 20 — Download History & Monthly Download Quota System

## Overview
Phase 20 introduces an enterprise-grade download history and monthly quota tracking system for StreamWave. The system tracks all user download activity, enforces monthly download limits based on subscription plans, handles concurrency-safe quota consumption, deduplicates rapid or chunked requests, and provides user-facing history management with soft deletion.

---

## 1. Database Architecture

### `download_history` Table Schema
Extended from Phase 19/20 migrations (`database/migrations/phase20_download_history.sql`):
```sql
CREATE TABLE IF NOT EXISTS download_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  video_id BIGINT NOT NULL,
  download_id BIGINT NULL,
  status ENUM('STARTED', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'STARTED',
  file_name VARCHAR(255) NULL,
  file_size BIGINT NULL,
  mime_type VARCHAR(100) NULL,
  downloaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  failure_reason VARCHAR(255) NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY (download_id) REFERENCES downloads(id) ON DELETE SET NULL,
  INDEX idx_dh_user_downloaded (user_id, downloaded_at),
  INDEX idx_dh_user_status_downloaded (user_id, status, downloaded_at),
  INDEX idx_dh_video_id (video_id),
  INDEX idx_dh_download_id (download_id),
  INDEX idx_dh_user_is_deleted (user_id, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 2. Quota Rules & Source of Truth

- **Authoritative Quota Limits**: Derived strictly from `subscription_plans.download_limit`:
  - **FREE**: 0 downloads (denied with `403 DOWNLOADS_NOT_INCLUDED` or `403 QUOTA_EXHAUSTED`).
  - **BRONZE**: 20 downloads / monthly billing period.
  - **SILVER**: 100 downloads / monthly billing period.
  - **GOLD**: Unlimited downloads (`unlimited: true`, `download_limit = NULL` or flagged VIP).
- **Billing Period Calculation**:
  - Period start is derived from active subscription `start_date` anchored to the current monthly billing cycle (with a 10s clock skew buffer).
  - Period end is `DATE_ADD(period_start, INTERVAL 1 MONTH)`.
- **Pre-Streaming Safety**: Quota is consumed ONLY after download permissions, subscription validity, and physical file existence are verified, immediately as the media stream opens. Pre-streaming failures (missing file, 404, bad permissions) consume ZERO quota.
- **Creator Bypass**: Video owners downloading their own videos do NOT consume monthly download quota.

---

## 3. Concurrency Safety & Deduplication

### Atomic Quota Consumption
- Implemented in `backend/services/downloadQuotaService.js:reserveDownloadQuota`.
- Acquires an exclusive row lock on active subscription and quota records using `SELECT ... FOR UPDATE` inside a MySQL transaction with `ISOLATION LEVEL READ COMMITTED`.
- Verifies `used < limit` while holding the lock. If remaining quota is 0, rolls back and returns `canDownload: false, reason: 'QUOTA_EXHAUSTED'`.
- When two simultaneous download requests arrive with remaining quota = 1, one executes and consumes the final unit (200 OK), while the other is rejected with `403 QUOTA_EXHAUSTED`.

### Rapid Duplicate Deduplication
- Requests for the same video within 15 seconds by the same user with `status IN ('STARTED', 'COMPLETED')` are treated as session continuation and do not double-charge quota.

### HTTP Range Request Chunk Continuation
- Partial content requests with `start > 0` (HTTP Range headers `bytes=start-end`) detect chunk streaming and do not increment download usage.

---

## 4. Soft Deletion & Quota Preservation

- **User-Facing Soft Delete**: `DELETE /api/download-history/:id` sets `is_deleted = 1` and `deleted_at = NOW()`.
- **IDOR Protection**: Verifies `user_id = req.user.id`. Requests targeting another user's history record are blocked with `403 Forbidden`.
- **Quota Preservation**: Quota usage calculations in `getDownloadUsage()` count all non-failed downloads within the period regardless of `is_deleted`. Deleting an item from the history list removes it from view but does **not** refund the consumed monthly download quota.

---

## 5. REST API Specification

### `GET /api/download-history/quota`
Returns current user download quota and usage metrics.
- **Auth Required**: Yes (`Bearer <token>`)
- **Rate Limit**: 120 req/min
- **Response**:
```json
{
  "success": true,
  "data": {
    "planCode": "BRONZE",
    "planName": "Bronze Creator",
    "limit": 20,
    "used": 6,
    "remaining": 14,
    "unlimited": false,
    "periodStart": "2026-09-01T00:00:00.000Z",
    "periodEnd": "2026-10-01T00:00:00.000Z"
  }
}
```

### `GET /api/download-history`
Returns paginated list of non-deleted downloads for the authenticated user.
- **Auth Required**: Yes (`Bearer <token>`)
- **Query Params**: `page` (default 1), `limit` (default 20, max 50)
- **Rate Limit**: 60 req/min
- **Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "status": "COMPLETED",
      "fileName": "Video-Title.mp4",
      "fileSize": 4194304,
      "mimeType": "video/mp4",
      "downloadedAt": "2026-09-17T15:20:00.000Z",
      "completedAt": "2026-09-17T15:20:02.000Z",
      "video": {
        "id": 45,
        "title": "Video Title",
        "thumbnailUrl": "/uploads/thumbnails/sample.jpg",
        "duration": 180,
        "channel": {
          "id": 2,
          "name": "Channel Name",
          "avatar": "/uploads/avatars/sample.jpg"
        }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 6,
    "totalPages": 1
  }
}
```

### `GET /api/download-history/summary`
Returns download activity summary for the user.
- **Auth Required**: Yes (`Bearer <token>`)
- **Response**:
```json
{
  "success": true,
  "data": {
    "totalDownloads": 6,
    "completedDownloads": 6,
    "failedDownloads": 0,
    "currentPeriodDownloads": 6,
    "quota": { ... }
  }
}
```

### `DELETE /api/download-history/:id`
Soft-deletes a single download history record.
- **Auth Required**: Yes (`Bearer <token>`)
- **Rate Limit**: 30 req/min
- **Response**:
```json
{
  "success": true,
  "message": "Download history item removed successfully"
}
```

---

## 6. Frontend Components

1. **Watch Page `<DownloadButton />`**:
   - Shows live quota remaining text beneath button (`Downloads remaining: 15 / 20` or `Unlimited downloads`).
   - Automatically refreshes quota after download completes.
   - When quota is exhausted, clicking triggers a Quota Exhausted modal with a direct CTA to upgrade plans on `/subscription-dashboard`.

2. **Download History Page (`/download-history` & `/downloads`)**:
   - Responsive Quota Summary Card with animated progress bar, used/remaining counters, and reset date.
   - History table with thumbnail preview, video title, channel, file size, status badges, and download timestamps.
   - Per-item delete action with confirmation modal and toast notification.
   - Pagination controls and empty state with "Browse Videos" link.
   - Full dark mode support matching StreamWave YouTube design system.

3. **Sidebar Navigation**:
   - Includes "Downloads" navigation link with Lucide `Download` icon under Library section.

4. **Subscription Dashboard (`UsageCard.jsx`)**:
   - Connected live offline download quota meter showing real downloads used and remaining.

---

## 7. Verification Results
Automated test suite (`scratch/test_phase20.js`):
- **57 tests executed, 57 passed, 0 failed**.
- Concurrency race condition test verified: 2 concurrent requests with 1 quota unit remaining resulted in exactly 1 HTTP 200 and 1 HTTP 403.
- Range request deduplication verified: Multiple chunks resulted in 1 quota unit consumed.
- Soft delete verified: History item excluded from API responses, quota remains consumed.
