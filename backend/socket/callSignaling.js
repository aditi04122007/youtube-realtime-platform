const { pool } = require('../config/db');

// Lazy getter for callService to prevent circular dependency with socketServer
const getCallService = () => require('../services/callService');

const callGraceTimers = new Map(); // key: `${callId}:${userId}`

const cancelCallGraceTimer = (callId, userId) => {
  const key = `${callId}:${userId}`;
  if (callGraceTimers.has(key)) {
    clearTimeout(callGraceTimers.get(key));
    callGraceTimers.delete(key);
  }
};

/**
 * Register WebRTC signaling event handlers on an authenticated socket
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
const registerCallSignaling = (socket, io) => {
  const userId = socket.user?.id;
  if (!userId) return;

  /**
   * Helper to verify if socket user is caller or receiver for a given call
   * @param {number|string} callId
   * @returns {Promise<{ authorized: boolean, call: object|null }>}
   */
  const verifyCallParticipant = async (callId) => {
    const parsedId = parseInt(callId, 10);
    if (isNaN(parsedId)) return { authorized: false, call: null };

    const [rows] = await pool.query(
      'SELECT id, caller_id, receiver_id, status FROM video_calls WHERE id = ? LIMIT 1',
      [parsedId]
    );

    if (rows.length === 0) return { authorized: false, call: null };

    const call = rows[0];
    const isParticipant =
      Number(call.caller_id) === Number(userId) ||
      Number(call.receiver_id) === Number(userId);

    return { authorized: isParticipant, call };
  };

  /**
   * 1. Join Call Room: 'call:<callId>'
   */
  socket.on('call:join', async (data, callback) => {
    try {
      const callId = data?.callId;
      const { authorized, call } = await verifyCallParticipant(callId);

      if (!authorized || !call) {
        const errMsg = 'Unauthorized to join this call room.';
        if (typeof callback === 'function') callback({ success: false, message: errMsg });
        socket.emit('call:error', { callId, message: errMsg });
        socket.emit('error', { message: errMsg });
        return;
      }

      const roomName = `call:${call.id}`;
      socket.join(roomName);

      // Clear any pending disconnect grace timer for this user
      cancelCallGraceTimer(call.id, userId);

      // Track call room on socket data for disconnect cleanup
      socket.activeCallId = call.id;

      const isCaller = Number(call.caller_id) === Number(userId);
      const role = isCaller ? 'caller' : 'receiver';

      if (typeof callback === 'function') {
        callback({
          success: true,
          callId: call.id,
          role,
          status: call.status,
        });
      }

      socket.emit('call:joined', {
        callId: call.id,
        role,
        status: call.status,
      });

      // Notify peer that other participant has joined or reconnected
      socket.to(roomName).emit('call:peer-joined', {
        callId: call.id,
        peerId: userId,
        role,
      });
      socket.to(roomName).emit('call:peer-reconnected', {
        callId: call.id,
        peerId: userId,
        role,
      });
    } catch (err) {
      console.error('[CallSignaling] Error on call:join:', err.message);
      if (typeof callback === 'function') callback({ success: false, message: err.message });
    }
  });

  /**
   * 2. WebRTC Offer Relay
   */
  socket.on('call:offer', async (data) => {
    try {
      const { callId, sdp, iceRestart } = data || {};
      if (!callId || !sdp) return;

      const { authorized, call } = await verifyCallParticipant(callId);
      if (!authorized || !call) {
        socket.emit('call:error', { callId, message: 'Unauthorized signaling action' });
        return;
      }

      const roomName = `call:${call.id}`;
      socket.to(roomName).emit('call:offer', {
        callId: call.id,
        sdp,
        senderId: userId,
        iceRestart: Boolean(iceRestart),
      });
    } catch (err) {
      console.error('[CallSignaling] Error on call:offer:', err.message);
    }
  });

  /**
   * 3. WebRTC Answer Relay
   */
  socket.on('call:answer', async (data) => {
    try {
      const { callId, sdp } = data || {};
      if (!callId || !sdp) return;

      const { authorized, call } = await verifyCallParticipant(callId);
      if (!authorized || !call) {
        socket.emit('call:error', { callId, message: 'Unauthorized signaling action' });
        return;
      }

      const roomName = `call:${call.id}`;
      socket.to(roomName).emit('call:answer', {
        callId: call.id,
        sdp,
        senderId: userId,
      });
    } catch (err) {
      console.error('[CallSignaling] Error on call:answer:', err.message);
    }
  });

  /**
   * 4. WebRTC ICE Candidate Relay
   */
  socket.on('call:ice-candidate', async (data) => {
    try {
      const { callId, candidate } = data || {};
      if (!callId || !candidate) return;

      const { authorized, call } = await verifyCallParticipant(callId);
      if (!authorized || !call) {
        socket.emit('call:error', { callId, message: 'Unauthorized signaling action' });
        return;
      }

      const roomName = `call:${call.id}`;
      socket.to(roomName).emit('call:ice-candidate', {
        callId: call.id,
        candidate,
        senderId: userId,
      });
    } catch (err) {
      console.error('[CallSignaling] Error on call:ice-candidate:', err.message);
    }
  });

  /**
   * 5. Call End via Socket
   */
  socket.on('call:end', async (data) => {
    try {
      const callId = data?.callId || socket.activeCallId;
      if (!callId) return;

      cancelCallGraceTimer(callId, userId);

      await getCallService().endCall({
        callId,
        userId,
        endReason: data?.reason || 'ended',
      });

      socket.leave(`call:${callId}`);
      delete socket.activeCallId;
    } catch (err) {
      console.error('[CallSignaling] Error on call:end:', err.message);
    }
  });

  /**
   * 6. Socket Disconnect Cleanup with 25s Grace Period
   */
  socket.on('disconnect', async () => {
    try {
      if (socket.activeCallId) {
        const callId = socket.activeCallId;
        delete socket.activeCallId;

        // Fetch call status
        const [rows] = await pool.query(
          'SELECT status, caller_id, receiver_id FROM video_calls WHERE id = ? LIMIT 1',
          [callId]
        );

        if (rows.length > 0 && ['RINGING', 'ACCEPTED'].includes(rows[0].status)) {
          const roomName = `call:${callId}`;
          const graceKey = `${callId}:${userId}`;
          cancelCallGraceTimer(callId, userId);

          // Notify peer that this participant is reconnecting
          socket.to(roomName).emit('call:peer-reconnecting', {
            callId,
            peerId: userId,
            timeoutSeconds: 25,
          });

          const timer = setTimeout(async () => {
            callGraceTimers.delete(graceKey);
            try {
              console.log(`[CallSignaling] Grace period expired for user ${userId} in call ${callId}. Ending call.`);
              await getCallService().endCall({
                callId,
                userId,
                endReason: 'disconnect',
              }).catch(() => {});
            } catch (graceErr) {
              console.error('[CallSignaling] Error ending call on grace expiry:', graceErr);
            }
          }, 25000);

          callGraceTimers.set(graceKey, timer);
        }
      }
    } catch (err) {
      console.error('[CallSignaling] Disconnect cleanup error:', err.message);
    }
  });
};

module.exports = {
  registerCallSignaling,
};
