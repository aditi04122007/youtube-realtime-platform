import api from './api';

/**
 * Fetch supported languages for translation
 * GET /api/translations/languages
 * @returns {Promise<{success: boolean, languages: Array<{code: string, name: string, nativeName: string, flag: string}>}>}
 */
export const getSupportedLanguages = async () => {
  const response = await api.get('/translations/languages');
  return response.data;
};

/**
 * Translate a comment or nested reply to a target language
 * POST /api/comments/:commentId/translate
 * @param {number|string} commentId
 * @param {string} targetLanguage - ISO language code (e.g. 'hi', 'es')
 * @param {string} [sourceLanguage] - Optional ISO source language code
 * @returns {Promise<{success: boolean, translation: Object}>}
 */
export const translateComment = async (commentId, targetLanguage, sourceLanguage = null) => {
  const payload = { targetLanguage };
  if (sourceLanguage) {
    payload.sourceLanguage = sourceLanguage;
  }
  const response = await api.post(`/comments/${commentId}/translate`, payload);
  return response.data;
};

/**
 * Check if a cached translation exists for a comment
 * GET /api/comments/:commentId/translation?targetLanguage=:code
 * @param {number|string} commentId
 * @param {string} targetLanguage
 * @returns {Promise<{success: boolean, translated: boolean, translation?: Object}>}
 */
export const getCachedTranslation = async (commentId, targetLanguage) => {
  const response = await api.get(`/comments/${commentId}/translation`, {
    params: { targetLanguage },
  });
  return response.data;
};
