const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const config = require('../config');
const { emitToRoom } = require('../socket/socketServer');
const { sanitizeText } = require('../utils/sanitizer');

/**
 * Helper to verify that a user is an active participant in an active call room
 * @param {string} roomCode
 * @param {number} userId
 * @returns {Promise<{ room: object, participant: object }>}
 */
const verifyRoomParticipant = async (roomCode, userId) => {
  if (!roomCode || typeof roomCode !== 'string') {
    const err = new Error('Room code is required');
    err.statusCode = 400;
    throw err;
  }

  const normalizedCode = roomCode.trim().toUpperCase();
  const parsedUserId = parseInt(userId, 10);
  if (isNaN(parsedUserId)) {
    const err = new Error('Invalid user ID');
    err.statusCode = 400;
    throw err;
  }

  // 1. Check room and participant status
  const [rows] = await pool.query(
    `SELECT cr.id, cr.room_code, cr.status AS room_status, cr.created_by,
            crp.role, crp.status AS participant_status
     FROM call_rooms cr
     LEFT JOIN call_room_participants crp ON cr.id = crp.room_id AND crp.user_id = ?
     WHERE cr.room_code = ?
     LIMIT 1`,
    [parsedUserId, normalizedCode]
  );

  if (rows.length === 0) {
    const err = new Error('Call room not found');
    err.statusCode = 404;
    throw err;
  }

  const r = rows[0];

  if (r.room_status === 'ENDED') {
    const err = new Error('This call room has ended');
    err.statusCode = 400;
    throw err;
  }

  if (!r.participant_status || r.participant_status !== 'JOINED') {
    const err = new Error('You must be an active participant in this room to perform this action');
    err.statusCode = 403;
    throw err;
  }

  // 2. Check if user is blocked from this room
  const [blockRows] = await pool.query(
    `SELECT 1 FROM call_room_blocks WHERE room_id = ? AND user_id = ? LIMIT 1`,
    [r.id, parsedUserId]
  );

  if (blockRows.length > 0) {
    const err = new Error('You have been blocked from this call room');
    err.statusCode = 403;
    throw err;
  }

  return {
    room: {
      id: r.id,
      roomCode: r.room_code,
      status: r.room_status,
      createdBy: r.created_by,
    },
    participant: {
      role: r.role,
      status: r.participant_status,
    },
  };
};

/**
 * Format a raw database message row into a client-safe response object
 */
const formatMessage = (row, replyRow = null, fileRow = null, readUserIds = []) => {
  const isDeleted = !!row.deleted_at;

  let fileData = null;
  if (fileRow && !isDeleted) {
    fileData = {
      id: fileRow.id,
      originalName: fileRow.original_name,
      mimeType: fileRow.mime_type,
      fileSize: Number(fileRow.file_size),
      downloadUrl: `/api/call-rooms/${row.room_code}/files/${fileRow.id}`,
      createdAt: fileRow.created_at,
      isImage: typeof fileRow.mime_type === 'string' && fileRow.mime_type.startsWith('image/'),
    };
  }

  let replyData = null;
  if (replyRow) {
    replyData = {
      id: replyRow.id,
      senderId: replyRow.sender_id,
      senderName: replyRow.display_name || replyRow.username || `User ${replyRow.sender_id}`,
      messageType: replyRow.message_type,
      text: replyRow.deleted_at ? 'This message was deleted' : replyRow.message_text,
      isDeleted: !!replyRow.deleted_at,
    };
  }

  return {
    id: row.id,
    roomCode: row.room_code,
    senderId: row.sender_id,
    sender: {
      id: row.sender_id,
      username: row.sender_username,
      displayName: row.sender_display_name || row.sender_username || `User ${row.sender_id}`,
      avatarUrl: row.sender_avatar_url || null,
    },
    messageType: row.message_type,
    text: isDeleted ? 'This message was deleted' : row.message_text,
    isDeleted,
    deletedAt: row.deleted_at || null,
    file: fileData,
    replyTo: replyData,
    readBy: readUserIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at || null,
  };
};

