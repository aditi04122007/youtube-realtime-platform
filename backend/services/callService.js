const { pool } = require('../config/db');
const config = require('../config');
const { emitToUser } = require('../socket/socketServer');
const notificationService = require('./notificationService');

const CALL_STATUS = {
  RINGING: 'RINGING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  MISSED: 'MISSED',
  ENDED: 'ENDED',
  FAILED: 'FAILED',
};

// Map to track active ringing timers by callId: Map<number, NodeJS.Timeout>
const ringingTimers = new Map();

/**
 * Check if a user is currently in an active or ringing call
 * @param {number} userId
 * @returns {Promise<{ isBusy: boolean, activeCallId: number|null, status: string|null }>}
 */
const isUserBusy = async (userId) => {
  const [rows] = await pool.query(
    `SELECT id, caller_id, receiver_id, status 
     FROM video_calls 
     WHERE (caller_id = ? OR receiver_id = ?) 
       AND status IN ('RINGING', 'ACCEPTED') 
     ORDER BY id DESC 
     LIMIT 1`,
    [userId, userId]
  );

  if (rows.length > 0) {
    return {
      isBusy: true,
      activeCallId: rows[0].id,
      status: rows[0].status,
    };
  }

  return {
    isBusy: false,
    activeCallId: null,
    status: null,
  };
};

/**
 * Fetch public profile details for a user
 * @param {number} userId
 */
