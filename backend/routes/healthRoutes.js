const express = require('express');
const router = express.Router();
const { getHealthStatus, getDbHealthStatus } = require('../controllers/healthController');

// GET /api/health
router.get('/', getHealthStatus);

// GET /api/health/db
router.get('/db', getDbHealthStatus);

module.exports = router;