/**
 * 1. Send In-Call Text Message
 * @param {object} params
 * @param {string} params.roomCode
 * @param {number} params.senderId
 * @param {string} params.text
 * @param {number} [params.replyToMessageId]
 */
const sendMessage = async ({ roomCode, senderId, text, replyToMessageId }) => {
  const { room } = await verifyRoomParticipant(roomCode, senderId);

  // Validate and sanitize text (Phase 30)
  if (!text || typeof text !== 'string' || !text.trim()) {
    const err = new Error('Message text cannot be empty');
    err.statusCode = 400;
    throw err;
  }

  const maxLength = config.callChat?.maxMessageLength || 2000;
  const trimmedText = text.trim();
  const sanitizedText = sanitizeText(trimmedText, maxLength);

  if (!sanitizedText) {
    const err = new Error('Message text cannot be empty');
    err.statusCode = 400;
    throw err;
  }

  if (trimmedText.length > maxLength) {
    const err = new Error(`Message exceeds maximum allowed length of ${maxLength} characters`);
    err.statusCode = 400;
    throw err;
  }

  // Validate replyToMessageId if provided
  let validReplyId = null;
  let replyRow = null;
  if (replyToMessageId) {
    const parsedReplyId = parseInt(replyToMessageId, 10);
    if (!isNaN(parsedReplyId)) {
      const [replyRows] = await pool.query(
        `SELECT cm.id, cm.sender_id, cm.message_type, cm.message_text, cm.deleted_at,
                u.username, up.display_name
         FROM call_messages cm
         JOIN users u ON cm.sender_id = u.id
         LEFT JOIN user_profiles up ON u.id = up.user_id
         WHERE cm.id = ? AND cm.room_id = ?
         LIMIT 1`,
        [parsedReplyId, room.id]
      );
      if (replyRows.length > 0) {
        validReplyId = parsedReplyId;
        replyRow = replyRows[0];
      }
    }
  }

  // Insert message
  const [insertResult] = await pool.query(
    `INSERT INTO call_messages (room_id, sender_id, message_type, message_text, reply_to_message_id, created_at)
     VALUES (?, ?, 'TEXT', ?, ?, NOW())`,
    [room.id, senderId, sanitizedText, validReplyId]
  );

  const messageId = insertResult.insertId;

  // Automatically mark as read by the sender
  await pool.query(
    `INSERT INTO call_message_reads (message_id, user_id, read_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE read_at = NOW()`,
    [messageId, senderId]
  );

  // Fetch created message with sender profile
  const [msgRows] = await pool.query(
    `SELECT cm.id, cm.room_id, cm.sender_id, cm.message_type, cm.message_text,
            cm.reply_to_message_id, cm.created_at, cm.updated_at, cm.deleted_at,
            cr.room_code,
            u.username AS sender_username, up.display_name AS sender_display_name, up.avatar_url AS sender_avatar_url
     FROM call_messages cm
     JOIN call_rooms cr ON cm.room_id = cr.id
     JOIN users u ON cm.sender_id = u.id
     LEFT JOIN user_profiles up ON u.id = up.user_id
     WHERE cm.id = ?
     LIMIT 1`,
    [messageId]
  );

  const formatted = formatMessage(msgRows[0], replyRow, null, [senderId]);

  // Real-time broadcast to room participants via Socket.IO
  emitToRoom(`room:${room.roomCode}`, 'room:chat-message', {
    roomCode: room.roomCode,
    message: formatted,
  });

  return formatted;
};

/**
 * 2. Get Messages with Pagination
 * @param {object} params
 * @param {string} params.roomCode
 * @param {number} params.userId
 * @param {number} [params.page=1]
 * @param {number} [params.limit=50]
 */
