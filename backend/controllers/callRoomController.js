const callRoomService = require('../services/callRoomService');

/**
 * POST /api/call-rooms
 * Create a new one-to-one or group call room
 */
const createRoom = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { roomType, maxParticipants } = req.body || {};

    const room = await callRoomService.createRoom({
      userId,
      roomType,
      maxParticipants,
    });

    return res.status(201).json({
      success: true,
      message: 'Call room created successfully',
      room,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};

/**
 * GET /api/call-rooms/:roomCode
 * Fetch room metadata and status
 */
const getRoom = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { roomCode } = req.params;

    const room = await callRoomService.getRoomByCode(roomCode, userId);

    return res.status(200).json({
      success: true,
      room,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};

/**
 * POST /api/call-rooms/:roomCode/join
 * Join an active or waiting call room
 */
const joinRoom = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { roomCode } = req.params;

    const result = await callRoomService.joinRoom({
      roomCode,
      userId,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};

/**
 * POST /api/call-rooms/:roomCode/leave
 * Leave a call room
 */
const leaveRoom = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { roomCode } = req.params;

    const result = await callRoomService.leaveRoom({
      roomCode,
      userId,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};

/**
 * POST /api/call-rooms/:roomCode/end
 * Host ends call room for all participants
 */
const endRoom = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { roomCode } = req.params;

    const result = await callRoomService.endRoom({
      roomCode,
      userId,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};

/**
 * GET /api/call-rooms/:roomCode/participants
 * List active joined participants (authorized members only)
 */
const getParticipants = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { roomCode } = req.params;

    const result = await callRoomService.getRoomParticipants(roomCode, userId);

    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};

/**
 * POST /api/call-rooms/:roomCode/invite
 * Host invites a user to the room
 */
const inviteUser = async (req, res, next) => {
  try {
    const hostUserId = req.user.id;
    const { roomCode } = req.params;
    const targetUserId = req.body?.userId || req.body?.inviteeId || req.body?.targetUserId;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target userId or inviteeId is required to invite.',
      });
    }

    const result = await callRoomService.inviteUser({
      roomCode,
      hostUserId,
      targetUserId,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};

module.exports = {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  endRoom,
  getParticipants,
  inviteUser,
};
