const { pool } = require('../config/db');
const config = require('../config');
const { generateUniqueRoomCode } = require('../utils/roomCodeGenerator');
const { emitToUser } = require('../socket/socketServer');
const notificationService = require('./notificationService');

/**
 * Public profile helper to fetch user display name & avatar
 */
const getUserPublicProfile = async (userId) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.status,
            up.display_name, up.avatar_url
     FROM users u
     LEFT JOIN user_profiles up ON u.id = up.user_id
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    username: r.username,
    status: r.status,
    displayName: r.display_name || r.username,
    name: r.display_name || r.username,
    avatarUrl: r.avatar_url || null,
  };
};

/**
 * 1. Create a Call Room
 * @param {object} params
 * @param {number} params.userId - Authenticated user ID (becomes HOST)
 * @param {string} [params.roomType='ONE_TO_ONE'] - 'ONE_TO_ONE' | 'GROUP'
 * @param {number} [params.maxParticipants] - Max participant limit
 */
const createRoom = async ({ userId, roomType = 'ONE_TO_ONE', maxParticipants }) => {
  const parsedUserId = parseInt(userId, 10);
  if (isNaN(parsedUserId)) {
    const err = new Error('Invalid user ID');
    err.statusCode = 400;
    throw err;
  }

  // Validate room type
  if (roomType && !['ONE_TO_ONE', 'GROUP'].includes(roomType)) {
    const err = new Error("Invalid room type. Must be 'ONE_TO_ONE' or 'GROUP'.");
    err.statusCode = 400;
    throw err;
  }
  const normalizedType = roomType === 'GROUP' ? 'GROUP' : 'ONE_TO_ONE';

  // Configured room limit bounds
  const serverMaxGroup = config.callRooms?.maxGroupParticipants || 6;
  const serverMaxOneToOne = config.callRooms?.maxOneToOneParticipants || 2;

  let finalMax = normalizedType === 'GROUP' ? serverMaxGroup : serverMaxOneToOne;
  if (maxParticipants !== undefined && maxParticipants !== null) {
    const requestedMax = parseInt(maxParticipants, 10);
    if (!isNaN(requestedMax) && requestedMax >= 2) {
      if (normalizedType === 'GROUP') {
        // Clamp requested group limit between 2 and configured serverMaxGroup
        finalMax = Math.min(requestedMax, serverMaxGroup);
      } else {
        finalMax = Math.min(requestedMax, serverMaxOneToOne);
      }
    }
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Generate verified unique room code (e.g. ROOM-A8F4K2)
    const roomCode = await generateUniqueRoomCode(connection);

    // Insert call_room
    const [roomResult] = await connection.query(
      `INSERT INTO call_rooms (room_code, created_by, room_type, status, max_participants, created_at)
       VALUES (?, ?, ?, 'WAITING', ?, NOW())`,
      [roomCode, parsedUserId, normalizedType, finalMax]
    );
    const roomId = roomResult.insertId;

    // Add creator as HOST
    await connection.query(
      `INSERT INTO call_room_participants (room_id, user_id, role, status, joined_at, created_at)
       VALUES (?, ?, 'HOST', 'JOINED', NOW(), NOW())`,
      [roomId, parsedUserId]
    );

    await connection.commit();

    const hostProfile = await getUserPublicProfile(parsedUserId);

    return {
      id: roomId,
      roomCode,
      roomType: normalizedType,
      status: 'WAITING',
      role: 'HOST',
      maxParticipants: finalMax,
      createdBy: parsedUserId,
      host: hostProfile,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * 2. Get Call Room Details by Room Code
 * @param {string} roomCode
 * @param {number} userId - Requesting authenticated user ID
 */
const getRoomByCode = async (roomCode, userId) => {
  if (!roomCode || typeof roomCode !== 'string') {
    const err = new Error('Room code is required.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedCode = roomCode.trim().toUpperCase();

  const [rooms] = await pool.query(
    `SELECT cr.*,
            (SELECT COUNT(*) FROM call_room_participants WHERE room_id = cr.id AND status = 'JOINED') AS participant_count
     FROM call_rooms cr
     WHERE cr.room_code = ? LIMIT 1`,
    [normalizedCode]
  );

  if (rooms.length === 0) {
    const err = new Error('Room not found.');
    err.statusCode = 404;
    throw err;
  }

  const room = rooms[0];

  // Fetch host details (find current HOST role in call_room_participants)
  const [hostRows] = await pool.query(
    `SELECT user_id FROM call_room_participants
     WHERE room_id = ? AND role = 'HOST' AND status IN ('JOINED', 'WAITING')
     LIMIT 1`,
    [room.id]
  );
  const hostUserId = hostRows.length > 0 ? hostRows[0].user_id : room.created_by;
  const hostProfile = await getUserPublicProfile(hostUserId);

  // Check requesting user's status in room
  const parsedUserId = parseInt(userId, 10);
  let userRole = null;
  let userStatus = null;

  if (!isNaN(parsedUserId)) {
    const [userRows] = await pool.query(
      `SELECT role, status FROM call_room_participants WHERE room_id = ? AND user_id = ? LIMIT 1`,
      [room.id, parsedUserId]
    );
    if (userRows.length > 0) {
      userRole = userRows[0].role;
      userStatus = userRows[0].status;
    }
  }

  return {
    id: room.id,
    roomCode: room.room_code,
    roomType: room.room_type,
    status: room.status,
    maxParticipants: Number(room.max_participants),
    participantCount: Number(room.participant_count) || 0,
    startedAt: room.started_at,
    endedAt: room.ended_at,
    createdAt: room.created_at,
    host: hostProfile,
    isHost: userRole === 'HOST' || Number(room.created_by) === parsedUserId,
    userRole,
    userStatus,
  };
};

/**
 * 3. Join a Call Room
 * @param {object} params
 * @param {string} params.roomCode
 * @param {number} params.userId
 */
const joinRoom = async ({ roomCode, userId }) => {
  const parsedUserId = parseInt(userId, 10);
  if (!roomCode || isNaN(parsedUserId)) {
    const err = new Error('Room code and valid user ID are required.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedCode = roomCode.trim().toUpperCase();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Lock room row for atomic capacity check
    const [rooms] = await connection.query(
      `SELECT * FROM call_rooms WHERE room_code = ? FOR UPDATE`,
      [normalizedCode]
    );

    if (rooms.length === 0) {
      const err = new Error('Room not found.');
      err.statusCode = 404;
      throw err;
    }

    const room = rooms[0];

    if (room.status === 'ENDED') {
      const err = new Error('This call room has ended.');
      err.statusCode = 400;
      throw err;
    }

    // Check user's current participation record
    const [existingParticipantRows] = await connection.query(
      `SELECT * FROM call_room_participants WHERE room_id = ? AND user_id = ? FOR UPDATE`,
      [room.id, parsedUserId]
    );

    const isAlreadyJoined =
      existingParticipantRows.length > 0 &&
      existingParticipantRows[0].status === 'JOINED';

    // Count currently joined participants
    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS joined_count FROM call_room_participants WHERE room_id = ? AND status = 'JOINED' FOR UPDATE`,
      [room.id]
    );
    const joinedCount = Number(countRows[0].joined_count) || 0;

    // Check room capacity if not already joined
    if (!isAlreadyJoined && joinedCount >= Number(room.max_participants)) {
      const err = new Error('This room is full.');
      err.statusCode = 409;
      throw err;
    }

    // Check if user is blocked from this room (Phase 25)
    const [blockRows] = await connection.query(
      `SELECT 1 FROM call_room_blocks WHERE room_id = ? AND user_id = ? LIMIT 1`,
      [room.id, parsedUserId]
    );
    if (blockRows.length > 0) {
      const err = new Error('You are not allowed to rejoin this room.');
      err.statusCode = 403;
      throw err;
    }

    // Check if user was removed by host (Phase 25)
    if (existingParticipantRows.length > 0 && existingParticipantRows[0].status === 'REMOVED') {
      const err = new Error('You are not allowed to rejoin this room.');
      err.statusCode = 403;
      throw err;
    }

    // Determine role (keep HOST if creator or if existing participant was HOST)
    let role = 'PARTICIPANT';
    if (Number(room.created_by) === parsedUserId) {
      role = 'HOST';
    } else if (existingParticipantRows.length > 0 && existingParticipantRows[0].role === 'HOST') {
      role = 'HOST';
    }

    // Insert or update participant record to JOINED
    await connection.query(
      `INSERT INTO call_room_participants (room_id, user_id, role, status, joined_at, created_at)
       VALUES (?, ?, ?, 'JOINED', NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         role = VALUES(role),
         status = 'JOINED',
         joined_at = NOW(),
         left_at = NULL`,
      [room.id, parsedUserId, role]
    );

    // Update room status to ACTIVE if joinedCount + 1 >= 2 and room was WAITING
    const newJoinedCount = isAlreadyJoined ? joinedCount : joinedCount + 1;
    let newStatus = room.status;

    if (newJoinedCount >= 2 && room.status === 'WAITING') {
      newStatus = 'ACTIVE';
      await connection.query(
        `UPDATE call_rooms SET status = 'ACTIVE', started_at = IFNULL(started_at, NOW()) WHERE id = ?`,
        [room.id]
      );
    }

    await connection.commit();

    // Fetch updated participant list
    const participants = await getRoomParticipantsInternal(room.id);

    return {
      success: true,
      room: {
        id: room.id,
        roomCode: room.room_code,
        roomType: room.room_type,
        status: newStatus,
        role,
        maxParticipants: Number(room.max_participants),
        participantCount: newJoinedCount,
      },
      userRole: role,
      participants,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * 4. Leave a Call Room
 * @param {object} params
 * @param {string} params.roomCode
 * @param {number} params.userId
 */
const leaveRoom = async ({ roomCode, userId }) => {
  const parsedUserId = parseInt(userId, 10);
  if (!roomCode || isNaN(parsedUserId)) {
    const err = new Error('Room code and valid user ID are required.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedCode = roomCode.trim().toUpperCase();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rooms] = await connection.query(
      `SELECT * FROM call_rooms WHERE room_code = ? FOR UPDATE`,
      [normalizedCode]
    );

    if (rooms.length === 0) {
      const err = new Error('Room not found.');
      err.statusCode = 404;
      throw err;
    }

    const room = rooms[0];

    // Check participant
    const [partRows] = await connection.query(
      `SELECT * FROM call_room_participants WHERE room_id = ? AND user_id = ? FOR UPDATE`,
      [room.id, parsedUserId]
    );

    if (partRows.length === 0) {
      await connection.commit();
      return { success: true, message: 'User was not a participant in this room.' };
    }

    const leavingParticipant = partRows[0];

    // Mark as LEFT
    await connection.query(
      `UPDATE call_room_participants 
       SET status = 'LEFT', left_at = NOW() 
       WHERE room_id = ? AND user_id = ?`,
      [room.id, parsedUserId]
    );

    // Check remaining joined participants
    const [remainingRows] = await connection.query(
      `SELECT id, user_id, role, joined_at 
       FROM call_room_participants 
       WHERE room_id = ? AND status = 'JOINED' 
       ORDER BY joined_at ASC FOR UPDATE`,
      [room.id]
    );

    let hostTransferred = false;
    let newHostId = null;
    let roomEnded = false;

    if (remainingRows.length === 0) {
      // No participants remain: transition room to ENDED
      roomEnded = true;
      await connection.query(
        `UPDATE call_rooms SET status = 'ENDED', ended_at = NOW() WHERE id = ?`,
        [room.id]
      );
    } else if (leavingParticipant.role === 'HOST') {
      // Host left, but participants remain: transfer HOST role to next oldest joined participant
      const nextHost = remainingRows[0];
      newHostId = nextHost.user_id;
      hostTransferred = true;

      await connection.query(
        `UPDATE call_room_participants SET role = 'HOST' WHERE id = ?`,
        [nextHost.id]
      );
    }

    await connection.commit();

    // Clear active screen sharer and pending grace timers if leaving user was sharing/reconnecting
    try {
      const { clearActiveScreenSharer, cancelGraceTimer } = require('../socket/roomSignaling');
      clearActiveScreenSharer(normalizedCode, parsedUserId);
      cancelGraceTimer(normalizedCode, parsedUserId);
    } catch (e) {}

    return {
      success: true,
      roomCode: normalizedCode,
      leftUserId: parsedUserId,
      remainingCount: remainingRows.length,
      hostTransferred,
      newHostId,
      newHostUserId: newHostId,
      roomEnded,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * 5. End a Call Room (HOST Only)
 * @param {object} params
 * @param {string} params.roomCode
 * @param {number} params.userId
 */
const endRoom = async ({ roomCode, userId }) => {
  const parsedUserId = parseInt(userId, 10);
  if (!roomCode || isNaN(parsedUserId)) {
    const err = new Error('Room code and valid user ID are required.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedCode = roomCode.trim().toUpperCase();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rooms] = await connection.query(
      `SELECT * FROM call_rooms WHERE room_code = ? FOR UPDATE`,
      [normalizedCode]
    );

    if (rooms.length === 0) {
      const err = new Error('Room not found.');
      err.statusCode = 404;
      throw err;
    }

    const room = rooms[0];

    // Verify requesting user is HOST
    const [hostRows] = await connection.query(
      `SELECT * FROM call_room_participants 
       WHERE room_id = ? AND user_id = ? AND role = 'HOST' FOR UPDATE`,
      [room.id, parsedUserId]
    );

    const isHost = hostRows.length > 0 || Number(room.created_by) === parsedUserId;
    if (!isHost) {
      const err = new Error('Only the host may end this room.');
      err.statusCode = 403;
      throw err;
    }

    // Set room to ENDED
    await connection.query(
      `UPDATE call_rooms SET status = 'ENDED', ended_at = NOW() WHERE id = ?`,
      [room.id]
    );

    // Mark all remaining participants as LEFT
    await connection.query(
      `UPDATE call_room_participants SET status = 'LEFT', left_at = NOW() 
       WHERE room_id = ? AND status IN ('JOINED', 'WAITING')`,
      [room.id]
    );

    // Log END_ROOM in call_moderation_actions (Phase 25)
    await connection.query(
      `INSERT INTO call_moderation_actions (room_id, moderator_id, target_user_id, action_type, reason, created_at)
       VALUES (?, ?, NULL, 'END_ROOM', 'Room ended by host', NOW())`,
      [room.id, parsedUserId]
    );

    await connection.commit();

    // Clear active screen sharer and pending grace timers on room end
    try {
      const { clearActiveScreenSharer, cancelGraceTimer } = require('../socket/roomSignaling');
      clearActiveScreenSharer(normalizedCode);
      cancelGraceTimer(normalizedCode, parsedUserId);
    } catch (e) {}

    return {
      success: true,
      roomCode: normalizedCode,
      status: 'ENDED',
      endedBy: parsedUserId,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * Internal helper to retrieve participant objects with public profiles
 */
const getRoomParticipantsInternal = async (roomId) => {
  const [rows] = await pool.query(
    `SELECT crp.id, crp.user_id, crp.role, crp.status, crp.joined_at,
            crp.server_muted, crp.server_camera_disabled,
            u.username, up.display_name, up.avatar_url
     FROM call_room_participants crp
     JOIN users u ON crp.user_id = u.id
     LEFT JOIN user_profiles up ON u.id = up.user_id
     WHERE crp.room_id = ? AND crp.status = 'JOINED'
     ORDER BY crp.joined_at ASC`,
    [roomId]
  );

  return rows.map((r) => ({
    userId: r.user_id,
    name: r.display_name || r.username,
    username: r.username,
    avatarUrl: r.avatar_url || null,
    role: r.role,
    status: r.status,
    joinedAt: r.joined_at,
    serverMuted: Boolean(r.server_muted),
    serverCameraDisabled: Boolean(r.server_camera_disabled),
  }));
};

/**
 * 6. Get Room Participants (Authorized Room Members Only)
 * @param {string} roomCode
 * @param {number} userId
 */
const getRoomParticipants = async (roomCode, userId) => {
  const parsedUserId = parseInt(userId, 10);
  if (!roomCode || isNaN(parsedUserId)) {
    const err = new Error('Room code and valid user ID are required.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedCode = roomCode.trim().toUpperCase();

  const [rooms] = await pool.query(
    `SELECT id, created_by FROM call_rooms WHERE room_code = ? LIMIT 1`,
    [normalizedCode]
  );

  if (rooms.length === 0) {
    const err = new Error('Room not found.');
    err.statusCode = 404;
    throw err;
  }

  const room = rooms[0];

  // Verify membership authorization: user must be in call_room_participants or creator
  const [memberRows] = await pool.query(
    `SELECT * FROM call_room_participants 
     WHERE room_id = ? AND user_id = ? AND status IN ('JOINED', 'WAITING', 'INVITED') LIMIT 1`,
    [room.id, parsedUserId]
  );

  if (memberRows.length === 0 && Number(room.created_by) !== parsedUserId) {
    const err = new Error('You are not an authorized participant in this room.');
    err.statusCode = 403;
    throw err;
  }

  const participants = await getRoomParticipantsInternal(room.id);
  return {
    success: true,
    participants,
  };
};

/**
 * 7. Invite a User to the Room (HOST Only)
 * @param {object} params
 * @param {string} params.roomCode
 * @param {number} params.hostUserId
 * @param {number} params.targetUserId
 */
const inviteUser = async ({ roomCode, hostUserId, targetUserId }) => {
  const parsedHostId = parseInt(hostUserId, 10);
  const parsedTargetId = parseInt(targetUserId, 10);

  if (!roomCode || isNaN(parsedHostId) || isNaN(parsedTargetId)) {
    const err = new Error('Room code, host user ID, and target user ID are required.');
    err.statusCode = 400;
    throw err;
  }

  if (parsedHostId === parsedTargetId) {
    const err = new Error('Cannot invite yourself.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedCode = roomCode.trim().toUpperCase();

  // 1. Validate room & host authority
  const [rooms] = await pool.query(
    `SELECT * FROM call_rooms WHERE room_code = ? LIMIT 1`,
    [normalizedCode]
  );

  if (rooms.length === 0) {
    const err = new Error('Room not found.');
    err.statusCode = 404;
    throw err;
  }

  const room = rooms[0];

  if (room.status === 'ENDED') {
    const err = new Error('Cannot invite users to an ended room.');
    err.statusCode = 400;
    throw err;
  }

  // Check if caller is HOST
  const [hostRows] = await pool.query(
    `SELECT * FROM call_room_participants 
     WHERE room_id = ? AND user_id = ? AND role = 'HOST' AND status IN ('JOINED', 'WAITING') LIMIT 1`,
    [room.id, parsedHostId]
  );

  const isHost = hostRows.length > 0 || Number(room.created_by) === parsedHostId;
  if (!isHost) {
    const err = new Error('Only the host may invite participants to this room.');
    err.statusCode = 403;
    throw err;
  }

  // 2. Validate target user
  const targetUser = await getUserPublicProfile(parsedTargetId);
  if (!targetUser || targetUser.status !== 'ACTIVE') {
    const err = new Error('Target user does not exist or is inactive.');
    err.statusCode = 404;
    throw err;
  }

  // 3. Check if target user is already in room
  const [targetRows] = await pool.query(
    `SELECT * FROM call_room_participants WHERE room_id = ? AND user_id = ? LIMIT 1`,
    [room.id, parsedTargetId]
  );

  if (targetRows.length > 0 && targetRows[0].status === 'JOINED') {
    const err = new Error('User is already joined in this room.');
    err.statusCode = 400;
    throw err;
  }

  // 4. Check capacity
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS joined_count FROM call_room_participants WHERE room_id = ? AND status = 'JOINED'`,
    [room.id]
  );
  if (Number(countRows[0].joined_count) >= Number(room.max_participants)) {
    const err = new Error('This room is full.');
    err.statusCode = 409;
    throw err;
  }

  // 5. Insert/update participant as INVITED
  await pool.query(
    `INSERT INTO call_room_participants (room_id, user_id, role, status, created_at)
     VALUES (?, ?, 'PARTICIPANT', 'INVITED', NOW())
     ON DUPLICATE KEY UPDATE status = 'INVITED'`,
    [room.id, parsedTargetId]
  );

  const hostUser = await getUserPublicProfile(parsedHostId);

  // 6. Emit real-time socket invitation to target user's private room
  emitToUser(parsedTargetId, 'room:invitation', {
    roomCode: normalizedCode,
    roomType: room.room_type,
    host: {
      id: hostUser.id,
      name: hostUser.displayName || hostUser.username,
      avatarUrl: hostUser.avatarUrl,
    },
  });

  // 7. Persist notification in MySQL (Phase 22 integration)
  try {
    await notificationService.createNotification({
      userId: parsedTargetId,
      actorUserId: parsedHostId,
      type: 'CALL_ROOM_INVITATION',
      title: 'Video Call Room Invitation',
      message: `${hostUser.displayName || hostUser.username} invited you to join a ${room.room_type.toLowerCase().replace('_', '-')} video call room.`,
      entityType: 'call_room',
      entityId: room.id,
      dataJson: {
        room_code: normalizedCode,
        room_type: room.room_type,
        host_id: hostUser.id,
        host_name: hostUser.displayName || hostUser.username,
      },
    });
  } catch (notifErr) {
    console.warn('[CallRoomService] Failed to persist invitation notification:', notifErr.message);
  }

  return {
    success: true,
    message: 'Invitation sent successfully.',
    roomCode: normalizedCode,
    targetUserId: parsedTargetId,
  };
};

module.exports = {
  createRoom,
  getRoomByCode,
  joinRoom,
  leaveRoom,
  endRoom,
  getRoomParticipants,
  inviteUser,
};
