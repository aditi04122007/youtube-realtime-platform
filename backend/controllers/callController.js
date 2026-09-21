const callService = require('../services/callService');

/**
 * POST /api/calls
 * Start a new video call
 * Body: { receiverId: number }
 */
const startCall = async (req, res, next) => {
  try {
    const callerId = req.user.id;
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: 'receiverId is required to start a call.',
      });
    }

    const call = await callService.initiateCall({
      callerId,
      receiverId,
    });

    return res.status(201).json({
      success: true,
      message: 'Call initiated',
      call,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        isBusy: err.isBusy || false,
        callId: err.callId || null,
      });
    }
    next(err);
  }
};

/**
 * PUT /api/calls/:callId/accept
 * Receiver accepts an incoming call
 */
const acceptCall = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { callId } = req.params;

    const call = await callService.acceptCall({
      callId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: 'Call accepted',
      call,
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
 * PUT /api/calls/:callId/reject
 * Receiver rejects an incoming call
 */
const rejectCall = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { callId } = req.params;

    const call = await callService.rejectCall({
      callId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: 'Call rejected',
      call,
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
 * PUT /api/calls/:callId/end
 * Either participant ends an active call
 */
const endCall = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { callId } = req.params;
    const reason = req.body?.endReason || req.body?.reason || 'ended';

    const call = await callService.endCall({
      callId,
      userId,
      endReason: reason,
    });

    return res.status(200).json({
      success: true,
      message: 'Call ended',
      call,
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
 * GET /api/calls/history
 * Fetch authenticated user's call history
 */
const getCallHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page, limit } = req.query;

    const result = await callService.getUserCallHistory({
      userId,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: result.calls,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/calls/:callId
 * Fetch details of a single call session (with IDOR protection)
 */
const getCallById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { callId } = req.params;

    const call = await callService.getCallDetails({
      callId,
      userId,
    });

    return res.status(200).json({
      success: true,
      call,
      data: call,
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
 * GET /api/calls/config/ice-servers
 * Fetch dynamic STUN/TURN server configuration for WebRTC
 */
const getIceServers = async (req, res, next) => {
  try {
    const result = callService.getIceServersConfig();
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  startCall,
  acceptCall,
  rejectCall,
  endCall,
  getCallHistory,
  getCallById,
  getIceServers,
};