const getMessages = async ({ roomCode, userId, page = 1, limit = 50 }) => {
  const { room } = await verifyRoomParticipant(roomCode, userId);

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  // Count total messages
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM call_messages WHERE room_id = ?`,
    [room.id]
  );
  const total = countRows[0]?.total || 0;
  const totalPages = Math.ceil(total / limitNum) || 1;

  // Fetch paginated messages (order by created_at DESC for pagination, then reversed to display chronologically)
  const [rows] = await pool.query(
    `SELECT cm.id, cm.room_id, cm.sender_id, cm.message_type, cm.message_text,
            cm.file_id, cm.reply_to_message_id, cm.created_at, cm.updated_at, cm.deleted_at,
            cr.room_code,
            u.username AS sender_username, up.display_name AS sender_display_name, up.avatar_url AS sender_avatar_url,
            csf.original_name AS file_original_name, csf.mime_type AS file_mime_type,
            csf.file_size AS file_size, csf.created_at AS file_created_at,
            rm.sender_id AS reply_sender_id, rm.message_type AS reply_message_type,
            rm.message_text AS reply_message_text, rm.deleted_at AS reply_deleted_at,
            ru.username AS reply_username, rup.display_name AS reply_display_name
     FROM call_messages cm
     JOIN call_rooms cr ON cm.room_id = cr.id
     JOIN users u ON cm.sender_id = u.id
     LEFT JOIN user_profiles up ON u.id = up.user_id
     LEFT JOIN call_shared_files csf ON cm.file_id = csf.id
     LEFT JOIN call_messages rm ON cm.reply_to_message_id = rm.id
     LEFT JOIN users ru ON rm.sender_id = ru.id
     LEFT JOIN user_profiles rup ON ru.id = rup.user_id
     WHERE cm.room_id = ?
     ORDER BY cm.created_at DESC, cm.id DESC
     LIMIT ? OFFSET ?`,
    [room.id, limitNum, offset]
  );

  // Collect message IDs to fetch reads
  const messageIds = rows.map((r) => r.id);
  let readsByMessageId = {};

  if (messageIds.length > 0) {
    const [readRows] = await pool.query(
      `SELECT message_id, user_id FROM call_message_reads WHERE message_id IN (?)`,
      [messageIds]
    );
    for (const rr of readRows) {
      if (!readsByMessageId[rr.message_id]) {
        readsByMessageId[rr.message_id] = [];
      }
      readsByMessageId[rr.message_id].push(rr.user_id);
    }
  }

  // Format messages and sort chronologically (oldest to newest for the requested page slice)
  const formattedMessages = rows
    .map((r) => {
      let fileRow = null;
      if (r.file_id) {
        fileRow = {
          id: r.file_id,
          original_name: r.file_original_name,
          mime_type: r.file_mime_type,
          file_size: r.file_size,
          created_at: r.file_created_at,
        };
      }

      let replyRow = null;
      if (r.reply_to_message_id) {
        replyRow = {
          id: r.reply_to_message_id,
          sender_id: r.reply_sender_id,
          username: r.reply_username,
          display_name: r.reply_display_name,
          message_type: r.reply_message_type,
          message_text: r.reply_message_text,
          deleted_at: r.reply_deleted_at,
        };
      }

      const readUserIds = readsByMessageId[r.id] || [];
      return formatMessage(r, replyRow, fileRow, readUserIds);
    })
    .reverse();

  return {
    messages: formattedMessages,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      hasMore: pageNum < totalPages,
    },
  };
};

/**
 * 3. Soft Delete Message (Sender or Room Host)
 * @param {object} params
 * @param {string} params.roomCode
 * @param {number} params.userId
 * @param {number} params.messageId
 */
const deleteMessage = async ({ roomCode, userId, messageId }) => {
  const parsedMsgId = parseInt(messageId, 10);
  if (isNaN(parsedMsgId)) {
    const err = new Error('Invalid message ID');
    err.statusCode = 400;
    throw err;
  }

  const { room, participant } = await verifyRoomParticipant(roomCode, userId);

  const [msgRows] = await pool.query(
    `SELECT id, room_id, sender_id, file_id, deleted_at
     FROM call_messages
     WHERE id = ? AND room_id = ?
     LIMIT 1`,
    [parsedMsgId, room.id]
  );

  if (msgRows.length === 0) {
    const err = new Error('Message not found');
    err.statusCode = 404;
    throw err;
  }

  const msg = msgRows[0];

  // Check authorization: must be sender OR host
  const isSender = msg.sender_id === userId;
  const isHost = participant.role === 'HOST';

  if (!isSender && !isHost) {
    const err = new Error('You are not authorized to delete this message. Only the sender or room host can delete messages.');
    err.statusCode = 403;
    throw err;
  }

  if (msg.deleted_at) {
    return { success: true, messageId: parsedMsgId, deletedAt: msg.deleted_at };
  }

  const now = new Date();

  // Soft delete message
  await pool.query(
    `UPDATE call_messages SET deleted_at = ? WHERE id = ?`,
    [now, parsedMsgId]
  );

  // If message has an associated shared file, also soft delete the file record
  if (msg.file_id) {
    await pool.query(
      `UPDATE call_shared_files SET deleted_at = ? WHERE id = ?`,
      [now, msg.file_id]
    );

    // Emit file-deleted event
    emitToRoom(`room:${room.roomCode}`, 'room:file-deleted', {
      roomCode: room.roomCode,
      fileId: msg.file_id,
      deletedBy: userId,
      isHost,
      timestamp: now.toISOString(),
    });
  }

  // Real-time broadcast deletion to room
  emitToRoom(`room:${room.roomCode}`, 'room:chat-message-deleted', {
    roomCode: room.roomCode,
    messageId: parsedMsgId,
    deletedBy: userId,
    isHost,
    timestamp: now.toISOString(),
  });

  return {
    success: true,
    messageId: parsedMsgId,
    deletedAt: now,
  };
};

/**
 * 4. Upload and Share File in Call Room
 * @param {object} params
 * @param {string} params.roomCode
 * @param {number} params.uploaderId
 * @param {Express.Multer.File} params.file
 * @param {number} [params.replyToMessageId]
 */
const uploadFile = async ({ roomCode, uploaderId, file, replyToMessageId }) => {
  if (!file) {
    const err = new Error('No file provided');
    err.statusCode = 400;
    throw err;
  }

  let roomRecord = null;

  try {
    const { room } = await verifyRoomParticipant(roomCode, uploaderId);
    roomRecord = room;

    // Validate replyToMessageId if provided
    let validReplyId = null;
    let replyRow = null;
    if (replyToMessageId) {
      const parsedReplyId = parseInt(replyToMessageId, 10);
      if (!isNaN(parsedReplyId)) {
        const [replyRows] = await pool.query(
          `SELECT cm.id, cm.sender_id, cm.message_type, cm.message_text, cm.deleted_at,
                  u.username, up.display_name
           FROM call_messages cm
           JOIN users u ON cm.sender_id = u.id
           LEFT JOIN user_profiles up ON u.id = up.user_id
           WHERE cm.id = ? AND cm.room_id = ?
           LIMIT 1`,
          [parsedReplyId, room.id]
        );
        if (replyRows.length > 0) {
          validReplyId = parsedReplyId;
          replyRow = replyRows[0];
        }
      }
    }

    // Insert into call_shared_files
    const [fileInsertResult] = await pool.query(
      `INSERT INTO call_shared_files (room_id, uploader_id, original_name, stored_name, mime_type, file_size, storage_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        room.id,
        uploaderId,
        file.originalname,
        file.filename,
        file.mimetype || 'application/octet-stream',
        file.size,
        file.path,
      ]
    );

    const fileId = fileInsertResult.insertId;

    // Create corresponding FILE message in call_messages
    const [msgInsertResult] = await pool.query(
      `INSERT INTO call_messages (room_id, sender_id, message_type, message_text, file_id, reply_to_message_id, created_at)
       VALUES (?, ?, 'FILE', ?, ?, ?, NOW())`,
      [room.id, uploaderId, file.originalname, fileId, validReplyId]
    );

    const messageId = msgInsertResult.insertId;

    // Mark as read by uploader
    await pool.query(
      `INSERT INTO call_message_reads (message_id, user_id, read_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE read_at = NOW()`,
      [messageId, uploaderId]
    );

    // Fetch user profile info
    const [userRows] = await pool.query(
      `SELECT u.username, up.display_name, up.avatar_url
       FROM users u
       LEFT JOIN user_profiles up ON u.id = up.user_id
       WHERE u.id = ? LIMIT 1`,
      [uploaderId]
    );
    const userInfo = userRows[0] || {};

    const filePayload = {
      id: fileId,
      originalName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      fileSize: file.size,
      downloadUrl: `/api/call-rooms/${room.roomCode}/files/${fileId}`,
      createdAt: new Date(),
      isImage: typeof file.mimetype === 'string' && file.mimetype.startsWith('image/'),
    };

    const messagePayload = {
      id: messageId,
      roomCode: room.roomCode,
      senderId: uploaderId,
      sender: {
        id: uploaderId,
        username: userInfo.username,
        displayName: userInfo.display_name || userInfo.username || `User ${uploaderId}`,
        avatarUrl: userInfo.avatar_url || null,
      },
      messageType: 'FILE',
      text: file.originalname,
      isDeleted: false,
      deletedAt: null,
      file: filePayload,
      replyTo: replyRow ? {
        id: replyRow.id,
        senderId: replyRow.sender_id,
        senderName: replyRow.display_name || replyRow.username || `User ${replyRow.sender_id}`,
        messageType: replyRow.message_type,
        text: replyRow.deleted_at ? 'This message was deleted' : replyRow.message_text,
        isDeleted: !!replyRow.deleted_at,
      } : null,
      readBy: [uploaderId],
      createdAt: new Date(),
      updatedAt: null,
    };

    // Emit real-time events to room
    emitToRoom(`room:${room.roomCode}`, 'room:file-shared', {
      roomCode: room.roomCode,
      file: filePayload,
      message: messagePayload,
    });

    emitToRoom(`room:${room.roomCode}`, 'room:chat-message', {
      roomCode: room.roomCode,
      message: messagePayload,
    });

    return {
      message: messagePayload,
      file: filePayload,
    };
  } catch (err) {
    // If database persistence failed, remove the orphaned file from disk
    if (file && file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (cleanupErr) {
        console.error('[CallChatService] Failed to clean up disk file after error:', cleanupErr.message);
      }
    }
    throw err;
  }
};

