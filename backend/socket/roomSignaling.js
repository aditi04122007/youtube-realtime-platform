const { pool } = require('../config/db');

// Lazy getter for callRoomService to prevent circular dependencies
const getCallRoomService = () => require('../services/callRoomService');

// In-memory registry of active screen sharers: roomCode -> { userId, username, displayName, hasAudio, startedAt }
const activeScreenSharersByRoom = new Map();

// In-memory registry of temporary disconnection grace timers: `${roomCode}:${userId}` -> timerId
const reconnectionGraceTimers = new Map();

/**
 * Cancel a pending disconnection grace timer for a user in a room
 * @param {string} roomCode
 * @param {number|string} userId
 */
const cancelGraceTimer = (roomCode, userId) => {
  if (!roomCode || !userId) return false;
  const key = `${roomCode.trim().toUpperCase()}:${userId}`;
  if (reconnectionGraceTimers.has(key)) {
    clearTimeout(reconnectionGraceTimers.get(key));
    reconnectionGraceTimers.delete(key);
    return true;
  }
  return false;
};

/**
 * Check if a grace timer is active for a user in a room
 * @param {string} roomCode
 * @param {number|string} userId
 */
const hasGraceTimer = (roomCode, userId) => {
  if (!roomCode || !userId) return false;
  const key = `${roomCode.trim().toUpperCase()}:${userId}`;
  return reconnectionGraceTimers.has(key);
};

/**
 * Retrieve active screen sharer for a room
 * @param {string} roomCode
 */
const getActiveScreenSharer = (roomCode) => {
  if (!roomCode) return null;
  return activeScreenSharersByRoom.get(roomCode.trim().toUpperCase()) || null;
};

/**
 * Clear active screen sharer for a room and optionally broadcast
 * @param {string} roomCode
 * @param {number} [userId]
 * @param {object} [io]
 */
const clearActiveScreenSharer = (roomCode, userId = null, io = null) => {
  if (!roomCode) return false;
  const normalized = roomCode.trim().toUpperCase();
  const current = activeScreenSharersByRoom.get(normalized);
  if (current && (!userId || current.userId === Number(userId))) {
    activeScreenSharersByRoom.delete(normalized);
    const targetIo = io || require('./socketServer').getIO();
    if (targetIo) {
      targetIo.to(`room:${normalized}`).emit('room:screen-share-stopped', {
        roomCode: normalized,
        userId: current.userId,
        timestamp: new Date().toISOString(),
      });
    }
    return true;
  }
  return false;
};

