const config = require('../../config');

/**
 * LibreTranslate Provider Implementation
 * Dispatches translation requests to a LibreTranslate compliant server.
 */
class LibreTranslateProvider {
  constructor() {
    this.name = 'libretranslate';
  }

  async translate({ text, sourceLanguage = 'auto', targetLanguage }) {
    const { apiUrl, apiKey, timeoutMs } = config.translation;

    if (!apiUrl) {
      const error = new Error('LibreTranslate API URL is not configured.');
      error.status = 503;
      error.code = 'PROVIDER_NOT_CONFIGURED';
      throw error;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs || 10000);

    try {
      const url = apiUrl.replace(/\/+$/, '') + '/translate';
      const payload = {
        q: text,
        source: sourceLanguage || 'auto',
        target: targetLanguage,
        format: 'text',
      };

      if (apiKey) {
        payload.api_key = apiKey;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.error(`[LibreTranslate Error] HTTP ${response.status}:`, errorBody);
        const error = new Error('Translation service is temporarily unavailable.');
        error.status = response.status === 429 ? 429 : 502;
        error.code = response.status === 429 ? 'PROVIDER_RATE_LIMIT' : 'PROVIDER_ERROR';
        throw error;
      }

      const data = await response.json();

      if (!data || typeof data.translatedText !== 'string') {
        const error = new Error('Invalid response received from translation provider.');
        error.status = 502;
        throw error;
      }

      let detectedSource = null;
      if (data.detectedLanguage && typeof data.detectedLanguage.language === 'string') {
        detectedSource = data.detectedLanguage.language;
      }

      return {
        translatedText: data.translatedText,
        sourceLanguage: detectedSource || (sourceLanguage !== 'auto' ? sourceLanguage : null),
        targetLanguage,
        provider: this.name,
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        const error = new Error('Translation request timed out.');
        error.status = 504;
        error.code = 'TIMEOUT';
        throw error;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

module.exports = new LibreTranslateProvider();
