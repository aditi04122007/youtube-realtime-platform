/**
 * Centralized Supported Languages Configuration
 * Used across the translation subsystem to normalize and validate target/source languages.
 */

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
];

const languageMap = new Map(
  SUPPORTED_LANGUAGES.map((lang) => [lang.code.toLowerCase(), lang])
);

/**
 * Checks whether a given language code is supported
 * @param {string} code - ISO-639 language code
 * @returns {boolean}
 */
const isValidLanguageCode = (code) => {
  if (!code || typeof code !== 'string') return false;
  return languageMap.has(code.trim().toLowerCase());
};

/**
 * Retrieves language metadata by code
 * @param {string} code - ISO-639 language code
 * @returns {object|null}
 */
const getLanguageByCode = (code) => {
  if (!code || typeof code !== 'string') return null;
  return languageMap.get(code.trim().toLowerCase()) || null;
};

module.exports = {
  SUPPORTED_LANGUAGES,
  isValidLanguageCode,
  getLanguageByCode,
};
