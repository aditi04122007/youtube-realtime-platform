# Phase 29: Admin Dashboard & Platform Moderation Console

## Overview

Phase 29 implements a comprehensive, enterprise-grade **Admin Dashboard & Management Console** for StreamWave. The console empowers authorized platform administrators to monitor, manage, and moderate:

* **Platform Metrics & Analytics**: Real-time database counts for users, channels, videos, comments, content reports, subscriptions, payments revenue, offline downloads, and active/ended video calls.
* **Time-Series Analytics**: Interactive, responsive SVG-based trend charts (`AdminAreaChart` and `AdminBarChart`) with hover tooltips and dynamic time periods (Today, 7D, 30D, 90D, Year). Zero external chart library bloat.
* **User Management**: Search, filter by role (`USER`, `CREATOR`, `ADMIN`) and status (`ACTIVE`, `SUSPENDED`, `BANNED`). Inspect profile metrics, registered device sessions, and moderation history. Actions: Suspend, Unsuspend, Ban, Change Role, and Force Revoke Sessions.
* **Admin Safety Guard**: Protects the platform from becoming unmanaged by strictly preventing banning, suspending, or demoting the last active administrator.
* **Channel Management**: Catalog of creator channels with subscriber numbers, video counts, total views, and actions to Suspend or Restore channels.
* **Video Content Moderation**: Comprehensive video list with filters for status (`PUBLISHED`, `HIDDEN`, `REMOVED`, `PROCESSING`, `DELETED`) and visibility (`PUBLIC`, `UNLISTED`, `PRIVATE`). Actions: Hide from public view, Restore to published, or Soft-Delete/Remove with audit logging.
* **Comment Moderation**: Review user comments across videos with status transitions (`VISIBLE`, `HIDDEN`, `REMOVED`) and automatic reply counter decrement handling.
* **Unified Reports Resolution Console**: Centralized report queue covering Comments, Videos, and Users. Filters for status (`PENDING`, `REVIEWING`, `RESOLVED`, `DISMISSED`) and target type. One-click resolution and dismissal with mandatory/optional audit notes.
* **Subscriptions & Payments Ledger**: Tier subscriber counts, pricing configuration, and payment transaction ledger (sanitized to prevent secret key leakage).
* **Downloads & Bandwidth Telemetry**: Offline download metrics, daily/monthly volume, total storage bytes consumed, and failure analysis.
* **Video Call Monitoring & Termination**: Real-time monitoring of WebRTC call rooms with live duration, active participant counts, and admin force-termination (emitting `room:ended` via Socket.IO).
* **Immutable Audit Trail (`admin_actions`)**: Append-only chronicle recording admin attribution, target, timestamp, reason, description, and IP address.
* **System Health & Runtime Diagnostics**: Database connection pool status, ping latency (ms), Node.js runtime version, host platform, server memory footprint, and process uptime.

---

## 1. Architectural Design

```text
                               ┌─────────────────────────────┐
                               │   React Frontend Routing    │
                               │  ProtectedRoute (adminOnly) │
                               └──────────────┬──────────────┘
                                              │
                         ┌────────────────────┴────────────────────┐
                         │              AdminLayout                │
                         │   AdminHeader  │  AdminSidebar (Nav)   │
                         └────────────────────┬────────────────────┘
                                              │
    ┌──────────────┬──────────────┬───────────┴──┬──────────────┬──────────────┐
    ▼              ▼              ▼              ▼              ▼              ▼
 Overview        Users        Channels        Videos         Reports      Payments
Analytics      Details/Ban     Suspend      Hide/Remove      Resolve       Ledger
    │              │              │              │              │              │
    └──────────────┴──────────────┼──────────────┴──────────────┴──────────────┘
                                  ▼
                     /api/admin/* (Axios Service)
                                  │
    ┌─────────────────────────────┴─────────────────────────────┐
    ▼                                                           ▼
authMiddleware                                            adminMiddleware
(Verify JWT + Session + Active)                           (Verify role === 'ADMIN')
    │                                                           │
    └─────────────────────────────┬─────────────────────────────┘
                                  ▼
                   adminController / adminService
                  (Parameterized Queries & Transactions)
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
   Core Tables              Reports Table             admin_actions
(users, videos, etc.)    (RESOLVED / DISMISSED)    (Immutable Audit Logs)
```

