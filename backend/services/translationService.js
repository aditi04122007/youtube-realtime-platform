const crypto = require('crypto');
const config = require('../config');
const libreTranslateProvider = require('./translationProviders/libreTranslateProvider');
const { isValidLanguageCode, getLanguageByCode } = require('../utils/languageConfig');

/**
 * Generate a deterministic SHA-256 hash of the source comment content.
 * Stored in source_content_hash to prevent returning stale translations when comments are edited.
 * @param {string} text - The raw comment text
 * @returns {string} - Hex encoded SHA-256 hash
 */
const generateContentHash = (text) => {
  if (typeof text !== 'string') return '';
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
};

/**
 * High-level Translation Service
 * Dispatches translation requests to the configured provider abstraction.
 */
class TranslationService {
  /**
   * Translates text into targetLanguage
   * @param {object} params
   * @param {string} params.text - The comment content
   * @param {string} [params.sourceLanguage] - Optional source language code
   * @param {string} params.targetLanguage - Required target language code
   * @returns {Promise<{ translatedText: string, sourceLanguage: string|null, targetLanguage: string, provider: string }>}
   */
  async translateText({ text, sourceLanguage, targetLanguage }) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      const error = new Error('Text to translate cannot be empty.');
      error.status = 400;
      throw error;
    }

    if (!targetLanguage || !isValidLanguageCode(targetLanguage)) {
      const error = new Error('Unsupported target language.');
      error.status = 400;
      throw error;
    }

    const normalizedTarget = targetLanguage.trim().toLowerCase();
    const normalizedSource = sourceLanguage ? sourceLanguage.trim().toLowerCase() : null;

    // 1. Same-language shortcut: if source equals target, return original text immediately
    if (normalizedSource && normalizedSource === normalizedTarget) {
      return {
        translatedText: text,
        sourceLanguage: normalizedSource,
        targetLanguage: normalizedTarget,
        provider: 'identity',
      };
    }

    const providerType = (config.translation?.provider || 'development').toLowerCase();

    // 2. Development Mode Handler
    if (providerType === 'development') {
      // If a local API URL is provided, try LibreTranslate; otherwise provide development translation
      if (config.translation?.apiUrl) {
        try {
          return await libreTranslateProvider.translate({
            text,
            sourceLanguage: normalizedSource || 'auto',
            targetLanguage: normalizedTarget,
          });
        } catch (e) {
          // Fall through to dev dictionary if LibreTranslate is unreachable in local dev
        }
      }

      // Built-in development translations dictionary for common words and phrases
      const sampleDict = {
        es: { 'hello': 'hola', 'world': 'mundo', 'video': 'video', 'great': 'genial', 'awesome': 'increíble', 'test': 'prueba', 'comment': 'comentario' },
        fr: { 'hello': 'bonjour', 'world': 'monde', 'video': 'vidéo', 'great': 'super', 'awesome': 'génial', 'test': 'test', 'comment': 'commentaire' },
        de: { 'hello': 'hallo', 'world': 'welt', 'video': 'video', 'great': 'toll', 'awesome': 'großartig', 'test': 'test', 'comment': 'kommentar' },
        hi: { 'hello': 'नमस्ते', 'world': 'दुनिया', 'video': 'वीडियो', 'great': 'शानदार', 'awesome': 'अद्भुत', 'test': 'परीक्षण', 'comment': 'टिप्पणी' },
      };

      const langDict = sampleDict[normalizedTarget];
      let translated = text;
      if (langDict) {
        for (const [en, tr] of Object.entries(langDict)) {
          translated = translated.replace(new RegExp(`\\b${en}\\b`, 'gi'), tr);
        }
      }
      if (translated === text) {
        translated = `[${normalizedTarget.toUpperCase()}] ${text}`;
      }

      return {
        translatedText: translated,
        sourceLanguage: normalizedSource || 'en',
        targetLanguage: normalizedTarget,
        provider: 'development',
      };
    }

    // 3. LibreTranslate Provider
    if (providerType === 'libretranslate') {
      return await libreTranslateProvider.translate({
        text,
        sourceLanguage: normalizedSource || 'auto',
        targetLanguage: normalizedTarget,
      });
    }

    const error = new Error(`Unsupported translation provider: ${providerType}`);
    error.status = 503;
    error.code = 'PROVIDER_NOT_SUPPORTED';
    throw error;
  }
}

module.exports = {
  translationService: new TranslationService(),
  generateContentHash,
};
