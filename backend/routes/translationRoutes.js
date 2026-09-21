const express = require('express');
const router = express.Router();
const { getSupportedLanguages } = require('../controllers/translationController');

// GET /api/translations/languages
// Retrieve the centralized list of supported languages
router.get('/languages', getSupportedLanguages);

module.exports = router;
