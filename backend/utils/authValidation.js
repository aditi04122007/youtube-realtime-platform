/**
 * Authentication Input Validation Utilities
 */

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates a username
 * @param {string} username
 * @returns {{ isValid: boolean, error?: string, sanitized?: string }}
 */
const validateUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return { isValid: false, error: 'Username is required' };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters long' };
  }

  if (trimmed.length > 30) {
    return { isValid: false, error: 'Username must not exceed 30 characters' };
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Username may only contain letters, numbers, underscores, and hyphens',
    };
  }

  return { isValid: true, sanitized: trimmed };
};

/**
 * Validates and normalizes an email address
 * @param {string} email
 * @returns {{ isValid: boolean, error?: string, normalized?: string }}
 */
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }

  const trimmed = email.trim().toLowerCase();

  if (trimmed.length > 255) {
    return { isValid: false, error: 'Email must not exceed 255 characters' };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true, normalized: trimmed };
};

const { sanitizeText } = require('./sanitizer');

/**
 * Validates a password
 * Requirements: min 8 characters, at least one letter and at least one digit
 * Returns generic security message to avoid exposing implementation details (Phase 30)
 * @param {string} password
 * @returns {{ isValid: boolean, error?: string }}
 */
const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 8 || password.length > 128) {
    return { isValid: false, error: 'Password does not meet security requirements.' };
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasLetter || !hasNumber) {
    return {
      isValid: false,
      error: 'Password does not meet security requirements.',
    };
  }

  return { isValid: true };
};

/**
 * Validates display name (optional)
 * @param {string} displayName
 * @param {string} fallbackUsername
 * @returns {{ isValid: boolean, error?: string, sanitized?: string }}
 */
const validateDisplayName = (displayName, fallbackUsername = '') => {
  if (!displayName || typeof displayName !== 'string' || displayName.trim() === '') {
    return { isValid: true, sanitized: fallbackUsername };
  }

  const clean = sanitizeText(displayName.trim(), 100);

  if (clean.length > 100) {
    return { isValid: false, error: 'Display name must not exceed 100 characters' };
  }

  return { isValid: true, sanitized: clean };
};

module.exports = {
  validateUsername,
  validateEmail,
  validatePassword,
  validateDisplayName,
};
