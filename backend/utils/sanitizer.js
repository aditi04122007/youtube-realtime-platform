/**
 * StreamWave Security Sanitization Utilities (Phase 30)
 * Protects against Stored XSS, HTML injection, dangerous URL schemes, and SQL wildcard attacks.
 */

// Regex matching HTML script, iframe, object, embed, style, and general tags
const DANGEROUS_TAGS_REGEX = /<\/?(script|iframe|object|embed|style|applet|meta|link|base|form|input|button)\b[^>]*>/gi;
const INLINE_EVENT_REGEX = /\bon\w+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi;
const DANGEROUS_SCHEMES_REGEX = /(javascript|vbscript|data):/gi;

/**
 * Strips executable HTML tags, inline event handlers, and dangerous protocols from user text.
 * Preserves clean text content and normal punctuation.
 *
 * @param {string} input - Raw user input string
 * @param {number} [maxLength=5000] - Optional maximum allowed character length
 * @returns {string} Sanitized string
 */
function sanitizeText(input, maxLength = 5000) {
  if (input === null || input === undefined) return '';
  if (typeof input !== 'string') input = String(input);

  let cleaned = input
    // Remove dangerous block tags including their inner content for script and style
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove other dangerous tags
    .replace(DANGEROUS_TAGS_REGEX, '')
    // Remove inline event handlers (e.g. onerror=..., onload=...)
    .replace(INLINE_EVENT_REGEX, '')
    // Remove dangerous URI schemes (e.g. javascript:...)
    .replace(DANGEROUS_SCHEMES_REGEX, '')
    // Strip null bytes and control characters (excluding newline \n and tab \t)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();

  if (typeof maxLength === 'number' && maxLength > 0 && cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
  }

  return cleaned;
}

/**
 * Validates and sanitizes a URL.
 * Only allows HTTP, HTTPS, or safe relative paths.
 * Strictly blocks javascript:, data:, vbscript:, and protocol-relative (//) URLs.
 *
 * @param {string} url - Raw URL string
 * @returns {string|null} Safe URL or null if invalid/dangerous
 */
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (trimmed === '') return null;

  // Block protocol-relative URLs (e.g. //attacker.com) and backslash traversal
  if (trimmed.startsWith('//') || trimmed.includes('\\')) {
    return null;
  }

  // Allow safe relative paths (e.g. /uploads/..., /watch/...)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  // Check absolute URLs
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();

    if (protocol === 'http:' || protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    // Malformed URL
    return null;
  }
}

/**
 * Escapes MySQL LIKE wildcards (% and _) in user queries.
 * Ensures parameterized SQL queries using LIKE ? do not treat user input as wildcards.
 *
 * @param {string} str - Raw query term
 * @returns {string} Safe string with escaped wildcards
 */
function escapeLikeWildcards(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/([%_\\])/g, '\\$1');
}

module.exports = {
  sanitizeText,
  sanitizeUrl,
  escapeLikeWildcards,
};
