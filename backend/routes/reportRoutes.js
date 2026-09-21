const express = require('express');
const router = express.Router();
const { getReportReasons } = require('../controllers/reportController');

// GET /api/reports/reasons
// Return centralized list of moderation report categories
router.get('/reasons', getReportReasons);

module.exports = router;