---

## 2. Database Schema Enhancements (`database/migrate_phase29.js`)

1. **`users.status`**: Expanded to include `'BANNED'`:
   ```sql
   ALTER TABLE users MODIFY COLUMN status ENUM('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED') NOT NULL DEFAULT 'ACTIVE';
   ```
2. **`users.role`**: Expanded to include `'CREATOR'`:
   ```sql
   ALTER TABLE users MODIFY COLUMN role ENUM('USER', 'CREATOR', 'ADMIN') NOT NULL DEFAULT 'USER';
   ```
3. **`channels.status`**: Added `status` column with index:
   ```sql
   ALTER TABLE channels ADD COLUMN IF NOT EXISTS status ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE';
   CREATE INDEX IF NOT EXISTS idx_channels_status ON channels (status);
   ```
4. **`videos.status`**: Expanded to include `'REMOVED'` and `'HIDDEN'`:
   ```sql
   ALTER TABLE videos MODIFY COLUMN status ENUM('PROCESSING', 'READY', 'PUBLISHED', 'FAILED', 'DELETED', 'REMOVED', 'HIDDEN') NOT NULL DEFAULT 'PROCESSING';
   ```
5. **`admin_actions`**: Composite index on `(target_type, target_id)` for rapid audit trail lookups.

---

## 3. Server-Side API Reference (`backend/routes/adminRoutes.js`)

All endpoints are strictly guarded by `authMiddleware` and `adminMiddleware`:

### Overview & Health
* `GET /api/admin/stats` — Platform counts & KPI summary (`period=today|7d|30d|90d|year`).
* `GET /api/admin/charts` — Time-series daily trend points for users, videos, revenue, and reports.
* `GET /api/admin/system` — Live DB ping latency, Node.js version, memory usage, and uptime.

### User Management
* `GET /api/admin/users` — Paginated user catalog (`search`, `role`, `status`, `sortBy`, `sortOrder`).
* `GET /api/admin/users/:userId` — Full profile inspection, channels, subscription, and registered sessions.
* `POST /api/admin/users/:userId/suspend` — Suspend account, revoke all device sessions, log audit event.
* `POST /api/admin/users/:userId/unsuspend` — Restore account to ACTIVE status.
* `POST /api/admin/users/:userId/ban` — Permanently ban user, revoke all sessions, block login.
* `PUT /api/admin/users/:userId/role` — Update role (`USER`, `CREATOR`, `ADMIN`) with last-admin safety guard.
* `POST /api/admin/users/:userId/revoke-sessions` — Revoke all device tokens for user.

### Channel Management
* `GET /api/admin/channels` — Searchable, paginated channel catalog with subscriber and view metrics.
* `POST /api/admin/channels/:channelId/suspend` — Suspend channel and log audit event.
* `POST /api/admin/channels/:channelId/restore` — Restore channel to ACTIVE.

### Video Moderation
* `GET /api/admin/videos` — Paginated video catalog (`search`, `status`, `visibility`, `categoryId`).
* `GET /api/admin/videos/:videoId` — Deep video inspection with channel, uploader, and active reports.
* `PUT /api/admin/videos/:videoId/status` — Set status (`PUBLISHED`, `HIDDEN`, `REMOVED`).
* `PUT /api/admin/videos/:videoId/visibility` — Set visibility (`PUBLIC`, `UNLISTED`, `PRIVATE`).

### Comment Moderation
* `GET /api/admin/comments` — Paginated comments with author, video, and report metrics.
* `PUT /api/admin/comments/:commentId/status` — Set comment status (`VISIBLE`, `HIDDEN`, `REMOVED`).

### Content Reports
* `GET /api/admin/unified-reports` — Unified reports queue across comments, videos, and users (`status`, `type`, `search`).
* `POST /api/admin/reports/:reportId/resolve` — Resolve report with mandatory/optional resolution note.
* `POST /api/admin/reports/:reportId/dismiss-unified` — Dismiss report with resolution note.
* *(Legacy comment moderation endpoints `/api/admin/reports/*` preserved for 100% backward compatibility)*.