/**
 * 5. Download Shared File
 * @param {object} params
 * @param {string} params.roomCode
 * @param {number} params.userId
 * @param {number} params.fileId
 * @param {import('express').Response} params.res
 */
const downloadFile = async ({ roomCode, userId, fileId, res }) => {
  const parsedFileId = parseInt(fileId, 10);
  if (isNaN(parsedFileId)) {
    const err = new Error('Invalid file ID');
    err.statusCode = 400;
    throw err;
  }

  const { room } = await verifyRoomParticipant(roomCode, userId);

  const [fileRows] = await pool.query(
    `SELECT id, room_id, uploader_id, original_name, stored_name, mime_type, file_size, storage_path, deleted_at
     FROM call_shared_files
     WHERE id = ? AND room_id = ?
     LIMIT 1`,
    [parsedFileId, room.id]
  );

  if (fileRows.length === 0) {
    const err = new Error('File not found');
    err.statusCode = 404;
    throw err;
  }

  const fileRecord = fileRows[0];

  if (fileRecord.deleted_at) {
    const err = new Error('This file has been deleted');
    err.statusCode = 410;
    throw err;
  }

  if (!fs.existsSync(fileRecord.storage_path)) {
    const err = new Error('File not found on storage server');
    err.statusCode = 404;
    throw err;
  }

  // Stream authenticated file download with original filename
  return res.download(fileRecord.storage_path, fileRecord.original_name);
};

