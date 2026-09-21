# Phase 26: In-Call Text Chat, File Sharing, and Message Persistence

## Overview
Phase 26 equips StreamWave's real-time video call rooms (`ONE_TO_ONE` and `GROUP`) with full in-call communication and collaboration features:
* Real-time text messaging alongside video mesh calling.
* Chat message persistence in MySQL with pagination and chronological sorting.
* Soft-deletion of messages (sender or room host).
* Threaded replies with parent message context.
* Real-time typing indicators (`room:typing-start`, `room:typing-stop`).
* Read/seen receipts per message (`call_message_reads`, `room:message-read`).
* Secure in-call file sharing with strict upload validation, unguessable storage naming, extension whitelisting, and dangerous file blocking.
* Authenticated streaming downloads (`GET /api/call-rooms/:roomCode/files/:fileId`) with static shield protection on `/uploads/call-files/` (HTTP 403 Forbidden).
* File deletion by uploader or room host with cascading message soft deletion.
* Responsive split-view layout for desktop and slide-over overlay drawer for mobile, with unread badge counter.

---

## 1. Database Architecture

### `call_shared_files`
Stores metadata and disk storage references for files uploaded and shared during a call room session.
```sql
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
    deleted_at DATETIME NULL,
    CONSTRAINT fk_call_files_room
        FOREIGN KEY (room_id)
        REFERENCES call_rooms(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_call_files_uploader
        FOREIGN KEY (uploader_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_call_files_room (room_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### `call_messages`
Stores text messages and file share announcements with support for threaded replies and soft deletion.
```sql
CREATE TABLE IF NOT EXISTS call_messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT UNSIGNED NOT NULL,
    sender_id BIGINT UNSIGNED NOT NULL,
    message_type ENUM('TEXT', 'FILE') NOT NULL DEFAULT 'TEXT',
    message_text TEXT NULL,
    file_id BIGINT UNSIGNED NULL,
    reply_to_message_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL,
    deleted_at DATETIME NULL,
    CONSTRAINT fk_call_messages_room
        FOREIGN KEY (room_id)
        REFERENCES call_rooms(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_call_messages_sender
        FOREIGN KEY (sender_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_call_messages_file
        FOREIGN KEY (file_id)
        REFERENCES call_shared_files(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_call_messages_reply
        FOREIGN KEY (reply_to_message_id)
        REFERENCES call_messages(id)
        ON DELETE SET NULL,
    INDEX idx_call_messages_room (room_id, created_at),
    INDEX idx_call_messages_sender (sender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### `call_message_reads`
Tracks message read timestamps per participant for read receipt tracking.
```sql
CREATE TABLE IF NOT EXISTS call_message_reads (
    message_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id),
    CONSTRAINT fk_call_reads_message
        FOREIGN KEY (message_id)
        REFERENCES call_messages(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_call_reads_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 2. REST API Endpoints

All endpoints require JWT authentication (`Authorization: Bearer <token>`) and verify that the requesting user is an active participant (`status = 'JOINED'`) in an unended call room (`status != 'ENDED'`) who is not blocked (`call_room_blocks`).

| Method | Path | Description | Access | Rate Limit |
|---|---|---|---|---|
| `GET` | `/api/call-rooms/:roomCode/messages` | Paginated message history (`?page=1&limit=50`) | Room Participant | None |
| `POST` | `/api/call-rooms/:roomCode/messages` | Send in-call text message | Room Participant | 30 req / 10s |
| `DELETE` | `/api/call-rooms/:roomCode/messages/:messageId` | Soft delete message | Sender or Host | None |
| `POST` | `/api/call-rooms/:roomCode/messages/:messageId/read` | Mark message as read | Room Participant | None |
| `POST` | `/api/call-rooms/:roomCode/files` | Upload & share file in call (multipart) | Room Participant | 30 req / 60s |
| `GET` | `/api/call-rooms/:roomCode/files/:fileId` | Authenticated binary file download stream | Room Participant | None |
| `DELETE` | `/api/call-rooms/:roomCode/files/:fileId` | Soft delete shared file | Uploader or Host | None |

---

## 3. Real-Time Socket.IO Events

All chat events are scoped to `room:<roomCode>` and require valid room membership:

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `room:chat-message` | Server -> Room | `{ roomCode, message }` | Broadcast new text message or file share |
| `room:chat-message-deleted` | Server -> Room | `{ roomCode, messageId, deletedBy, isHost, timestamp }` | Broadcast soft-deletion of a message |
| `room:file-shared` | Server -> Room | `{ roomCode, file, message }` | Broadcast metadata for a newly shared file |
| `room:file-deleted` | Server -> Room | `{ roomCode, fileId, deletedBy, isHost, timestamp }` | Broadcast deletion of a shared file |
| `room:typing-start` | Client -> Server -> Room | `{ roomCode, userId, username, displayName, timestamp }` | Typing indicator started |
| `room:typing-stop` | Client -> Server -> Room | `{ roomCode, userId, timestamp }` | Typing indicator stopped |
| `room:message-read` | Client/Server -> Room | `{ roomCode, messageId, userId, readAt }` | Broadcast read status update |

---

## 4. File Sharing Security & Restrictions

1. **Size Limit**: Enforced 25 MB max limit (`MAX_CALL_FILE_SIZE_MB=25`). Uploads exceeding 25 MB are rejected with HTTP 413.
2. **Whitelisted Extensions**: `.pdf`, `.docx`, `.doc`, `.xlsx`, `.xls`, `.pptx`, `.ppt`, `.txt`, `.csv`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.zip`, `.rar`, `.7z`.
3. **Blocked Dangerous Extensions**: `.exe`, `.bat`, `.cmd`, `.scr`, `.ps1`, `.sh`, `.vbs`, `.msi`, `.jar`, `.com`, `.pif`, `.dll`, `.bin`, `.php`, `.py`, `.rb`, `.pl`. Double extensions (e.g. `report.pdf.exe`) are explicitly scanned and blocked.
4. **Storage Obfuscation**: Uploaded files are saved to `backend/uploads/call-files/` using 16-byte cryptographically secure random hexadecimal names (`crypto.randomBytes(16)-timestamp.ext`), preventing direct directory guessing and collision attacks. Original file names are stored only in database metadata.
5. **Static Shield**: Direct HTTP requests to `/uploads/call-files/*` are intercepted by an Express middleware before `express.static` and blocked with HTTP 403 Forbidden. Files can only be downloaded via the authenticated endpoint `GET /api/call-rooms/:roomCode/files/:fileId`.

---

## 5. Frontend UI/UX Features

1. **Desktop Split View**: On screens `>= 1024px`, the video grid and chat panel sit side-by-side without overlapping or occluding WebRTC video tiles.
2. **Mobile Drawer**: On screens `< 1024px`, clicking the Chat toggle opens an overlay drawer sliding from the right.
3. **Unread Counter**: An unread badge displays over the Chat button in the header and bottom control bar when messages arrive while the chat panel is closed.
4. **Threaded Replies**: Users can reply to previous messages with parent context quoted.
5. **Soft Delete**: Senders and room hosts can delete messages and shared files, displaying a muted italicized `"This message was deleted"` notice.
6. **File Cards & Previews**: Shared files display size, extension icon, image preview (for images), and download action button.
7. **Typing Indicators**: Displays real-time typing indicators with 2.5-second debounce.