### Subscriptions & Payments
* `GET /api/admin/subscriptions/plans` — Plan catalog with subscriber breakdown.
* `PUT /api/admin/subscriptions/plans/:planId` — Update plan limits, descriptions, or status.
* `GET /api/admin/subscriptions/stats` — Recurring revenue and active tier distribution.
* `GET /api/admin/subscriptions/users` — Paginated user subscription states.
* `GET /api/admin/payments` — Sanitized Razorpay transaction ledger.

### Downloads Telemetry
* `GET /api/admin/downloads/stats` — Download volumes, monthly bandwidth, storage bytes.
* `GET /api/admin/downloads` — Paginated download history with status and failure reasons.

### Video Calls Monitoring
* `GET /api/admin/calls` — Call rooms list (`search`, `status`, `roomType`) with duration and participants.
* `POST /api/admin/calls/:roomCode/end` — Force-terminate call room, broadcast `room:ended` via Socket.IO.

### Administrative Audit Trail
* `GET /api/admin/activity` — Immutable chronicle of all moderation events from `admin_actions`.

---

## 4. Frontend Component Hierarchy

```text
src/
├── layouts/
│   └── AdminLayout.jsx               # Dedicated Admin header + collapsible sidebar + mobile drawer
├── components/admin/
│   ├── AdminCharts.jsx               # SVG-based interactive Area and Bar charts with tooltips
│   └── AdminConfirmModal.jsx         # Action confirmation modal with audit log reason input
├── services/
│   └── adminService.js               # Centralized client for all /api/admin/* endpoints
└── pages/
    ├── AdminDashboard.jsx            # KPI cards, SVG trend charts, quick queue
    ├── AdminUsers.jsx                # User search, filter, details modal, suspend/ban/role actions
    ├── AdminChannels.jsx             # Channel directory & suspend/restore actions
    ├── AdminVideos.jsx               # Video moderation: hide, publish, remove, visibility
    ├── AdminComments.jsx             # Comment moderation: hide, show, remove
    ├── AdminReports.jsx              # Unified reports resolution dashboard
    ├── AdminDownloads.jsx            # Offline storage and download telemetry
    ├── AdminCalls.jsx                # Real-time WebRTC room monitoring and force termination
    ├── AdminActivity.jsx             # Administrative audit log viewer
    ├── AdminSettings.jsx             # Live system health diagnostics and policy overview
    ├── AdminSubscriptions.jsx        # Subscription plans & tiers (Phase 15)
    └── AdminPayments.jsx             # Razorpay payment ledger (Phase 16)
```

---

## 5. Verification & Test Results

### Dedicated Test Suite (`scratch/test_phase29.js`)
* **69 / 69 test assertions passed** (0 failures):
  * Admin authorization gate (401 without auth, 403 for non-admin, 200 for admin).
  * Dashboard stats with date range filters (`today`, `7d`, `30d`).
  * Time-series charts API and system diagnostics.
  * User search, inspection, session revocation, suspension, ban enforcement, role update, and admin safety guard.
  * Channel suspension and restoration.
  * Video hiding (403 for regular users), restoring (200), and removal (404 for regular users).
  * Comment hiding and removal.
  * Report resolution and dismissal with admin attribution.
  * Download telemetry and call room monitoring with admin force-end.
  * Immutable audit log persistence and attribution.

### Regression Test Suites
* `scratch/test_phase28.js`: **32 / 32 passed** (Reconnection & network recovery).
* `scratch/test_phase27.js`: **28 / 28 passed** (Screen sharing & device switching).
* `scratch/test_phase26.js`: **58 / 58 passed** (In-call chat & file sharing).
* `scratch/test_phase25.js`: **79 / 79 passed** (Video call moderation).
* `scratch/test_phase24.js`: **55 / 55 passed** (Call rooms).
* `scratch/test_phase23.js`: **56 / 56 passed** (1:1 video calling).

### Production Build
* `npm run build` in `frontend/`: Transformed 1,801 modules, bundled in 9.39s with 0 errors.
