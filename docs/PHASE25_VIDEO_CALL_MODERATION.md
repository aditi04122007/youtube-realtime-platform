# Phase 25: Video-Call Moderation & Safety Controls Documentation

## Overview
Phase 25 extends StreamWave's real-time video call rooms (Phases 23 & 24) by introducing an enterprise-grade moderation, safety, and abuse prevention layer. It gives room hosts complete authority to mute participants, disable cameras, eject participants, and permanently block disruptive users, while empowering all call participants to confidentially report abusive behavior.

All moderation actions are strictly authorized on the server side using database membership records and persistent audit logs.

---

## 1. Database Architecture

### `call_moderation_actions`
Stores chronological audit logs for all moderation decisions and reports made across video call rooms.

```sql
CREATE TABLE IF NOT EXISTS call_moderation_actions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  moderator_id BIGINT UNSIGNED NOT NULL,
  target_user_id BIGINT UNSIGNED NULL,
  action_type ENUM(
    'MUTE',
    'UNMUTE',
    'CAMERA_DISABLE',
    'CAMERA_ENABLE',
    'REMOVE',
    'BLOCK_REJOIN',
    'UNBLOCK_REJOIN',
    'REPORT',
    'END_ROOM'
  ) NOT NULL,
  reason VARCHAR(500) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_moderation_room FOREIGN KEY (room_id) REFERENCES call_rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_moderation_moderator FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_moderation_target FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_moderation_room (room_id, created_at),
  INDEX idx_moderation_target (target_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### `call_room_blocks`
Enforces persistent bans preventing blocked participants from rejoining a call room.

```sql
CREATE TABLE IF NOT EXISTS call_room_blocks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  blocked_by BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_room_blocks_room FOREIGN KEY (room_id) REFERENCES call_rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_room_blocks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_room_blocks_admin FOREIGN KEY (blocked_by) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_room_block (room_id, user_id),
  INDEX idx_room_blocks_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Alterations to `call_room_participants`
- `server_muted`: `BOOLEAN NOT NULL DEFAULT FALSE` (indicates whether user is muted by host)
- `server_camera_disabled`: `BOOLEAN NOT NULL DEFAULT FALSE` (indicates whether user camera is disabled by host)

---

## 2. Server-Side Security & Authorization Rules

1. **Never Trust Client Claims**:
   The caller's role is never accepted from `req.body` or query strings. It is strictly queried from `call_room_participants` (`role = 'HOST'`) and verified against `call_rooms.created_by`. Non-hosts attempting moderation receive `HTTP 403 Forbidden`.
2. **Host Protection**:
   The room host cannot be muted, camera-disabled, removed, or blocked (`HTTP 400 Bad Request: "Host cannot be muted, removed, or blocked."`).
3. **Rejoin Enforcement**:
   When a user attempts `POST /api/call-rooms/:roomCode/join` or connects to Socket room signaling, the server verifies:
   - `call_room_blocks` table for existing blocks.
   - `call_room_participants.status = 'REMOVED'` for kicks.
   Violations return `HTTP 403 Forbidden` with `"You are not allowed to rejoin this room."`.
4. **Host Transference**:
   If a host leaves a room, host permissions automatically transfer to the next oldest active participant in the room. The newly elevated host immediately inherits full moderation authority.
5. **Strict Report Confidentiality**:
   Participant reports are logged in `call_moderation_actions` with action `'REPORT'`. Private confirmation (`room:report-created`) is returned exclusively to the reporter. Report contents and reporter identity are **never** broadcast to the room or to the reported user.

---

## 3. REST API Endpoints

