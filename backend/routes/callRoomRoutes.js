const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
const {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  endRoom,
  getParticipants,
  inviteUser,
} = require('../controllers/callRoomController');
const {
  muteParticipant,
  unmuteParticipant,
  disableCamera,
  enableCamera,
  removeParticipant,
  blockParticipant,
  unblockParticipant,
  reportParticipant,
  getModerationHistory,
} = require('../controllers/callModerationController');
const {
  sendMessage,
  getMessages,
  deleteMessage,
  uploadFile,
  downloadFile,
  deleteFile,
  markMessageRead,
} = require('../controllers/callChatController');
const { uploadCallFile } = require('../middleware/callFileUploadMiddleware');

// Rate limiter for room mutations (creation, join, leave, end, invite, moderation)
const roomMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many room actions. Please slow down and try again.',
  },
});

// All room routes require authentication
router.use(authMiddleware);

// 1. Create a call room
router.post('/', roomMutationLimiter, createRoom);

// 2. Room details & status
router.get('/:roomCode', getRoom);

// 3. Join / Leave / End room actions
router.post('/:roomCode/join', roomMutationLimiter, joinRoom);
router.post('/:roomCode/leave', roomMutationLimiter, leaveRoom);
router.post('/:roomCode/end', roomMutationLimiter, endRoom);

// 4. Room participants list
router.get('/:roomCode/participants', getParticipants);

// 5. Host invites participant
router.post('/:roomCode/invite', roomMutationLimiter, inviteUser);

// 6. Phase 25 Moderation endpoints (Host Only) - RESTful participant routing
router.post('/:roomCode/participants/:targetUserId/mute', roomMutationLimiter, muteParticipant);
router.post('/:roomCode/participants/:targetUserId/unmute', roomMutationLimiter, unmuteParticipant);
router.post('/:roomCode/participants/:targetUserId/camera-disable', roomMutationLimiter, disableCamera);
router.post('/:roomCode/participants/:targetUserId/camera-enable', roomMutationLimiter, enableCamera);
router.post('/:roomCode/participants/:targetUserId/remove', roomMutationLimiter, removeParticipant);
router.post('/:roomCode/participants/:targetUserId/block', roomMutationLimiter, blockParticipant);
router.post('/:roomCode/participants/:targetUserId/unblock', roomMutationLimiter, unblockParticipant);

// 7. Phase 25 Moderation endpoints (Host Only) - Action-style routing
router.post('/:roomCode/moderate/mute', roomMutationLimiter, muteParticipant);
router.post('/:roomCode/moderate/unmute', roomMutationLimiter, unmuteParticipant);
router.post('/:roomCode/moderate/camera-disable', roomMutationLimiter, disableCamera);
router.post('/:roomCode/moderate/camera-enable', roomMutationLimiter, enableCamera);
router.post('/:roomCode/moderate/remove', roomMutationLimiter, removeParticipant);
router.post('/:roomCode/moderate/block', roomMutationLimiter, blockParticipant);
router.post('/:roomCode/moderate/unblock', roomMutationLimiter, unblockParticipant);

// 8. Room Moderation History & Ban List
router.get('/:roomCode/moderation', getModerationHistory);

// 9. Phase 25 Abuse Reporting (Any active participant)
router.post('/:roomCode/report', roomMutationLimiter, reportParticipant);

// Rate limiter for in-call chat messages
const chatMessageLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Sending messages too fast. Please slow down and try again.',
  },
});

// Rate limiter for in-call file uploads
const fileUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many file uploads. Please slow down and try again.',
  },
});

// 10. Phase 26 In-Call Chat & Messaging Endpoints
router.get('/:roomCode/messages', getMessages);
router.post('/:roomCode/messages', chatMessageLimiter, sendMessage);
router.delete('/:roomCode/messages/:messageId', deleteMessage);
router.post('/:roomCode/messages/:messageId/read', markMessageRead);

// 11. Phase 26 In-Call File Sharing Endpoints
router.post('/:roomCode/files', fileUploadLimiter, uploadCallFile, uploadFile);
router.get('/:roomCode/files/:fileId', downloadFile);
router.delete('/:roomCode/files/:fileId', deleteFile);

module.exports = router;