/**
 * 6. Delete Shared File (Uploader or Room Host)
 * @param {object} params
 * @param {string} params.roomCode
 * @param {number} params.userId
 * @param {number} params.fileId
 */
const deleteFile = async ({ roomCode, userId, fileId }) => {
  const parsedFileId = parseInt(fileId, 10);
  if (isNaN(parsedFileId)) {
    const err = new Error('Invalid file ID');
    err.statusCode = 400;
    throw err;
  }

  const { room, participant } = await verifyRoomParticipant(roomCode, userId);

  const [fileRows] = await pool.query(
    `SELECT id, room_id, uploader_id, deleted_at
     FROM call_shared_files
     WHERE id = ? AND room_id = ?
     LIMIT 1`,
    [parsedFileId, room.id]
  );

  if (fileRows.length === 0) {
    const err = new Error('File not found');
    err.statusCode = 404;
    throw err;
  }

  const fileRecord = fileRows[0];

  const isUploader = fileRecord.uploader_id === userId;
  const isHost = participant.role === 'HOST';

  if (!isUploader && !isHost) {
    const err = new Error('You are not authorized to delete this file. Only the uploader or room host can delete files.');
    err.statusCode = 403;
    throw err;
  }

  if (fileRecord.deleted_at) {
    return { success: true, fileId: parsedFileId, deletedAt: fileRecord.deleted_at };
  }

  const now = new Date();

  // Soft delete file in DB
  await pool.query(
    `UPDATE call_shared_files SET deleted_at = ? WHERE id = ?`,
    [now, parsedFileId]
  );

  // Soft delete any message referencing this file
  await pool.query(
    `UPDATE call_messages SET deleted_at = ? WHERE file_id = ?`,
    [now, parsedFileId]
  );

  // Emit real-time events
  emitToRoom(`room:${room.roomCode}`, 'room:file-deleted', {
    roomCode: room.roomCode,
    fileId: parsedFileId,
    deletedBy: userId,
    isHost,
    timestamp: now.toISOString(),
  });

  // Find message ID for the file to emit chat-message-deleted
  const [msgRows] = await pool.query(
    `SELECT id FROM call_messages WHERE file_id = ? LIMIT 1`,
    [parsedFileId]
  );
  if (msgRows.length > 0) {
    emitToRoom(`room:${room.roomCode}`, 'room:chat-message-deleted', {
      roomCode: room.roomCode,
      messageId: msgRows[0].id,
      deletedBy: userId,
      isHost,
      timestamp: now.toISOString(),
    });
  }

  return {
    success: true,
    fileId: parsedFileId,
    deletedAt: now,
  };
};

