const { pool } = require('../config/db');
const { emitToUser, emitToRoom } = require('../socket/socketServer');

const VALID_REPORT_REASONS = [
  'Harassment',
  'Abusive behavior',
  'Inappropriate content',
  'Spam',
  'Impersonation',
  'Privacy violation',
  'Other',
];

/**
 * Helper to fetch a user's display name & username
 */
const getUserInfo = async (userId) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, up.display_name, up.avatar_url
     FROM users u
     LEFT JOIN user_profiles up ON u.id = up.user_id
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );
  if (rows.length === 0) return null;
  return {
    id: rows[0].id,
    username: rows[0].username,
    name: rows[0].display_name || rows[0].username,
    avatarUrl: rows[0].avatar_url || null,
  };
};

/**
 * Validate that the caller is the authorized active HOST of the room
 * @param {string} roomCode
 * @param {number} userId
 * @returns {Promise<{ room: object, hostParticipant: object }>}
 */
const verifyModeratorAuthority = async (roomCode, userId) => {
  if (!roomCode || !userId) {
    const err = new Error('Room code and authenticated user ID are required.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedCode = roomCode.trim().toUpperCase();

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
    const err = new Error('This call room has ended.');
    err.statusCode = 400;
    throw err;
  }

  // Check role from call_room_participants or creator
  const [hostRows] = await pool.query(
    `SELECT * FROM call_room_participants 
     WHERE room_id = ? AND user_id = ? AND role = 'HOST' AND status = 'JOINED' LIMIT 1`,
    [room.id, userId]
  );

  const isHost = hostRows.length > 0 || Number(room.created_by) === Number(userId);

  if (!isHost) {
    const err = new Error('Only the room host may perform moderation actions.');
    err.statusCode = 403;
    throw err;
  }

  return { room, hostParticipant: hostRows[0] || { role: 'HOST', user_id: userId } };
};

/**
 * 1. Mute Participant (Host Only)
 */
const muteParticipant = async ({ roomCode, moderatorId, targetUserId, reason }) => {
  const parsedModId = parseInt(moderatorId, 10);
  const parsedTargetId = parseInt(targetUserId, 10);

  if (isNaN(parsedModId) || isNaN(parsedTargetId)) {
    const err = new Error('Valid target userId is required.');
    err.statusCode = 400;
    throw err;
  }

  // Host cannot be moderated
  if (parsedModId === parsedTargetId) {
    const err = new Error('Host cannot be muted, removed, or blocked.');
    err.statusCode = 400;
    throw err;
  }

  const { room } = await verifyModeratorAuthority(roomCode, parsedModId);

  // Check if target is in the room
  const [targetRows] = await pool.query(
    `SELECT * FROM call_room_participants 
     WHERE room_id = ? AND user_id = ? LIMIT 1`,
    [room.id, parsedTargetId]
  );

  if (targetRows.length === 0 || targetRows[0].status !== 'JOINED') {
    const err = new Error('Target user is not currently an active participant in this room.');
    err.statusCode = 404;
    throw err;
  }

  // Target cannot be HOST
  if (targetRows[0].role === 'HOST' || Number(room.created_by) === parsedTargetId) {
    const err = new Error('Host cannot be muted, removed, or blocked.');
    err.statusCode = 400;
    throw err;
  }

  const sanitizedReason = (reason || 'Muted by host').substring(0, 500);

  // Update participant state
  await pool.query(
    `UPDATE call_room_participants 
     SET server_muted = TRUE 
     WHERE room_id = ? AND user_id = ?`,
    [room.id, parsedTargetId]
  );

  // Log action
  await pool.query(
    `INSERT INTO call_moderation_actions (room_id, moderator_id, target_user_id, action_type, reason, metadata, created_at)
     VALUES (?, ?, ?, 'MUTE', ?, ?, NOW())`,
    [room.id, parsedModId, parsedTargetId, sanitizedReason, JSON.stringify({ reason: sanitizedReason })]
  );

  // Emit private event to target
  emitToUser(parsedTargetId, 'room:moderation-mute', {
    roomCode: room.room_code,
    moderatorId: parsedModId,
    targetUserId: parsedTargetId,
    reason: sanitizedReason,
  });

  // Broadcast state change to room peers
  emitToRoom(`room:${room.room_code}`, 'room:moderation-mute', {
    roomCode: room.room_code,
    moderatorId: parsedModId,
    targetUserId: parsedTargetId,
    reason: sanitizedReason,
  });
  emitToRoom(`room:${room.room_code}`, 'room:audio-state', {
    roomCode: room.room_code,
    userId: parsedTargetId,
    enabled: false,
    serverMuted: true,
  });

  return {
    success: true,
    message: 'Participant muted by host.',
    action: 'MUTE',
    targetUserId: parsedTargetId,
    reason: sanitizedReason,
    participant: {
      userId: parsedTargetId,
      serverMuted: true,
    },
  };
};

/**
 * 2. Unmute Participant (Host Only)
 */
const unmuteParticipant = async ({ roomCode, moderatorId, targetUserId }) => {
  const parsedModId = parseInt(moderatorId, 10);
  const parsedTargetId = parseInt(targetUserId, 10);

  if (isNaN(parsedModId) || isNaN(parsedTargetId)) {
    const err = new Error('Valid target userId is required.');
    err.statusCode = 400;
    throw err;
  }

  const { room } = await verifyModeratorAuthority(roomCode, parsedModId);

  const [targetRows] = await pool.query(
    `SELECT * FROM call_room_participants 
     WHERE room_id = ? AND user_id = ? LIMIT 1`,
    [room.id, parsedTargetId]
  );

  if (targetRows.length === 0) {
    const err = new Error('Target user is not a participant in this room.');
    err.statusCode = 404;
    throw err;
  }

  // Clear server_muted
  await pool.query(
    `UPDATE call_room_participants 
     SET server_muted = FALSE 
     WHERE room_id = ? AND user_id = ?`,
    [room.id, parsedTargetId]
  );

  // Log action
  await pool.query(
    `INSERT INTO call_moderation_actions (room_id, moderator_id, target_user_id, action_type, reason, created_at)
     VALUES (?, ?, ?, 'UNMUTE', 'Unmuted by host', NOW())`,
    [room.id, parsedModId, parsedTargetId]
  );

  // Emit private event to target
  emitToUser(parsedTargetId, 'room:moderation-unmute', {
    roomCode: room.room_code,
    moderatorId: parsedModId,
    targetUserId: parsedTargetId,
  });

  // Broadcast state update to room peers
  emitToRoom(`room:${room.room_code}`, 'room:moderation-unmute', {
    roomCode: room.room_code,
    moderatorId: parsedModId,
    targetUserId: parsedTargetId,
  });
  emitToRoom(`room:${room.room_code}`, 'room:participant-state-changed', {
    roomCode: room.room_code,
    userId: parsedTargetId,
    serverMuted: false,
  });

  return {
    success: true,
    message: 'Participant unmuted by host. Target user may now enable microphone.',
    action: 'UNMUTE',
    targetUserId: parsedTargetId,
    participant: {
      userId: parsedTargetId,
      serverMuted: false,
    },
  };
};

/**
 * 3. Disable Participant Camera (Host Only)
 */
const disableCamera = async ({ roomCode, moderatorId, targetUserId, reason }) => {
  const parsedModId = parseInt(moderatorId, 10);
  const parsedTargetId = parseInt(targetUserId, 10);

  if (isNaN(parsedModId) || isNaN(parsedTargetId)) {
    const err = new Error('Valid target userId is required.');
    err.statusCode = 400;
    throw err;
  }

  if (parsedModId === parsedTargetId) {
    const err = new Error('Host cannot be muted, removed, or blocked.');
    err.statusCode = 400;
    throw err;
  }

  const { room } = await verifyModeratorAuthority(roomCode, parsedModId);

  const [targetRows] = await pool.query(
    `SELECT * FROM call_room_participants 
     WHERE room_id = ? AND user_id = ? LIMIT 1`,
    [room.id, parsedTargetId]
  );

  if (targetRows.length === 0 || targetRows[0].status !== 'JOINED') {
    const err = new Error('Target user is not currently an active participant in this room.');
    err.statusCode = 404;
    throw err;
  }

  if (targetRows[0].role === 'HOST' || Number(room.created_by) === parsedTargetId) {
    const err = new Error('Host cannot be muted, removed, or blocked.');
    err.statusCode = 400;
    throw err;
  }

  const sanitizedReason = (reason || 'Camera disabled by host').substring(0, 500);

  // Update participant state
  await pool.query(
    `UPDATE call_room_participants 
     SET server_camera_disabled = TRUE 
     WHERE room_id = ? AND user_id = ?`,
    [room.id, parsedTargetId]
  );

  // Log action
  await pool.query(
    `INSERT INTO call_moderation_actions (room_id, moderator_id, target_user_id, action_type, reason, metadata, created_at)
     VALUES (?, ?, ?, 'CAMERA_DISABLE', ?, ?, NOW())`,
    [room.id, parsedModId, parsedTargetId, sanitizedReason, JSON.stringify({ reason: sanitizedReason })]
  );

  // Emit private event to target
  emitToUser(parsedTargetId, 'room:moderation-camera-disable', {
    roomCode: room.room_code,
    moderatorId: parsedModId,
    targetUserId: parsedTargetId,
    reason: sanitizedReason,
  });

  // Broadcast to room
  emitToRoom(`room:${room.room_code}`, 'room:moderation-camera-disable', {
    roomCode: room.room_code,
    moderatorId: parsedModId,
    targetUserId: parsedTargetId,
    reason: sanitizedReason,
  });
  emitToRoom(`room:${room.room_code}`, 'room:video-state', {
    roomCode: room.room_code,
    userId: parsedTargetId,
    enabled: false,
    serverCameraDisabled: true,
  });

  return {
    success: true,
    message: 'Participant camera disabled by host.',
    action: 'CAMERA_DISABLE',
    targetUserId: parsedTargetId,
    reason: sanitizedReason,
    participant: {
      userId: parsedTargetId,
      serverCameraDisabled: true,
    },
  };
};

/**
 * 4. Enable Participant Camera (Host Only)
 */
const enableCamera = async ({ roomCode, moderatorId, targetUserId }) => {
  const parsedModId = parseInt(moderatorId, 10);
  const parsedTargetId = parseInt(targetUserId, 10);

  if (isNaN(parsedModId) || isNaN(parsedTargetId)) {
    const err = new Error('Valid target userId is required.');
    err.statusCode = 400;
    throw err;
  }

  const { room } = await verifyModeratorAuthority(roomCode, parsedModId);

  const [targetRows] = await pool.query(
    `SELECT * FROM call_room_participants 
     WHERE room_id = ? AND user_id = ? LIMIT 1`,
    [room.id, parsedTargetId]
  );

  if (targetRows.length === 0) {
    const err = new Error('Target user is not a participant in this room.');
    err.statusCode = 404;
    throw err;
  }

  // Clear server_camera_disabled
  await pool.query(
    `UPDATE call_room_participants 
     SET server_camera_disabled = FALSE 
     WHERE room_id = ? AND user_id = ?`,
    [room.id, parsedTargetId]
  );

  // Log action
  await pool.query(
    `INSERT INTO call_moderation_actions (room_id, moderator_id, target_user_id, action_type, reason, created_at)
     VALUES (?, ?, ?, 'CAMERA_ENABLE', 'Camera permission restored by host', NOW())`,
    [room.id, parsedModId, parsedTargetId]
  );

  // Emit private event to target
  emitToUser(parsedTargetId, 'room:moderation-camera-enable', {
    roomCode: room.room_code,
    moderatorId: parsedModId,
    targetUserId: parsedTargetId,
  });

  // Broadcast to room
  emitToRoom(`room:${room.room_code}`, 'room:moderation-camera-enable', {
    roomCode: room.room_code,
    moderatorId: parsedModId,
    targetUserId: parsedTargetId,
  });
  emitToRoom(`room:${room.room_code}`, 'room:participant-state-changed', {
    roomCode: room.room_code,
    userId: parsedTargetId,
    serverCameraDisabled: false,
  });

  return {
    success: true,
    message: 'Participant camera re-enabled by host.',
    action: 'CAMERA_ENABLE',
    targetUserId: parsedTargetId,
    participant: {
      userId: parsedTargetId,
      serverCameraDisabled: false,
    },
  };
};

/**
 * 5. Remove Participant (Host Only)
 */
const removeParticipant = async ({ roomCode, moderatorId, targetUserId, reason }) => {
  const parsedModId = parseInt(moderatorId, 10);
  const parsedTargetId = parseInt(targetUserId, 10);

  if (isNaN(parsedModId) || isNaN(parsedTargetId)) {
    const err = new Error('Valid target userId is required.');
    err.statusCode = 400;
    throw err;
  }

  if (parsedModId === parsedTargetId) {
    const err = new Error('Host cannot be muted, removed, or blocked.');
    err.statusCode = 400;
    throw err;
  }

  const { room } = await verifyModeratorAuthority(roomCode, parsedModId);

  const [targetRows] = await pool.query(
    `SELECT * FROM call_room_participants 
     WHERE room_id = ? AND user_id = ? LIMIT 1`,
    [room.id, parsedTargetId]
  );

  if (targetRows.length === 0 || targetRows[0].status !== 'JOINED') {
    const err = new Error('Target user is not currently an active participant in this room.');
    err.statusCode = 404;
    throw err;
  }

  if (targetRows[0].role === 'HOST' || Number(room.created_by) === parsedTargetId) {
    const err = new Error('Host cannot be muted, removed, or blocked.');
    err.statusCode = 400;
    throw err;
  }

  const sanitizedReason = (reason || 'Violation of room rules').substring(0, 500);

  // Mark participant as REMOVED
  await pool.query(
    `UPDATE call_room_participants 
     SET status = 'REMOVED', left_at = NOW() 
     WHERE room_id = ? AND user_id = ?`,
    [room.id, parsedTargetId]
  );

  // Log action
  await pool.query(
    `INSERT INTO call_moderation_actions (room_id, moderator_id, target_user_id, action_type, reason, metadata, created_at)
     VALUES (?, ?, ?, 'REMOVE', ?, ?, NOW())`,
    [room.id, parsedModId, parsedTargetId, sanitizedReason, JSON.stringify({ reason: sanitizedReason })]
  );

  // Emit private event to target
  emitToUser(parsedTargetId, 'room:participant-removed', {
    roomCode: room.room_code,
    moderatorId: parsedModId,
    targetUserId: parsedTargetId,
    reason: sanitizedReason,
  });

  // Broadcast to room that participant has been removed
  emitToRoom(`room:${room.room_code}`, 'room:participant-removed', {
    roomCode: room.room_code,
    moderatorId: parsedModId,
    targetUserId: parsedTargetId,
    reason: sanitizedReason,
  });
  // Clear any active screen share and cancel grace timers from removed participant
  try {
    const { clearActiveScreenSharer, cancelGraceTimer } = require('../socket/roomSignaling');
    clearActiveScreenSharer(room.room_code, parsedTargetId);
    cancelGraceTimer(room.room_code, parsedTargetId);
  } catch (e) {}

  emitToRoom(`room:${room.room_code}`, 'room:participant-left', {
    roomCode: room.room_code,
    userId: parsedTargetId,
    reason: 'removed',
  });

  return {
    success: true,
    message: 'Participant removed from room.',
    action: 'REMOVE',
    targetUserId: parsedTargetId,
    reason: sanitizedReason,
  };
};

/**
 * 6. Block Participant from Rejoining (Host Only)
 */
const blockParticipant = async ({ roomCode, moderatorId, targetUserId, reason }) => {
  const parsedModId = parseInt(moderatorId, 10);
  const parsedTargetId = parseInt(targetUserId, 10);

  if (isNaN(parsedModId) || isNaN(parsedTargetId)) {
    const err = new Error('Valid target userId is required.');
    err.statusCode = 400;
    throw err;
  }

  if (parsedModId === parsedTargetId) {
    const err = new Error('Host cannot be muted, removed, or blocked.');
    err.statusCode = 400;
    throw err;
  }

  const { room } = await verifyModeratorAuthority(roomCode, parsedModId);

  // Target cannot be host or creator
  if (Number(room.created_by) === parsedTargetId) {
    const err = new Error('Host cannot be muted, removed, or blocked.');
    err.statusCode = 400;
    throw err;
  }

  const sanitizedReason = (reason || 'Repeated rule violations').substring(0, 500);

  // Insert or update block
  await pool.query(
    `INSERT INTO call_room_blocks (room_id, user_id, blocked_by, reason, created_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE blocked_by = VALUES(blocked_by), reason = VALUES(reason)`,
    [room.id, parsedTargetId, parsedModId, sanitizedReason]
  );

  // If target is in call_room_participants, mark as REMOVED
  await pool.query(
    `UPDATE call_room_participants 
     SET status = 'REMOVED', left_at = NOW() 
     WHERE room_id = ? AND user_id = ?`,
    [room.id, parsedTargetId]
  );

  // Log action
  await pool.query(
    `INSERT INTO call_moderation_actions (room_id, moderator_id, target_user_id, action_type, reason, metadata, created_at)
     VALUES (?, ?, ?, 'BLOCK_REJOIN', ?, ?, NOW())`,
    [room.id, parsedModId, parsedTargetId, sanitizedReason, JSON.stringify({ reason: sanitizedReason })]
  );

  // Emit private event to target
  emitToUser(parsedTargetId, 'room:participant-blocked', {
    roomCode: room.room_code,
    moderatorId: parsedModId,
    targetUserId: parsedTargetId,
    reason: sanitizedReason,
  });

  // Broadcast to room
  emitToRoom(`room:${room.room_code}`, 'room:participant-blocked', {
    roomCode: room.room_code,
    moderatorId: parsedModId,
    targetUserId: parsedTargetId,
    reason: sanitizedReason,
  });
  // Clear any active screen share and cancel grace timers from blocked participant
  try {
    const { clearActiveScreenSharer, cancelGraceTimer } = require('../socket/roomSignaling');
    clearActiveScreenSharer(room.room_code, parsedTargetId);
    cancelGraceTimer(room.room_code, parsedTargetId);
  } catch (e) {}

  emitToRoom(`room:${room.room_code}`, 'room:participant-left', {
    roomCode: room.room_code,
    userId: parsedTargetId,
    reason: 'blocked',
  });

  return {
    success: true,
    message: 'Participant blocked from rejoining the room.',
    action: 'BLOCK_REJOIN',
    targetUserId: parsedTargetId,
    reason: sanitizedReason,
  };
};

/**
 * 7. Unblock Participant (Host Only)
 */
const unblockParticipant = async ({ roomCode, moderatorId, targetUserId }) => {
  const parsedModId = parseInt(moderatorId, 10);
  const parsedTargetId = parseInt(targetUserId, 10);

  if (isNaN(parsedModId) || isNaN(parsedTargetId)) {
    const err = new Error('Valid target userId is required.');
    err.statusCode = 400;
    throw err;
  }

  const { room } = await verifyModeratorAuthority(roomCode, parsedModId);

  // Delete block record
  const [delRes] = await pool.query(
    `DELETE FROM call_room_blocks WHERE room_id = ? AND user_id = ?`,
    [room.id, parsedTargetId]
  );

  // Reset participant status from REMOVED to LEFT if applicable
  await pool.query(
    `UPDATE call_room_participants 
     SET status = 'LEFT' 
     WHERE room_id = ? AND user_id = ? AND status = 'REMOVED'`,
    [room.id, parsedTargetId]
  );

  // Log action
  await pool.query(
    `INSERT INTO call_moderation_actions (room_id, moderator_id, target_user_id, action_type, reason, created_at)
     VALUES (?, ?, ?, 'UNBLOCK_REJOIN', 'Unblocked by host', NOW())`,
    [room.id, parsedModId, parsedTargetId]
  );

  // Emit private notification to target
  emitToUser(parsedTargetId, 'room:participant-unblocked', {
    roomCode: room.room_code,
    moderatorId: parsedModId,
  });

  return {
    success: true,
    message: 'Participant unblocked from room.',
    action: 'UNBLOCK_REJOIN',
    targetUserId: parsedTargetId,
  };
};

/**
 * 8. Report a Participant (Any Room Member)
 */
const reportParticipant = async ({ roomCode, reporterId, targetUserId, category, reason, details }) => {
  const parsedReporterId = parseInt(reporterId, 10);
  const parsedTargetId = parseInt(targetUserId, 10);

  if (!roomCode || isNaN(parsedReporterId) || isNaN(parsedTargetId)) {
    const err = new Error('Room code, reporter ID, and target user ID are required.');
    err.statusCode = 400;
    throw err;
  }

  if (parsedReporterId === parsedTargetId) {
    const err = new Error('You cannot report yourself.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedCode = roomCode.trim().toUpperCase();

  const [rooms] = await pool.query(
    `SELECT id, room_code, status FROM call_rooms WHERE room_code = ? LIMIT 1`,
    [normalizedCode]
  );

  if (rooms.length === 0) {
    const err = new Error('Room not found.');
    err.statusCode = 404;
    throw err;
  }

  const room = rooms[0];

  // Verify reporter belongs to room
  const [repRows] = await pool.query(
    `SELECT * FROM call_room_participants 
     WHERE room_id = ? AND user_id = ? AND status = 'JOINED' LIMIT 1`,
    [room.id, parsedReporterId]
  );

  if (repRows.length === 0) {
    const err = new Error('You must be an active participant in this room to submit a report.');
    err.statusCode = 403;
    throw err;
  }

  // Verify target belongs to room (or was in room)
  const [targetRows] = await pool.query(
    `SELECT * FROM call_room_participants 
     WHERE room_id = ? AND user_id = ? LIMIT 1`,
    [room.id, parsedTargetId]
  );

  if (targetRows.length === 0) {
    const err = new Error('Target user does not belong to this call room.');
    err.statusCode = 404;
    throw err;
  }

  // Validate reason from controlled list
  const trimmedReason = (category || reason || '').trim();
  if (!VALID_REPORT_REASONS.includes(trimmedReason)) {
    const err = new Error(`Invalid report category. Must be one of: ${VALID_REPORT_REASONS.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const sanitizedDetails = (details || '').trim().substring(0, 500);

  // Log report action
  await pool.query(
    `INSERT INTO call_moderation_actions (room_id, moderator_id, target_user_id, action_type, reason, metadata, created_at)
     VALUES (?, ?, ?, 'REPORT', ?, ?, NOW())`,
    [
      room.id,
      parsedReporterId,
      parsedTargetId,
      trimmedReason,
      JSON.stringify({ category: trimmedReason, reason: trimmedReason, details: sanitizedDetails }),
    ]
  );

  // Private confirmation to reporter (DO NOT broadcast report details to room)
  emitToUser(parsedReporterId, 'room:report-created', {
    roomCode: room.room_code,
    targetUserId: parsedTargetId,
    reason: trimmedReason,
  });

  return {
    success: true,
    message: 'Report submitted successfully. Thank you for keeping StreamWave safe.',
    targetUserId: parsedTargetId,
    reason: trimmedReason,
  };
};

/**
 * 9. Get Moderation History & Blocked Users (Host Only)
 */
const getModerationHistory = async ({ roomCode, moderatorId, userId }) => {
  const parsedUserId = parseInt(moderatorId || userId, 10);
  const { room } = await verifyModeratorAuthority(roomCode, parsedUserId);

  // Fetch actions
  const [actionRows] = await pool.query(
    `SELECT cma.id, cma.action_type AS actionType, cma.reason, cma.metadata, cma.created_at AS createdAt,
            m.id AS moderatorId, m.username AS moderatorUsername, mp.display_name AS moderatorName,
            t.id AS targetUserId, t.username AS targetUsername, tp.display_name AS targetName
     FROM call_moderation_actions cma
     JOIN users m ON cma.moderator_id = m.id
     LEFT JOIN user_profiles mp ON m.id = mp.user_id
     LEFT JOIN users t ON cma.target_user_id = t.id
     LEFT JOIN user_profiles tp ON t.id = tp.user_id
     WHERE cma.room_id = ?
     ORDER BY cma.created_at DESC
     LIMIT 50`,
    [room.id]
  );

  // Fetch active blocks
  const [blockRows] = await pool.query(
    `SELECT crb.id, crb.reason, crb.created_at AS createdAt,
            u.id AS userId, u.username, up.display_name AS name, up.avatar_url AS avatarUrl,
            b.id AS blockedById, b.username AS blockedByUsername
     FROM call_room_blocks crb
     JOIN users u ON crb.user_id = u.id
     LEFT JOIN user_profiles up ON u.id = up.user_id
     JOIN users b ON crb.blocked_by = b.id
     WHERE crb.room_id = ?
     ORDER BY crb.created_at DESC`,
    [room.id]
  );

  const formattedActions = actionRows.map((a) => {
    let parsedMetadata = null;
    if (a.metadata) {
      try {
        parsedMetadata = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata;
      } catch (e) {}
    }
    return {
      id: a.id,
      action: a.actionType,
      actionType: a.actionType,
      reason: a.reason,
      metadata: parsedMetadata,
      createdAt: a.createdAt,
      actorName: a.moderatorName || a.moderatorUsername,
      targetName: a.targetName || a.targetUsername,
      moderator: {
        id: a.moderatorId,
        username: a.moderatorUsername,
        name: a.moderatorName || a.moderatorUsername,
      },
      target: a.targetUserId
        ? {
            id: a.targetUserId,
            username: a.targetUsername,
            name: a.targetName || a.targetUsername,
          }
        : null,
    };
  });

  return {
    success: true,
    roomCode: room.room_code,
    history: formattedActions,
    actions: formattedActions,
    blocks: blockRows.map((b) => ({
      id: b.id,
      userId: b.userId,
      username: b.username,
      name: b.name || b.username,
      userName: b.name || b.username,
      avatarUrl: b.avatarUrl || null,
      reason: b.reason,
      createdAt: b.createdAt,
      blockedBy: {
        id: b.blockedById,
        username: b.blockedByUsername,
      },
    })),
  };
};

/**
 * 10. Helper: Check if a user is blocked from a room
 */
const isUserBlocked = async (roomId, userId) => {
  const [rows] = await pool.query(
    `SELECT 1 FROM call_room_blocks WHERE room_id = ? AND user_id = ? LIMIT 1`,
    [roomId, userId]
  );
  return rows.length > 0;
};

module.exports = {
  VALID_REPORT_REASONS,
  verifyModeratorAuthority,
  muteParticipant,
  unmuteParticipant,
  disableCamera,
  enableCamera,
  removeParticipant,
  blockParticipant,
  unblockParticipant,
  reportParticipant,
  getModerationHistory,
  isUserBlocked,
};