const getUserPublicInfo = async (userId) => {
  const [rows] = await pool.query(
    `SELECT 
       u.id, 
       u.username, 
       u.status,
       up.display_name AS displayName, 
       COALESCE(ch.avatar_url, up.avatar_url) AS avatarUrl,
       ch.id AS channelId,
       ch.channel_name AS channelName
     FROM users u
     LEFT JOIN user_profiles up ON u.id = up.user_id
     LEFT JOIN channels ch ON u.id = ch.user_id
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
};

/**
 * Initiate a one-to-one video call
 * @param {object} params
 * @param {number} params.callerId
 * @param {number} params.receiverId
 */
const initiateCall = async ({ callerId, receiverId }) => {
  const parsedCallerId = parseInt(callerId, 10);
  const parsedReceiverId = parseInt(receiverId, 10);

  if (isNaN(parsedCallerId) || isNaN(parsedReceiverId)) {
    const error = new Error('Invalid caller or receiver ID');
    error.statusCode = 400;
    throw error;
  }

  // 1. Cannot call yourself
  if (parsedCallerId === parsedReceiverId) {
    const error = new Error('You cannot call yourself.');
    error.statusCode = 400;
    throw error;
  }

  // 2. Validate caller
  const caller = await getUserPublicInfo(parsedCallerId);
  if (!caller || caller.status !== 'ACTIVE') {
    const error = new Error('Your account is not eligible to make calls.');
    error.statusCode = 403;
    throw error;
  }

  // 3. Validate receiver
  const receiver = await getUserPublicInfo(parsedReceiverId);
  if (!receiver || receiver.status !== 'ACTIVE') {
    const error = new Error('User not found or unavailable for calls.');
    error.statusCode = 404;
    throw error;
  }

  // 4. Check if caller is already on a call
  const callerBusy = await isUserBusy(parsedCallerId);
  if (callerBusy.isBusy) {
    const error = new Error('You are currently on another active call.');
    error.statusCode = 400;
    error.isBusy = true;
    error.callId = callerBusy.activeCallId;
    throw error;
  }

  // 5. Check if receiver is already on a call
  const receiverBusy = await isUserBusy(parsedReceiverId);
  if (receiverBusy.isBusy) {
    // Record FAILED call with busy reason in database
    const [failedRow] = await pool.query(
      `INSERT INTO video_calls (caller_id, receiver_id, status, ended_at, end_reason, created_at)
       VALUES (?, ?, 'FAILED', NOW(), 'busy', NOW())`,
      [parsedCallerId, parsedReceiverId]
    );

    // Notify caller via socket
    emitToUser(parsedCallerId, 'call:busy', {
      callId: failedRow.insertId,
      receiverId: parsedReceiverId,
      message: 'User is currently on another call.',
    });

    const error = new Error('User is currently on another call.');
    error.statusCode = 409;
    error.isBusy = true;
    error.callId = failedRow.insertId;
    throw error;
  }

  // 6. Create RINGING call record
  const [insertResult] = await pool.query(
    `INSERT INTO video_calls (caller_id, receiver_id, status, created_at)
     VALUES (?, ?, 'RINGING', NOW())`,
    [parsedCallerId, parsedReceiverId]
  );
  const callId = insertResult.insertId;

  // 7. Emit incoming call event to receiver's private room
  const callerName = caller.displayName || caller.username;
  emitToUser(parsedReceiverId, 'call:incoming', {
    callId,
    caller: {
      id: caller.id,
      username: caller.username,
      name: callerName,
      avatarUrl: caller.avatarUrl || null,
      channelId: caller.channelId || null,
    },
  });

  // 8. Setup server-side 30s ringing timeout
  const timeoutSeconds = config.webrtc?.ringingTimeoutSeconds || 30;
  const timer = setTimeout(() => {
    handleRingingTimeout(callId).catch((err) => {
      console.error(`[CallService] Ringing timeout error on call ${callId}:`, err.message);
    });
  }, timeoutSeconds * 1000);

  ringingTimers.set(callId, timer);

  return {
    id: callId,
    roomId: `call:${callId}`,
    callerId: parsedCallerId,
    receiverId: parsedReceiverId,
    status: CALL_STATUS.RINGING,
    createdAt: new Date().toISOString(),
    caller: {
      id: caller.id,
      name: callerName,
      avatarUrl: caller.avatarUrl || null,
    },
    receiver: {
      id: receiver.id,
      name: receiver.displayName || receiver.username,
      avatarUrl: receiver.avatarUrl || null,
    },
  };
};

/**
 * Receiver accepts an incoming call
 * @param {object} params
 * @param {number} params.callId
 * @param {number} params.userId
 */
const acceptCall = async ({ callId, userId }) => {
  const parsedCallId = parseInt(callId, 10);
  const parsedUserId = parseInt(userId, 10);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT * FROM video_calls WHERE id = ? FOR UPDATE`,
      [parsedCallId]
    );

    if (rows.length === 0) {
      const error = new Error('Call session not found.');
      error.statusCode = 404;
      throw error;
    }

    const call = rows[0];

    // Verify only the intended receiver may accept
    if (Number(call.receiver_id) !== parsedUserId) {
      const error = new Error('Only the intended receiver may accept this call.');
      error.statusCode = 403;
      throw error;
    }

    // Enforce state machine transition: RINGING -> ACCEPTED
    if (call.status !== CALL_STATUS.RINGING) {
      const error = new Error(`Cannot accept call with status '${call.status}'.`);
      error.statusCode = 400;
      throw error;
    }

    // Update status to ACCEPTED
    await connection.query(
      `UPDATE video_calls 
       SET status = 'ACCEPTED', answered_at = NOW(), started_at = NOW() 
       WHERE id = ?`,
      [parsedCallId]
    );

    await connection.commit();

    // Clear ringing timeout timer
    if (ringingTimers.has(parsedCallId)) {
      clearTimeout(ringingTimers.get(parsedCallId));
      ringingTimers.delete(parsedCallId);
    }

    // Emit call:accepted to caller
    emitToUser(call.caller_id, 'call:accepted', {
      callId: parsedCallId,
      receiverId: parsedUserId,
      status: CALL_STATUS.ACCEPTED,
      startedAt: new Date().toISOString(),
    });

    const nowIso = new Date().toISOString();
    return {
      id: parsedCallId,
      callerId: call.caller_id,
      receiverId: call.receiver_id,
      status: CALL_STATUS.ACCEPTED,
      startedAt: nowIso,
      answeredAt: nowIso,
      answered_at: nowIso,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * Receiver rejects an incoming call
 * @param {object} params
 * @param {number} params.callId
 * @param {number} params.userId
 */
const rejectCall = async ({ callId, userId }) => {
  const parsedCallId = parseInt(callId, 10);
  const parsedUserId = parseInt(userId, 10);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT * FROM video_calls WHERE id = ? FOR UPDATE`,
      [parsedCallId]
    );

    if (rows.length === 0) {
      const error = new Error('Call session not found.');
      error.statusCode = 404;
      throw error;
    }

    const call = rows[0];

    // Verify only the intended receiver may reject
    if (Number(call.receiver_id) !== parsedUserId) {
      const error = new Error('Only the intended receiver may reject this call.');
      error.statusCode = 403;
      throw error;
    }

    // State machine check: must be RINGING
    if (call.status !== CALL_STATUS.RINGING) {
      const error = new Error(`Cannot reject call with status '${call.status}'.`);
      error.statusCode = 400;
      throw error;
    }

    // Update to REJECTED
    await connection.query(
      `UPDATE video_calls 
       SET status = 'REJECTED', ended_at = NOW(), end_reason = 'rejected' 
       WHERE id = ?`,
      [parsedCallId]
    );

    await connection.commit();

    // Clear ringing timeout timer
    if (ringingTimers.has(parsedCallId)) {
      clearTimeout(ringingTimers.get(parsedCallId));
      ringingTimers.delete(parsedCallId);
    }

    // Emit call:rejected to caller
    emitToUser(call.caller_id, 'call:rejected', {
      callId: parsedCallId,
      receiverId: parsedUserId,
      reason: 'rejected',
    });

    const nowIso = new Date().toISOString();
    return {
      id: parsedCallId,
      status: CALL_STATUS.REJECTED,
      endReason: 'rejected',
      end_reason: 'rejected',
      endedAt: nowIso,
      ended_at: nowIso,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * End an active or ringing call
 * @param {object} params
 * @param {number} params.callId
 * @param {number} params.userId
 * @param {string} [params.endReason='ended']
 */
const endCall = async ({ callId, userId, endReason = 'ended' }) => {
  const parsedCallId = parseInt(callId, 10);
  const parsedUserId = parseInt(userId, 10);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT * FROM video_calls WHERE id = ? FOR UPDATE`,
      [parsedCallId]
    );

    if (rows.length === 0) {
      const error = new Error('Call session not found.');
      error.statusCode = 404;
      throw error;
    }

    const call = rows[0];

    // Must be a participant (caller or receiver)
    if (Number(call.caller_id) !== parsedUserId && Number(call.receiver_id) !== parsedUserId) {
      const error = new Error('You are not a participant in this call.');
      error.statusCode = 403;
      throw error;
    }

    // If call is already terminal, disallow ending again with 400
    if (['ENDED', 'REJECTED', 'MISSED', 'FAILED'].includes(call.status)) {
      await connection.commit();
      const error = new Error(`Call has already ended with status '${call.status}'.`);
      error.statusCode = 400;
      throw error;
    }

    // Update to ENDED
    await connection.query(
      `UPDATE video_calls 
       SET status = 'ENDED', ended_at = NOW(), end_reason = ? 
       WHERE id = ?`,
      [endReason, parsedCallId]
    );

    await connection.commit();

    // Clear ringing timer if still active
    if (ringingTimers.has(parsedCallId)) {
      clearTimeout(ringingTimers.get(parsedCallId));
      ringingTimers.delete(parsedCallId);
    }

    // Identify the other participant to notify
    const otherUserId = Number(call.caller_id) === parsedUserId ? call.receiver_id : call.caller_id;

    emitToUser(otherUserId, 'call:ended', {
      callId: parsedCallId,
      endedBy: parsedUserId,
      reason: endReason,
      endedAt: new Date().toISOString(),
    });

    const nowIso = new Date().toISOString();
    return {
      id: parsedCallId,
      status: CALL_STATUS.ENDED,
      endedAt: nowIso,
      ended_at: nowIso,
      endReason,
      end_reason: endReason,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * Handle server-side 30-second ringing timeout
 * @param {number} callId
 */
const handleRingingTimeout = async (callId) => {
  const parsedCallId = parseInt(callId, 10);
  if (ringingTimers.has(parsedCallId)) {
    ringingTimers.delete(parsedCallId);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT * FROM video_calls WHERE id = ? FOR UPDATE`,
      [parsedCallId]
    );

    if (rows.length === 0) {
      await connection.commit();
      return;
    }

    const call = rows[0];

    // Only transition if still RINGING
    if (call.status !== CALL_STATUS.RINGING) {
      await connection.commit();
      return;
    }

    // Transition to MISSED
    await connection.query(
      `UPDATE video_calls 
       SET status = 'MISSED', ended_at = NOW(), end_reason = 'ringing_timeout' 
       WHERE id = ?`,
      [parsedCallId]
    );

    await connection.commit();

    // Emit timeout event to both caller and receiver
    const payload = {
      callId: parsedCallId,
      status: CALL_STATUS.MISSED,
      reason: 'ringing_timeout',
      endedAt: new Date().toISOString(),
    };

    emitToUser(call.caller_id, 'call:timeout', payload);
    emitToUser(call.receiver_id, 'call:timeout', payload);

    // Optionally create a persistent notification for the receiver
    getUserPublicInfo(call.caller_id).then((callerInfo) => {
      const callerName = callerInfo?.displayName || callerInfo?.username || 'Someone';
      notificationService.createNotification({
        userId: call.receiver_id,
        actorUserId: call.caller_id,
        type: 'VIDEO_PUBLISHED', // Reuse notification table or record
        title: 'Missed Video Call',
        message: `You missed a video call from ${callerName}.`,
        entityType: 'call',
        entityId: parsedCallId,
        dataJson: {
          call_id: parsedCallId,
          caller_username: callerInfo?.username,
          caller_name: callerName,
          caller_avatar: callerInfo?.avatarUrl,
        },
      }).catch(() => {});
    }).catch(() => {});
  } catch (err) {
    await connection.rollback();
    console.error(`[CallService] Failed to process ringing timeout for call ${parsedCallId}:`, err);
  } finally {
    connection.release();
  }
};

/**
 * Retrieve call history for an authenticated user with pagination
 * @param {object} params
 * @param {number} params.userId
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 */
const getUserCallHistory = async ({ userId, page = 1, limit = 20 }) => {
  const parsedUserId = parseInt(userId, 10);
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;

  // Total call count for user
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total 
     FROM video_calls 
     WHERE caller_id = ? OR receiver_id = ?`,
    [parsedUserId, parsedUserId]
  );
  const total = countRows[0]?.total || 0;
  const totalPages = Math.ceil(total / l) || 1;

  // Fetch calls with other participant details
  const [rows] = await pool.query(
    `SELECT 
       vc.id,
       vc.caller_id,
       vc.receiver_id,
       vc.status,
       vc.started_at,
       vc.answered_at,
       vc.ended_at,
       vc.end_reason,
       vc.created_at,
       CASE 
         WHEN vc.answered_at IS NOT NULL AND vc.ended_at IS NOT NULL 
         THEN GREATEST(0, TIMESTAMPDIFF(SECOND, vc.answered_at, vc.ended_at))
         ELSE 0 
       END AS duration_seconds,
       CASE 
         WHEN vc.caller_id = ? THEN 'OUTGOING' 
         ELSE 'INCOMING' 
       END AS direction,
       u_other.id AS other_user_id,
       u_other.username AS other_username,
       up_other.display_name AS other_display_name,
       COALESCE(ch_other.avatar_url, up_other.avatar_url) AS other_avatar_url,
       ch_other.handle AS other_handle
     FROM video_calls vc
     INNER JOIN users u_other ON u_other.id = (CASE WHEN vc.caller_id = ? THEN vc.receiver_id ELSE vc.caller_id END)
     LEFT JOIN user_profiles up_other ON up_other.user_id = u_other.id
     LEFT JOIN channels ch_other ON ch_other.user_id = u_other.id
     WHERE vc.caller_id = ? OR vc.receiver_id = ?
     ORDER BY vc.created_at DESC
     LIMIT ? OFFSET ?`,
    [parsedUserId, parsedUserId, parsedUserId, parsedUserId, l, offset]
  );

  const formattedCalls = rows.map((r) => ({
    id: r.id,
    callerId: r.caller_id,
    receiverId: r.receiver_id,
    status: r.status,
    direction: r.direction,
    startedAt: r.started_at,
    answeredAt: r.answered_at,
    endedAt: r.ended_at,
    endReason: r.end_reason,
    createdAt: r.created_at,
    durationSeconds: Number(r.duration_seconds) || 0,
    otherUser: {
      id: r.other_user_id,
      username: r.other_username,
      displayName: r.other_display_name || r.other_username,
      avatarUrl: r.other_avatar_url || null,
      handle: r.other_handle || null,
    },
  }));

  return {
    calls: formattedCalls,
    pagination: {
      page: p,
      limit: l,
      total,
      totalPages,
      hasMore: p < totalPages,
    },
  };
};

/**
 * Retrieve single call details with IDOR participant verification
 * @param {object} params
 * @param {number} params.callId
 * @param {number} params.userId
 */
const getCallDetails = async ({ callId, userId }) => {
  const parsedCallId = parseInt(callId, 10);
  const parsedUserId = parseInt(userId, 10);

  const [rows] = await pool.query(
    `SELECT vc.*,
       TIMESTAMPDIFF(SECOND, vc.answered_at, vc.ended_at) AS duration_seconds
     FROM video_calls vc
     WHERE vc.id = ? LIMIT 1`,
    [parsedCallId]
  );

  if (rows.length === 0) {
    const error = new Error('Call session not found.');
    error.statusCode = 404;
    throw error;
  }

  const call = rows[0];

  // IDOR Protection: only caller or receiver can access details
  if (Number(call.caller_id) !== parsedUserId && Number(call.receiver_id) !== parsedUserId) {
    const error = new Error('You are not authorized to view this call.');
    error.statusCode = 403;
    throw error;
  }

  const caller = await getUserPublicInfo(call.caller_id);
  const receiver = await getUserPublicInfo(call.receiver_id);

  return {
    id: call.id,
    callerId: call.caller_id,
    receiverId: call.receiver_id,
    status: call.status,
    startedAt: call.started_at,
    answeredAt: call.answered_at,
    endedAt: call.ended_at,
    endReason: call.end_reason,
    createdAt: call.created_at,
    durationSeconds: Math.max(0, Number(call.duration_seconds) || 0),
    isCaller: Number(call.caller_id) === parsedUserId,
    caller: {
      id: caller?.id,
      username: caller?.username,
      name: caller?.displayName || caller?.username,
      avatarUrl: caller?.avatarUrl || null,
    },
    receiver: {
      id: receiver?.id,
      username: receiver?.username,
      name: receiver?.displayName || receiver?.username,
      avatarUrl: receiver?.avatarUrl || null,
    },
  };
};

/**
 * Return ICE servers configuration for WebRTC
 */
const getIceServersConfig = () => {
  const webrtcConfig = config.webrtc || {};
  const iceServers = [];

  // Public STUN server
  if (webrtcConfig.stunServer) {
    iceServers.push({
      urls: webrtcConfig.stunServer.split(',').map((s) => s.trim()),
    });
  } else {
    iceServers.push({
      urls: ['stun:stun.l.google.com:19302'],
    });
  }

  // Production TURN server if configured
  if (webrtcConfig.turnServer) {
    const turnEntry = {
      urls: webrtcConfig.turnServer.split(',').map((s) => s.trim()),
    };
    if (webrtcConfig.turnUsername) turnEntry.username = webrtcConfig.turnUsername;
    if (webrtcConfig.turnCredential) turnEntry.credential = webrtcConfig.turnCredential;
    iceServers.push(turnEntry);
  }

  return {
    success: true,
    iceServers,
  };
};

module.exports = {
  CALL_STATUS,
  initiateCall,
  acceptCall,
  rejectCall,
  endCall,
  handleRingingTimeout,
  getUserCallHistory,
  getCallDetails,
  isUserBusy,
  getIceServersConfig,
};
