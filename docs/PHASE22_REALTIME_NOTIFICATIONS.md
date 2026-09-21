# Phase 22 — Real-Time Notifications

## Overview
Phase 22 introduces a scalable, production-grade **Real-Time Notification System** for the StreamWave platform. The system uses a persistent MySQL database table (`notifications`) as the authoritative source of truth, complemented by a WebSocket real-time delivery layer powered by Socket.IO.

Notifications are generated across all core platform interactions (channel subscriptions, video uploads, comments, replies, video reactions, comment likes, and subscription plan updates), supporting isolated private user rooms (`user:<userId>`), 1-hour spam deduplication for likes, self-action suppression, unread count tracking, and offline delivery.

---

## 1. Database Architecture

### `notifications` Table
```sql
CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  type ENUM(
    'VIDEO_PUBLISHED',
    'NEW_SUBSCRIBER',
    'COMMENT_ON_VIDEO',
    'REPLY_TO_COMMENT',
    'COMMENT_LIKED',
    'VIDEO_LIKED',
    'SUBSCRIPTION_STARTED',
    'SUBSCRIPTION_CHANGED'
  ) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  entity_type VARCHAR(50) NULL,
  entity_id BIGINT UNSIGNED NULL,
  video_id BIGINT UNSIGNED NULL,
  comment_id BIGINT UNSIGNED NULL,
  channel_id BIGINT UNSIGNED NULL,
  data_json JSON NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_notifications_video FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_comment FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_channel FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  INDEX idx_notifications_user_created (user_id, created_at),
  INDEX idx_notifications_user_read (user_id, is_read),
  INDEX idx_notifications_actor (actor_user_id),
  INDEX idx_notifications_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 2. Notification Types & Trigger Rules

| Type | Recipient | Actor | Trigger Event | Deduplication / Rule |
| :--- | :--- | :--- | :--- | :--- |
| `VIDEO_PUBLISHED` | All channel subscribers | Video uploader | New video uploaded (`videoController.uploadVideo`) | Broadcast to active channel subscribers; self excluded |
| `NEW_SUBSCRIBER` | Channel owner | Subscriber user | Channel subscription (`channelController.subscribeToChannel`) | Self-subscribe forbidden; 1 notification per subscribe event |
| `COMMENT_ON_VIDEO` | Video owner | Commenter | Comment posted on video (`commentController.createComment`) | Self-comment suppressed (no notification if creator comments) |
| `REPLY_TO_COMMENT` | Parent comment author | Replier | Reply posted on comment (`commentController.createComment`) | Self-reply suppressed; recipient fetched transactionally |
| `VIDEO_LIKED` | Video owner | Liker | Video liked (`videoReactionController.setVideoReaction`) | 1-hour spam deduplication window per actor/video |
| `COMMENT_LIKED` | Comment author | Liker | Comment liked (`commentController.likeComment`) | 1-hour spam deduplication window per actor/comment |
| `SUBSCRIPTION_STARTED` | Subscriber | System / Gateway | Payment verified (`paymentService.verifyPayment`) | Triggered upon successful order activation |
| `SUBSCRIPTION_CHANGED` | Subscriber | User / Demo | Plan upgrade/downgrade (`subscriptionController.changeSubscription`) | Real-time plan status confirmation |

---

## 3. Real-Time Socket.IO Protocol

### Handshake Authentication
Client connections are authenticated via JWT in:
1. `socket.handshake.auth.token`
2. `socket.handshake.headers.authorization` (`Bearer <token>`)
3. HTTP-only cookie (`token`)

Unauthenticated or expired handshakes are immediately rejected with descriptive errors (`Authentication required: Missing token`, etc.).

### Room Management & Isolation
Upon connection, the socket joins a private room unique to the user:
```javascript
const userRoom = `user:${userId}`;
socket.join(userRoom);
```
All real-time events for a user are dispatched exclusively to `user:${userId}`, preventing cross-user data leakage.

### Events Emitted to Client
* `connected`: Confirms handshake and room assignment.
* `notification:new`: Emitted with complete notification object when a business event occurs.
* `notification:count`: Emitted with `{ unreadCount: number }` whenever unread count changes.

---

## 4. REST API Endpoints

All notification endpoints require JWT authentication (`Authorization: Bearer <token>`).

### 1. `GET /api/notifications`
Lists notifications for the authenticated user.
* **Query Parameters:**
  * `page` (integer, default `1`)
  * `limit` (integer, default `20`, max `50`)
  * `unreadOnly` (boolean, optional `true`/`false`)

### 2. `GET /api/notifications/unread-count`
Fast unread count query optimized with indexed lookups (`idx_notifications_user_read`).

### 3. `PUT /api/notifications/:id/read`
Marks a single notification as read. Enforces strict IDOR protection (`403 Forbidden` if notification belongs to another user).

### 4. `PUT /api/notifications/read-all`
Marks all unread notifications for the user as read. Emits real-time unread count update to socket.

### 5. `DELETE /api/notifications/:id`
Deletes a notification from MySQL. Enforces IDOR protection (`403 Forbidden` for non-owners).

### 6. Channel Subscription Endpoints
* `POST /api/channels/:id/subscribe`: Subscribe to channel and trigger `NEW_SUBSCRIBER` notification.
* `DELETE /api/channels/:id/subscribe`: Unsubscribe from channel.
* `GET /api/channels/:id/subscription-status`: Check current user's subscription status to channel.

---

## 5. Frontend Architecture

### Context & Socket Management
* `frontend/src/services/socket.js`: Manages singleton Socket.IO client, automatic reconnection, token handoff, and disconnect on logout.
* `frontend/src/context/NotificationContext.jsx`:
  * Listens for `notification:new` and `notification:count` events.
  * Plays subtle synthesized Web Audio API chime on new incoming alerts.
  * Displays auto-dismissing toast notifications with click-to-navigate.
  * Manages global `unreadCount` badge state.

### UI Components & Routes
* `NotificationBell.jsx`: Bell icon in navbar with badge pill counter and interactive dropdown showing recent notifications with quick "Mark Read" and direct links.
* `Notifications.jsx` (`/notifications`): Dedicated notification center with All/Unread filter tabs, pagination, Mark All Read button, and delete actions.
* `Sidebar.jsx`: Integrated Notifications navigation item displaying real-time unread badge.
* `VideoMetadata.jsx` & `Channel.jsx`: Live Subscribe / Unsubscribe buttons wired to channel subscription APIs.
