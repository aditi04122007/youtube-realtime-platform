const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
const callService = require('../services/callService');
const {
  startCall,
  acceptCall,
  rejectCall,
  endCall,
  getCallHistory,
  getCallById,
  getIceServers,
} = require('../controllers/callController');

// Rate limiter for call mutations to prevent spam
const callMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many call actions, please slow down.',
  },
});

// All call routes require authentication
router.use(authMiddleware);

// 1. ICE Servers configuration
router.get('/ice-servers', getIceServers);
router.get('/config/ice-servers', getIceServers);

// 2. Call history
router.get('/history', getCallHistory);

// 3. Start a new call
router.post('/', callMutationLimiter, startCall);
router.post('/start', callMutationLimiter, startCall);

// 4. Accept / Reject / End call actions
router.put('/:callId/accept', callMutationLimiter, acceptCall);
router.put('/:callId/reject', callMutationLimiter, rejectCall);
router.put('/:callId/end', callMutationLimiter, endCall);

// 5. Single call session details
router.get('/:callId', getCallById);

// 6. Test trigger for server-side ringing timeout
if (process.env.NODE_ENV !== 'production') {
  router.post('/:callId/timeout', async (req, res, next) => {
    try {
      await callService.handleRingingTimeout(req.params.callId);
      res.json({ success: true, message: 'Ringing timeout handled' });
    } catch (err) {
      next(err);
    }
  });
}

module.exports = router;