/**
 * 7. Mark Message as Read
 * @param {object} params
 * @param {string} params.roomCode
 * @param {number} params.userId
 * @param {number} params.messageId
 */
const markMessageRead = async ({ roomCode, userId, messageId }) => {
  const parsedMsgId = parseInt(messageId, 10);
  if (isNaN(parsedMsgId)) {
    const err = new Error('Invalid message ID');
    err.statusCode = 400;
    throw err;
  }

  const { room } = await verifyRoomParticipant(roomCode, userId);

  const [msgRows] = await pool.query(
    `SELECT id FROM call_messages WHERE id = ? AND room_id = ? LIMIT 1`,
    [parsedMsgId, room.id]
  );

  if (msgRows.length === 0) {
    const err = new Error('Message not found');
    err.statusCode = 404;
    throw err;
  }

  await pool.query(
    `INSERT INTO call_message_reads (message_id, user_id, read_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE read_at = NOW()`,
    [parsedMsgId, userId]
  );

  const now = new Date();

  // Emit event to room
  emitToRoom(`room:${room.roomCode}`, 'room:message-read', {
    roomCode: room.roomCode,
    messageId: parsedMsgId,
    userId,
    readAt: now.toISOString(),
  });

  return {
    success: true,
    messageId: parsedMsgId,
    userId,
    readAt: now,
  };
};

module.exports = {
  verifyRoomParticipant,
  sendMessage,
  getMessages,
  deleteMessage,
  uploadFile,
  downloadFile,
  deleteFile,
  markMessageRead,
};
