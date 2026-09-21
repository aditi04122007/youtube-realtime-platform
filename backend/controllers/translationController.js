const { pool } = require('../config/db');
const { SUPPORTED_LANGUAGES, isValidLanguageCode, getLanguageByCode } = require('../utils/languageConfig');
const { translationService, generateContentHash } = require('../services/translationService');

/**
 * Validate video access permissions (matches Phase 9, 11, 12 rules)
 */
const checkVideoAccess = async (videoId, user) => {
  const [rows] = await pool.query(
    `SELECT id, user_id, visibility, status
     FROM videos
     WHERE id = ? AND status != 'DELETED'
     LIMIT 1`,
    [videoId]
  );

  if (rows.length === 0) {
    const error = new Error('Video not found');
    error.status = 404;
    throw error;
  }

  const video = rows[0];
  const isOwner = user && (user.id === video.user_id || user.role === 'ADMIN');

  if (video.visibility === 'PRIVATE' && !isOwner) {
    const error = new Error('This video is private');
    error.status = 403;
    throw error;
  }

  if (video.status === 'PROCESSING' && !isOwner) {
    const error = new Error('This video is currently processing');
    error.status = 403;
    throw error;
  }

  return video;
};

/**
 * GET /api/translations/languages
 * Return centralized list of supported languages
 */
const getSupportedLanguages = (req, res) => {
  return res.status(200).json({
    success: true,
    languages: SUPPORTED_LANGUAGES,
  });
};

/**
 * POST /api/comments/:commentId/translate
 * Translate comment or reply with caching and SHA-256 hash validation
 * Body: { targetLanguage: 'hi', sourceLanguage?: 'en' }
 */
const translateComment = async (req, res, next) => {
  try {
    const commentId = parseInt(req.params.commentId, 10);
    if (isNaN(commentId) || commentId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID' });
    }

    const { targetLanguage, sourceLanguage } = req.body;

    if (!targetLanguage || typeof targetLanguage !== 'string') {
      return res.status(400).json({ success: false, message: 'Target language is required' });
    }

    const normalizedTarget = targetLanguage.trim().toLowerCase();
    if (!isValidLanguageCode(normalizedTarget)) {
      return res.status(400).json({ success: false, message: 'Unsupported target language' });
    }

    const normalizedSource = sourceLanguage && typeof sourceLanguage === 'string'
      ? sourceLanguage.trim().toLowerCase()
      : null;

    if (normalizedSource && !isValidLanguageCode(normalizedSource)) {
      return res.status(400).json({ success: false, message: 'Unsupported source language' });
    }

    // 1. Fetch comment
    const [cRows] = await pool.query(
      `SELECT id, video_id, content, status 
       FROM comments 
       WHERE id = ? 
       LIMIT 1`,
      [commentId]
    );

    if (cRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const comment = cRows[0];

    const isOwner = req.user && Number(req.user.id) === Number(comment.user_id);
    const isAdmin = req.user && req.user.role === 'ADMIN';

    if (comment.status === 'DELETED') {
      return res.status(400).json({ success: false, message: 'Cannot translate a deleted comment' });
    }
    if (comment.status === 'REMOVED' || (comment.status === 'HIDDEN' && !isOwner && !isAdmin)) {
      return res.status(403).json({ success: false, message: 'This comment is unavailable for translation' });
    }

    // 2. Validate video visibility and access
    await checkVideoAccess(comment.video_id, req.user);

    // 3. Generate content hash of current comment
    const currentHash = generateContentHash(comment.content);

    // 4. Check MySQL translation cache
    const [cacheRows] = await pool.query(
      `SELECT source_language, target_language, translated_content, provider, source_content_hash
       FROM comment_translations
       WHERE comment_id = ? AND target_language = ?
       LIMIT 1`,
      [commentId, normalizedTarget]
    );

    if (cacheRows.length > 0) {
      const cached = cacheRows[0];
      // Verify hash matches so edited comments don't return stale translations
      if (cached.source_content_hash === currentHash) {
        return res.status(200).json({
          success: true,
          message: 'Comment translated successfully',
          translation: {
            commentId,
            sourceLanguage: cached.source_language,
            targetLanguage: cached.target_language,
            originalContent: comment.content,
            translatedContent: cached.translated_content,
            cached: true,
            provider: cached.provider,
          },
        });
      }
    }

    // 5. Call translation provider
    const result = await translationService.translateText({
      text: comment.content,
      sourceLanguage: normalizedSource,
      targetLanguage: normalizedTarget,
    });

    // 6. Save or update cache in comment_translations
    await pool.query(
      `INSERT INTO comment_translations 
        (comment_id, target_language, source_language, translated_content, provider, source_content_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
        translated_content = VALUES(translated_content),
        source_language = VALUES(source_language),
        provider = VALUES(provider),
        source_content_hash = VALUES(source_content_hash),
        updated_at = NOW()`,
      [
        commentId,
        normalizedTarget,
        result.sourceLanguage || null,
        result.translatedText,
        result.provider || null,
        currentHash,
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Comment translated successfully',
      translation: {
        commentId,
        sourceLanguage: result.sourceLanguage,
        targetLanguage: result.targetLanguage,
        originalContent: comment.content,
        translatedContent: result.translatedText,
        cached: false,
        provider: result.provider,
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        code: err.code || undefined,
      });
    }
    next(err);
  }
};

/**
 * GET /api/comments/:commentId/translation?targetLanguage=hi
 * Query cached translation without triggering a provider call
 */
const getCachedTranslation = async (req, res, next) => {
  try {
    const commentId = parseInt(req.params.commentId, 10);
    if (isNaN(commentId) || commentId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID' });
    }

    const { targetLanguage } = req.query;
    if (!targetLanguage || !isValidLanguageCode(targetLanguage)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing target language' });
    }

    const normalizedTarget = targetLanguage.trim().toLowerCase();

    const [cRows] = await pool.query(
      `SELECT id, video_id, content, status 
       FROM comments 
       WHERE id = ? 
       LIMIT 1`,
      [commentId]
    );

    if (cRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const comment = cRows[0];
    await checkVideoAccess(comment.video_id, req.user);

    const isOwner = req.user && Number(req.user.id) === Number(comment.user_id);
    const isAdmin = req.user && req.user.role === 'ADMIN';

    if (comment.status === 'DELETED') {
      return res.status(400).json({ success: false, message: 'Cannot translate a deleted comment' });
    }
    if (comment.status === 'REMOVED' || (comment.status === 'HIDDEN' && !isOwner && !isAdmin)) {
      return res.status(403).json({ success: false, message: 'This comment is unavailable for translation' });
    }

    const currentHash = generateContentHash(comment.content);

    const [cacheRows] = await pool.query(
      `SELECT source_language, target_language, translated_content, provider, source_content_hash
       FROM comment_translations
       WHERE comment_id = ? AND target_language = ?
       LIMIT 1`,
      [commentId, normalizedTarget]
    );

    if (cacheRows.length > 0 && cacheRows[0].source_content_hash === currentHash) {
      const cached = cacheRows[0];
      return res.status(200).json({
        success: true,
        translated: true,
        translation: {
          commentId,
          sourceLanguage: cached.source_language,
          targetLanguage: cached.target_language,
          originalContent: comment.content,
          translatedContent: cached.translated_content,
          cached: true,
          provider: cached.provider,
        },
      });
    }

    return res.status(200).json({
      success: true,
      translated: false,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

module.exports = {
  getSupportedLanguages,
  translateComment,
  getCachedTranslation,
  checkVideoAccess,
};