All endpoints require verified JWT authentication (`Authorization: Bearer <token>`).

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/call-rooms/:roomCode/participants/:targetUserId/mute` | Mute participant mic | Host only |
| `POST` | `/api/call-rooms/:roomCode/participants/:targetUserId/unmute` | Unmute participant mic | Host only |
| `POST` | `/api/call-rooms/:roomCode/participants/:targetUserId/camera-disable` | Turn off participant camera | Host only |
| `POST` | `/api/call-rooms/:roomCode/participants/:targetUserId/camera-enable` | Allow participant camera | Host only |
| `POST` | `/api/call-rooms/:roomCode/participants/:targetUserId/remove` | Eject participant from call | Host only |
| `POST` | `/api/call-rooms/:roomCode/participants/:targetUserId/block` | Ban participant from rejoining | Host only |
| `POST` | `/api/call-rooms/:roomCode/participants/:targetUserId/unblock` | Unban participant | Host only |
| `GET`  | `/api/call-rooms/:roomCode/moderation` | Fetch room audit history & active bans | Host only |
| `POST` | `/api/call-rooms/:roomCode/report` | Report another participant | Active room members |

*Note: Action-style paths (`/api/call-rooms/:roomCode/moderate/:action`) are also supported.*

---

## 4. Socket.IO Moderation Signals

The server emits real-time events over Socket.IO to coordinate client-side state changes across all participants:

- `room:moderation-mute`: Disables the target's microphone track and locks the control. Emits `{ roomCode, moderatorId, targetUserId, reason }`.
- `room:moderation-unmute`: Clears the server mute lock on the target client and notifies them that they may enable their mic.
- `room:moderation-camera-disable`: Disables the target's camera track, renders placeholder, and locks camera control. Emits `{ roomCode, moderatorId, targetUserId, reason }`.
- `room:moderation-camera-enable`: Clears the camera lock on the target client.
- `room:participant-removed`: Notifies the target user of ejection reason, triggers WebRTC cleanup, disconnects socket, and routes to `/`. Emits to peers to remove WebRTC connection.
- `room:participant-blocked`: Notifies the target user of ban reason, triggers WebRTC cleanup, disconnects socket, and routes to `/`.
- `room:participant-unblocked`: Emitted when host removes ban.

---

## 5. Frontend Components

- `frontend/src/services/callModerationService.js`: API client for all Phase 25 moderation and report operations.
- `frontend/src/components/callRooms/ParticipantMenu.jsx`: Accessible 3-dots dropdown menu attached to each participant tile and drawer item with context-sensitive options (Host gets Mute/Camera/Remove/Block; Participants get Report).
- `frontend/src/components/callRooms/ModerationActionModal.jsx`: Reusable confirmation modal for destructive and media enforcement actions with curated reason picker.
- `frontend/src/components/callRooms/ReportModal.jsx`: Confidential reporting dialog with controlled category select and privacy guarantee.
- `frontend/src/components/callRooms/ModerationHistoryModal.jsx`: Host-exclusive audit log viewer with searchable history tab and active bans tab with one-click unblock action.
- `frontend/src/components/callRooms/RoomRulesModal.jsx`: Interactive room safety guidelines modal.
- `frontend/src/components/callRooms/ParticipantTile.jsx`: Enhanced with `Host Muted` and `Camera Disabled by Host` badges, control state locking, and participant action trigger.
- `frontend/src/components/callRooms/ParticipantDrawer.jsx`: Enhanced with participant menu integration, host moderation logs access, and safety rules access.
- `frontend/src/pages/CallRoomPage.jsx`: Active room controller integrating real-time moderation sockets, lock state management, and exit handling.

---

## 6. Automated Testing Verification

The test suite in `scratch/test_phase25.js` exercises all Phase 25 specifications:
- **79 passed, 0 failed** in `test_phase25.js`.
- **55 passed, 0 failed** in Phase 24 regression (`test_phase24.js`).
- **56 passed, 0 failed** in Phase 23 regression (`test_phase23.js`).
- **48 passed, 0 failed** in Phase 22 regression (`test_phase22.js`).
- **54 passed, 0 failed** in Phase 21 regression (`test_phase21.js`).
- **57 passed, 0 failed** in Phase 20 regression (`test_phase20.js`).
- **0 errors** in frontend production build (`npm run build`).
