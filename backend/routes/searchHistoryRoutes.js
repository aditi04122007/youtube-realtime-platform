const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getSearchHistory,
  addSearchHistory,
  deleteSearchHistoryItem,
  clearSearchHistory,
} = require('../controllers/searchHistoryController');

// All search history routes are strictly protected for the authenticated user
router.use(authMiddleware);

router.get('/', getSearchHistory);
router.post('/', addSearchHistory);
router.delete('/:id', deleteSearchHistoryItem);
router.delete('/', clearSearchHistory);

module.exports = router;
