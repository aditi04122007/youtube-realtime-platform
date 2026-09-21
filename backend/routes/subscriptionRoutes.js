const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getSubscriptionPlans,
  getCurrentSubscription,
  changeSubscription,
  getSubscriptionHistory,
  getSubscriptionDashboard,
  updateAutoRenew,
} = require('../controllers/subscriptionController');

// Public endpoints
// GET /api/subscriptions/plans (also alias at root GET /api/subscriptions)
router.get('/plans', getSubscriptionPlans);
router.get('/', getSubscriptionPlans);

// Authenticated user endpoints
router.get('/dashboard', authMiddleware, getSubscriptionDashboard);
router.get('/current', authMiddleware, getCurrentSubscription);
router.put('/auto-renew', authMiddleware, updateAutoRenew);
router.post('/change', authMiddleware, changeSubscription);
router.get('/history', authMiddleware, getSubscriptionHistory);

module.exports = router;
