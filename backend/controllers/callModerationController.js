const callModerationService = require('../services/callModerationService');

/**
 * POST /api/call-rooms/:roomCode/participants/:targetUserId/mute
 * or POST /api/call-rooms/:roomCode/moderate/mute
 * Host mutes a participant
 */
const muteParticipant = async (req, res, next) => {
  try {
    const moderatorId = req.user.id;
    const { roomCode } = req.params;
    const targetUserId = req.params.targetUserId || req.body?.userId || req.body?.targetUserId;
    const reason = req.body?.reason;

    const result = await callModerationService.muteParticipant({
      roomCode,
      moderatorId,
      targetUserId,
      reason,
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
 * POST /api/call-rooms/:roomCode/participants/:targetUserId/unmute
 * or POST /api/call-rooms/:roomCode/moderate/unmute
 * Host unblocks participant microphone
 */
const unmuteParticipant = async (req, res, next) => {
  try {
    const moderatorId = req.user.id;
    const { roomCode } = req.params;
    const targetUserId = req.params.targetUserId || req.body?.userId || req.body?.targetUserId;

    const result = await callModerationService.unmuteParticipant({
      roomCode,
      moderatorId,
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

/**
 * POST /api/call-rooms/:roomCode/participants/:targetUserId/camera-disable
 * or POST /api/call-rooms/:roomCode/moderate/camera-disable
 * Host disables participant camera
 */
const disableCamera = async (req, res, next) => {
  try {
    const moderatorId = req.user.id;
    const { roomCode } = req.params;
    const targetUserId = req.params.targetUserId || req.body?.userId || req.body?.targetUserId;
    const reason = req.body?.reason;

    const result = await callModerationService.disableCamera({
      roomCode,
      moderatorId,
      targetUserId,
      reason,
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
 * POST /api/call-rooms/:roomCode/participants/:targetUserId/camera-enable
 * or POST /api/call-rooms/:roomCode/moderate/camera-enable
 * Host re-enables participant camera permission
 */
const enableCamera = async (req, res, next) => {
  try {
    const moderatorId = req.user.id;
    const { roomCode } = req.params;
    const targetUserId = req.params.targetUserId || req.body?.userId || req.body?.targetUserId;

    const result = await callModerationService.enableCamera({
      roomCode,
      moderatorId,
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

/**
 * POST /api/call-rooms/:roomCode/participants/:targetUserId/remove
 * or POST /api/call-rooms/:roomCode/moderate/remove
 * Host removes participant from room
 */
const removeParticipant = async (req, res, next) => {
  try {
    const moderatorId = req.user.id;
    const { roomCode } = req.params;
    const targetUserId = req.params.targetUserId || req.body?.userId || req.body?.targetUserId;
    const reason = req.body?.reason;

    const result = await callModerationService.removeParticipant({
      roomCode,
      moderatorId,
      targetUserId,
      reason,
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
 * POST /api/call-rooms/:roomCode/participants/:targetUserId/block
 * or POST /api/call-rooms/:roomCode/moderate/block
 * Host blocks participant from rejoining room
 */
const blockParticipant = async (req, res, next) => {
  try {
    const moderatorId = req.user.id;
    const { roomCode } = req.params;
    const targetUserId = req.params.targetUserId || req.body?.userId || req.body?.targetUserId;
    const reason = req.body?.reason;

    const result = await callModerationService.blockParticipant({
      roomCode,
      moderatorId,
      targetUserId,
      reason,
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
 * POST /api/call-rooms/:roomCode/participants/:targetUserId/unblock
 * or POST /api/call-rooms/:roomCode/moderate/unblock
 * Host unblocks participant
 */
const unblockParticipant = async (req, res, next) => {
  try {
    const moderatorId = req.user.id;
    const { roomCode } = req.params;
    const targetUserId = req.params.targetUserId || req.body?.userId || req.body?.targetUserId;

    const result = await callModerationService.unblockParticipant({
      roomCode,
      moderatorId,
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

/**
 * POST /api/call-rooms/:roomCode/report
 * Active participant reports another user in the room
 */
const reportParticipant = async (req, res, next) => {
  try {
    const reporterId = req.user.id;
    const { roomCode } = req.params;
    const { targetUserId, category, reason, details } = req.body || {};

    const result = await callModerationService.reportParticipant({
      roomCode,
      reporterId,
      targetUserId,
      category,
      reason,
      details,
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
 * GET /api/call-rooms/:roomCode/moderation
 * Host fetches room moderation history and active blocks
 */
const getModerationHistory = async (req, res, next) => {
  try {
    const moderatorId = req.user.id;
    const { roomCode } = req.params;

    const result = await callModerationService.getModerationHistory({
      roomCode,
      moderatorId,
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
  muteParticipant,
  unmuteParticipant,
  disableCamera,
  enableCamera,
  removeParticipant,
  blockParticipant,
  unblockParticipant,
  reportParticipant,
  getModerationHistory,
};
