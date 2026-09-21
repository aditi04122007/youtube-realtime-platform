const express = require('express');
const router = express.Router();
const { getHomeFeed, getCategories } = require('../controllers/homeController');

// GET /api/home
router.get('/', getHomeFeed);

// GET /api/home/feed (alias)
router.get('/feed', getHomeFeed);

// GET /api/home/categories
router.get('/categories', getCategories);

module.exports = router;