/**
 * Register Call Room (Group / Mesh) WebRTC signaling event handlers
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
const registerRoomSignaling = (socket, io) => {
  const userId = socket.user?.id;
  if (!userId) return;

  // Per-socket event rate limiter to prevent flooding/DoS (Phase 30, Requirement 61)
  const eventTimestamps = new Map();
  const checkSocketRateLimit = (eventName, maxPerMinute = 60) => {
    const now = Date.now();
    const timestamps = eventTimestamps.get(eventName) || [];
    const recent = timestamps.filter((t) => now - t < 60000);
    if (recent.length >= maxPerMinute) {
      return false; // Rate limit exceeded
    }
    recent.push(now);
    eventTimestamps.set(eventName, recent);
    return true;
  };

  /**
   * Helper to verify if socket user is an authorized active participant in a room
   * @param {string} roomCode
   * @returns {Promise<{ authorized: boolean, room: object|null, participant: object|null }>}
   */
  const verifyRoomMembership = async (roomCode) => {
    if (!roomCode || typeof roomCode !== 'string') return { authorized: false, room: null, participant: null };

    const normalizedCode = roomCode.trim().toUpperCase();
    const [rows] = await pool.query(
      `SELECT cr.id, cr.room_code, cr.status, cr.created_by,
              crp.role, crp.status AS participant_status
       FROM call_rooms cr
       JOIN call_room_participants crp ON cr.id = crp.room_id
       WHERE cr.room_code = ? AND crp.user_id = ? AND crp.status = 'JOINED'
       LIMIT 1`,
      [normalizedCode, userId]
    );

    if (rows.length === 0) return { authorized: false, room: null, participant: null };

    const r = rows[0];

    // Check if user is blocked from this room (Phase 25)
    const [blockRows] = await pool.query(
      `SELECT 1 FROM call_room_blocks WHERE room_id = ? AND user_id = ? LIMIT 1`,
      [r.id, userId]
    );
    if (blockRows.length > 0) return { authorized: false, room: null, participant: null };

    return {
      authorized: true,
      room: { id: r.id, roomCode: r.room_code, status: r.status, createdBy: r.created_by },
      participant: { role: r.role, status: r.participant_status },
    };
  };

  /**
   * 1. Join Socket.IO Room: 'room:<roomCode>'
   */
  socket.on('room:join', async (data, callback) => {
    try {
      if (!checkSocketRateLimit('room:join', 30)) {
        const errMsg = 'Too many join requests. Please slow down.';
        if (typeof callback === 'function') callback({ success: false, message: errMsg });
        socket.emit('room:error', { message: errMsg });
        return;
      }

      const roomCode = data?.roomCode;
      const { authorized, room, participant } = await verifyRoomMembership(roomCode);

      if (!authorized || !room || room.status === 'ENDED') {
        const errMsg = 'Not authorized to join this room or room has ended.';
        if (typeof callback === 'function') callback({ success: false, message: errMsg });
        socket.emit('room:error', { roomCode, message: errMsg });
        socket.emit('error', { message: errMsg });
        return;
      }

      const socketRoomName = `room:${room.roomCode}`;
      socket.join(socketRoomName);
      socket.activeRoomCode = room.roomCode;

      // Clear any pending reconnection grace timer for this user
      const graceKey = `${room.roomCode}:${userId}`;
      const wasReconnecting = reconnectionGraceTimers.has(graceKey);
      if (wasReconnecting) {
        clearTimeout(reconnectionGraceTimers.get(graceKey));
        reconnectionGraceTimers.delete(graceKey);
        // Broadcast to existing room members that user has successfully reconnected
        socket.to(socketRoomName).emit('room:participant-reconnected', {
          roomCode: room.roomCode,
          userId,
          timestamp: new Date().toISOString(),
        });
      }

      // Fetch user display info
      const [userRows] = await pool.query(
        `SELECT u.id, u.username, up.display_name, up.avatar_url
         FROM users u
         LEFT JOIN user_profiles up ON u.id = up.user_id
         WHERE u.id = ? LIMIT 1`,
        [userId]
      );
      const userInfo = userRows[0] || {};
      const participantPayload = {
        userId,
        name: userInfo.display_name || userInfo.username || `User ${userId}`,
        username: userInfo.username,
        avatarUrl: userInfo.avatar_url || null,
        role: participant.role,
      };

      // Fetch all active participants in this room
      const [allParticipants] = await pool.query(
        `SELECT crp.user_id, crp.role, crp.status, crp.joined_at,
                crp.server_muted, crp.server_camera_disabled,
                u.username, up.display_name, up.avatar_url
         FROM call_room_participants crp
         JOIN users u ON crp.user_id = u.id
         LEFT JOIN user_profiles up ON u.id = up.user_id
         WHERE crp.room_id = ? AND crp.status = 'JOINED'`,
        [room.id]
      );

      const participantsList = allParticipants.map((r) => ({
        userId: r.user_id,
        name: r.display_name || r.username || `User ${r.user_id}`,
        username: r.username,
        avatarUrl: r.avatar_url || null,
        role: r.role,
        serverMuted: Boolean(r.server_muted),
        serverCameraDisabled: Boolean(r.server_camera_disabled),
      }));

      const currentScreenSharer = activeScreenSharersByRoom.get(room.roomCode) || null;

      if (typeof callback === 'function') {
        callback({
          success: true,
          roomCode: room.roomCode,
          role: participant.role,
          participants: participantsList,
          activeScreenSharer: currentScreenSharer,
          wasReconnecting,
        });
      }

      socket.emit('room:joined', {
        roomCode: room.roomCode,
        role: participant.role,
        participants: participantsList,
        activeScreenSharer: currentScreenSharer,
        wasReconnecting,
      });

      // If not reconnecting, notify room members that a new participant joined
      if (!wasReconnecting) {
        socket.to(socketRoomName).emit('room:participant-joined', {
          roomCode: room.roomCode,
          userId: participantPayload.userId,
          name: participantPayload.name,
          username: participantPayload.username,
          role: participantPayload.role,
          avatarUrl: participantPayload.avatarUrl,
          participant: participantPayload,
        });
      }
    } catch (err) {
      console.error('[RoomSignaling] Error on room:join:', err.message);
      if (typeof callback === 'function') callback({ success: false, message: err.message });
    }
  });

  /**
   * 1b. Synchronize Room State (Phase 28 Reconnection)
   */
  socket.on('room:sync', async (data, callback) => {
    try {
      if (!checkSocketRateLimit('room:sync', 60)) {
        const errMsg = 'Too many sync requests. Please slow down.';
        if (typeof callback === 'function') callback({ success: false, message: errMsg });
        return;
      }
      const roomCode = data?.roomCode || socket.activeRoomCode;
      const { authorized, room, participant } = await verifyRoomMembership(roomCode);

      if (!authorized || !room || room.status === 'ENDED') {
        const errMsg = 'Room not available or user is not an active participant.';
        if (typeof callback === 'function') callback({ success: false, message: errMsg });
        return;
      }

      const socketRoomName = `room:${room.roomCode}`;
      socket.join(socketRoomName);
      socket.activeRoomCode = room.roomCode;

      // Clear any pending grace timer
      const graceKey = `${room.roomCode}:${userId}`;
      const wasReconnecting = reconnectionGraceTimers.has(graceKey);
      if (wasReconnecting) {
        clearTimeout(reconnectionGraceTimers.get(graceKey));
        reconnectionGraceTimers.delete(graceKey);
        socket.to(socketRoomName).emit('room:participant-reconnected', {
          roomCode: room.roomCode,
          userId,
          timestamp: new Date().toISOString(),
        });
      }

      // Fetch all active participants
      const [allParticipants] = await pool.query(
        `SELECT crp.user_id, crp.role, crp.status, crp.joined_at,
                crp.server_muted, crp.server_camera_disabled,
                u.username, up.display_name, up.avatar_url
         FROM call_room_participants crp
         JOIN users u ON crp.user_id = u.id
         LEFT JOIN user_profiles up ON u.id = up.user_id
         WHERE crp.room_id = ? AND crp.status = 'JOINED'`,
        [room.id]
      );

      const participantsList = allParticipants.map((r) => ({
        userId: r.user_id,
        name: r.display_name || r.username || `User ${r.user_id}`,
        username: r.username,
        avatarUrl: r.avatar_url || null,
        role: r.role,
        serverMuted: Boolean(r.server_muted),
        serverCameraDisabled: Boolean(r.server_camera_disabled),
      }));

      const currentScreenSharer = activeScreenSharersByRoom.get(room.roomCode) || null;

      const hostId = room.createdBy || room.host_id || null;

      if (typeof callback === 'function') {
        callback({
          success: true,
          roomCode: room.roomCode,
          roomStatus: room.status,
          hostId,
          host: { id: hostId },
          room: {
            id: room.id,
            roomCode: room.roomCode,
            hostId,
            status: room.status,
          },
          role: participant.role,
          isHost: participant.role === 'HOST',
          participants: participantsList,
          activeScreenSharer: currentScreenSharer,
          timestamp: new Date().toISOString(),
          userModerationState: {
            audioMutedByHost: Boolean(participant.server_muted),
            cameraDisabledByHost: Boolean(participant.server_camera_disabled),
          },
        });
      }
    } catch (err) {
      console.error('[RoomSignaling] Error on room:sync:', err.message);
      if (typeof callback === 'function') callback({ success: false, message: err.message });
    }
  });

  /**
   * 2. Leave Room via Socket
   */
  socket.on('room:leave', async (data, callback) => {
    try {
      const roomCode = data?.roomCode || socket.activeRoomCode;
      if (!roomCode) return;

      const normalizedCode = roomCode.trim().toUpperCase();
      const socketRoomName = `room:${normalizedCode}`;

      const leaveResult = await getCallRoomService().leaveRoom({
        roomCode: normalizedCode,
        userId,
      });

      cancelGraceTimer(normalizedCode, userId);
      socket.leave(socketRoomName);
      delete socket.activeRoomCode;

      // Clear active screen sharer if leaving user was sharing
      clearActiveScreenSharer(normalizedCode, userId, io);

      // Notify room members that user left
      socket.to(socketRoomName).emit('room:participant-left', {
        roomCode: normalizedCode,
        userId,
      });

      if (leaveResult.hostTransferred && leaveResult.newHostId) {
        io.to(socketRoomName).emit('room:host-changed', {
          roomCode: normalizedCode,
          newHostId: leaveResult.newHostId,
        });
      }

      if (leaveResult.roomEnded) {
        io.to(socketRoomName).emit('room:ended', {
          roomCode: normalizedCode,
          reason: 'all_left',
        });
      }

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      console.error('[RoomSignaling] Error on room:leave:', err.message);
      if (typeof callback === 'function') callback({ success: false, message: err.message });
    }
  });

  /**
   * 3. End Room (Host Only) via Socket
   */
  socket.on('room:end', async (data, callback) => {
    try {
      const roomCode = data?.roomCode || socket.activeRoomCode;
      if (!roomCode) return;

      const normalizedCode = roomCode.trim().toUpperCase();
      const socketRoomName = `room:${normalizedCode}`;

      cancelGraceTimer(normalizedCode, userId);

      await getCallRoomService().endRoom({
        roomCode: normalizedCode,
        userId,
      });

      io.to(socketRoomName).emit('room:ended', {
        roomCode: normalizedCode,
        endedBy: userId,
      });

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      console.error('[RoomSignaling] Error on room:end:', err.message);
      if (typeof callback === 'function') callback({ success: false, message: err.message });
    }
  });

  /**
   * 4. Media State Toggles (Audio / Video)
   */
  socket.on('room:audio-state', async (data) => {
    try {
      const { roomCode, enabled } = data || {};
      const { authorized, room } = await verifyRoomMembership(roomCode);
      if (!authorized || !room) return;

      socket.to(`room:${room.roomCode}`).emit('room:audio-state', {
        roomCode: room.roomCode,
        userId,
        enabled: Boolean(enabled),
      });
    } catch (err) {
      console.error('[RoomSignaling] Error on room:audio-state:', err.message);
    }
  });

  socket.on('room:video-state', async (data) => {
    try {
      const { roomCode, enabled } = data || {};
      const { authorized, room } = await verifyRoomMembership(roomCode);
      if (!authorized || !room) return;

      socket.to(`room:${room.roomCode}`).emit('room:video-state', {
        roomCode: room.roomCode,
        userId,
        enabled: Boolean(enabled),
      });
    } catch (err) {
      console.error('[RoomSignaling] Error on room:video-state:', err.message);
    }
  });

  /**
   * 5. Mesh WebRTC Signaling: room:offer
   */
  socket.on('room:offer', async (data) => {
    try {
      if (!checkSocketRateLimit('room:offer', 300)) return;
      const { roomCode, targetUserId, sdp, iceRestart } = data || {};
      if (!roomCode || !targetUserId || !sdp) return;

      const { authorized, room } = await verifyRoomMembership(roomCode);
      if (!authorized || !room) {
        socket.emit('room:error', { roomCode, message: 'Unauthorized signaling action' });
        return;
      }

      // Relay strictly to the target user's private socket room
      const targetRoom = `user:${targetUserId}`;
      socket.to(targetRoom).emit('room:offer', {
        roomCode: room.roomCode,
        senderId: userId,
        senderUserId: userId,
        targetUserId,
        sdp,
        iceRestart: Boolean(iceRestart),
      });
    } catch (err) {
      console.error('[RoomSignaling] Error on room:offer:', err.message);
    }
  });

  /**
   * 6. Mesh WebRTC Signaling: room:answer
   */
  socket.on('room:answer', async (data) => {
    try {
      if (!checkSocketRateLimit('room:answer', 300)) return;
      const { roomCode, targetUserId, sdp } = data || {};
      if (!roomCode || !targetUserId || !sdp) return;

      const { authorized, room } = await verifyRoomMembership(roomCode);
      if (!authorized || !room) {
        socket.emit('room:error', { roomCode, message: 'Unauthorized signaling action' });
        return;
      }

      const targetRoom = `user:${targetUserId}`;
      socket.to(targetRoom).emit('room:answer', {
        roomCode: room.roomCode,
        senderId: userId,
        senderUserId: userId,
        targetUserId,
        sdp,
      });
    } catch (err) {
      console.error('[RoomSignaling] Error on room:answer:', err.message);
    }
  });

  /**
   * 7. Mesh WebRTC Signaling: room:ice-candidate
   */
  socket.on('room:ice-candidate', async (data) => {
    try {
      if (!checkSocketRateLimit('room:ice-candidate', 600)) return;
      const { roomCode, targetUserId, candidate } = data || {};
      if (!roomCode || !targetUserId || !candidate) return;

      const { authorized, room } = await verifyRoomMembership(roomCode);
      if (!authorized || !room) {
        socket.emit('room:error', { roomCode, message: 'Unauthorized signaling action' });
        return;
      }

      const targetRoom = `user:${targetUserId}`;
      socket.to(targetRoom).emit('room:ice-candidate', {
        roomCode: room.roomCode,
        senderId: userId,
        senderUserId: userId,
        targetUserId,
        candidate,
      });
    } catch (err) {
      console.error('[RoomSignaling] Error on room:ice-candidate:', err.message);
    }
  });

  /**
   * 8. In-Call Chat: Typing indicators & read status
   */
  socket.on('room:typing-start', async (data) => {
    try {
      if (!checkSocketRateLimit('room:typing-start', 60)) return;
      const roomCode = data?.roomCode;
      if (!roomCode) return;
      const { authorized, room } = await verifyRoomMembership(roomCode);
      if (!authorized || !room) return;

      const [userRows] = await pool.query(
        `SELECT u.id, u.username, up.display_name
         FROM users u
         LEFT JOIN user_profiles up ON u.id = up.user_id
         WHERE u.id = ? LIMIT 1`,
        [userId]
      );
      const userInfo = userRows[0] || {};

      socket.to(`room:${room.roomCode}`).emit('room:typing-start', {
        roomCode: room.roomCode,
        userId,
        username: userInfo.username,
        displayName: userInfo.display_name || userInfo.username || `User ${userId}`,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('[RoomSignaling] Error on room:typing-start:', err.message);
    }
  });

  socket.on('room:typing-stop', async (data) => {
    try {
      if (!checkSocketRateLimit('room:typing-stop', 60)) return;
      const roomCode = data?.roomCode;
      if (!roomCode) return;
      const { authorized, room } = await verifyRoomMembership(roomCode);
      if (!authorized || !room) return;

      socket.to(`room:${room.roomCode}`).emit('room:typing-stop', {
        roomCode: room.roomCode,
        userId,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('[RoomSignaling] Error on room:typing-stop:', err.message);
    }
  });

  socket.on('room:message-read', async (data) => {
    try {
      if (!checkSocketRateLimit('room:message-read', 120)) return;
      const { roomCode, messageId } = data || {};
      if (!roomCode || !messageId) return;
      const { authorized, room } = await verifyRoomMembership(roomCode);
      if (!authorized || !room) return;

      await pool.query(
        `INSERT INTO call_message_reads (message_id, user_id, read_at)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE read_at = NOW()`,
        [messageId, userId]
      );

      socket.to(`room:${room.roomCode}`).emit('room:message-read', {
        roomCode: room.roomCode,
        messageId,
        userId,
        readAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[RoomSignaling] Error on room:message-read:', err.message);
    }
  });

  /**
   * 9. Phase 27 Screen Sharing Signaling
   */
  socket.on('room:screen-share-started', async (data, callback) => {
    try {
      const roomCode = data?.roomCode;
      if (!roomCode) {
        if (typeof callback === 'function') callback({ success: false, message: 'Room code is required' });
        return;
      }

      const { authorized, room } = await verifyRoomMembership(roomCode);
      if (!authorized || !room || room.status === 'ENDED') {
        const errMsg = 'Not authorized to share screen in this room';
        if (typeof callback === 'function') callback({ success: false, message: errMsg });
        socket.emit('room:error', { roomCode, message: errMsg });
        return;
      }

      const existingSharer = activeScreenSharersByRoom.get(room.roomCode);
      if (existingSharer && existingSharer.userId !== userId) {
        const errMsg = `${existingSharer.displayName || 'Another participant'} is currently sharing their screen. Please wait until screen sharing ends.`;
        if (typeof callback === 'function') callback({ success: false, message: errMsg });
        socket.emit('room:error', { roomCode: room.roomCode, message: errMsg });
        return;
      }

      // Fetch user profile info
      const [userRows] = await pool.query(
        `SELECT u.username, up.display_name
         FROM users u
         LEFT JOIN user_profiles up ON u.id = up.user_id
         WHERE u.id = ? LIMIT 1`,
        [userId]
      );
      const userInfo = userRows[0] || {};
      const displayName = userInfo.display_name || userInfo.username || `User ${userId}`;

      const sharerInfo = {
        userId,
        username: userInfo.username,
        displayName,
        hasAudio: Boolean(data?.hasAudio),
        startedAt: new Date().toISOString(),
      };

      activeScreenSharersByRoom.set(room.roomCode, sharerInfo);

      const socketRoomName = `room:${room.roomCode}`;
      io.to(socketRoomName).emit('room:screen-share-started', {
        roomCode: room.roomCode,
        ...sharerInfo,
      });

      if (typeof callback === 'function') {
        callback({ success: true, activeScreenSharer: sharerInfo });
      }
    } catch (err) {
      console.error('[RoomSignaling] Error on room:screen-share-started:', err.message);
      if (typeof callback === 'function') callback({ success: false, message: err.message });
    }
  });

  socket.on('room:screen-share-stopped', async (data, callback) => {
    try {
      const roomCode = data?.roomCode;
      if (!roomCode) return;

      const { authorized, room } = await verifyRoomMembership(roomCode);
      if (!authorized || !room) return;

      const existingSharer = activeScreenSharersByRoom.get(room.roomCode);
      if (existingSharer && existingSharer.userId === userId) {
        activeScreenSharersByRoom.delete(room.roomCode);
        const socketRoomName = `room:${room.roomCode}`;
        io.to(socketRoomName).emit('room:screen-share-stopped', {
          roomCode: room.roomCode,
          userId,
          timestamp: new Date().toISOString(),
        });
      }

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (err) {
      console.error('[RoomSignaling] Error on room:screen-share-stopped:', err.message);
    }
  });

  /**
   * 10. Disconnect Cleanup
   */
  socket.on('disconnect', async () => {
    try {
      if (socket.activeRoomCode) {
        const roomCode = socket.activeRoomCode;
        delete socket.activeRoomCode;

        console.log(`[RoomSignaling] User ${userId} disconnected from room ${roomCode}. Starting reconnection grace period.`);

        // Clear active screen sharer if disconnected user was sharing
        clearActiveScreenSharer(roomCode, userId, io);

        const graceKey = `${roomCode}:${userId}`;
        if (reconnectionGraceTimers.has(graceKey)) {
          clearTimeout(reconnectionGraceTimers.get(graceKey));
          reconnectionGraceTimers.delete(graceKey);
        }

        const GRACE_PERIOD_MS = 25000;
        const socketRoomName = `room:${roomCode}`;

        // Notify room members that participant is temporarily reconnecting
        io.to(socketRoomName).emit('room:participant-reconnecting', {
          roomCode,
          userId,
          timeoutSeconds: Math.round(GRACE_PERIOD_MS / 1000),
          timestamp: new Date().toISOString(),
        });

        // Start grace countdown timer
        const timer = setTimeout(async () => {
          reconnectionGraceTimers.delete(graceKey);
          try {
            console.log(`[RoomSignaling] Grace period expired for user ${userId} in room ${roomCode}. Executing permanent leave.`);
            const leaveResult = await getCallRoomService().leaveRoom({
              roomCode,
              userId,
            }).catch(() => null);

            if (leaveResult) {
              io.to(socketRoomName).emit('room:participant-left', {
                roomCode,
                userId,
                reason: 'timeout',
              });

              if (leaveResult.hostTransferred && leaveResult.newHostId) {
                io.to(socketRoomName).emit('room:host-changed', {
                  roomCode,
                  newHostId: leaveResult.newHostId,
                });
              }

              if (leaveResult.roomEnded) {
                io.to(socketRoomName).emit('room:ended', {
                  roomCode,
                  reason: 'all_left',
                });
              }
            }
          } catch (tErr) {
            console.error('[RoomSignaling] Error on grace timer expiration:', tErr.message);
          }
        }, GRACE_PERIOD_MS);

        reconnectionGraceTimers.set(graceKey, timer);
      }
    } catch (err) {
      console.error('[RoomSignaling] Disconnect error:', err.message);
    }
  });
};

module.exports = {
  registerRoomSignaling,
  getActiveScreenSharer,
  clearActiveScreenSharer,
  cancelGraceTimer,
  hasGraceTimer,
};
