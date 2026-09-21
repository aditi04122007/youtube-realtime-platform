/**
 * Centralized Report Reasons Registry (Phase 14)
 * Source of truth for moderation report categories.
 */

const REPORT_REASONS = [
  {
    code: 'SPAM',
    label: 'Spam or commercial advertising',
    description: 'Repeated unwanted promotional links, ads, or automated spam.',
  },
  {
    code: 'HARASSMENT',
    label: 'Harassment or bullying',
    description: 'Targeted attacks, threats, insults, or harassment directed at individuals.',
  },
  {
    code: 'HATE_OR_ABUSE',
    label: 'Hate speech or abuse',
    description: 'Promoting discrimination, disparagement, or hatred against protected groups.',
  },
  {
    code: 'SEXUAL_CONTENT',
    label: 'Sexually explicit content',
    description: 'Pornography, explicit sexual descriptions, or inappropriate sexual solicitation.',
  },
  {
    code: 'VIOLENCE',
    label: 'Violent or dangerous content',
    description: 'Encouraging violence, self-harm, dangerous activities, or graphic gore.',
  },
  {
    code: 'MISINFORMATION',
    label: 'Misinformation or disinformation',
    description: 'Demonstrably false, misleading, or deceptive health/public safety information.',
  },
  {
    code: 'SCAM_OR_FRAUD',
    label: 'Scam, fraud, or phishing',
    description: 'Financial scams, crypto fraud, phishing links, or impersonation.',
  },
  {
    code: 'PERSONAL_INFORMATION',
    label: 'Private personal information',
    description: 'Sharing private phone numbers, physical addresses, passwords, or personal data without consent.',
  },
  {
    code: 'COPYRIGHT',
    label: 'Copyright violation',
    description: 'Unauthorized distribution of copyrighted materials or proprietary content.',
  },
  {
    code: 'OTHER',
    label: 'Other policy violation',
    description: 'Other violations of platform community standards and terms of service.',
  },
];

const VALID_REASON_CODES = new Set(REPORT_REASONS.map((r) => r.code));

/**
 * Check if a reason code is valid
 * @param {string} code
 * @returns {boolean}
 */
const isValidReportReason = (code) => {
  if (!code || typeof code !== 'string') return false;
  return VALID_REASON_CODES.has(code.trim().toUpperCase());
};

/**
 * Get reason object by code
 * @param {string} code
 * @returns {object|null}
 */
const getReportReasonByCode = (code) => {
  if (!code || typeof code !== 'string') return null;
  const upper = code.trim().toUpperCase();
  return REPORT_REASONS.find((r) => r.code === upper) || null;
};

module.exports = {
  REPORT_REASONS,
  isValidReportReason,
  getReportReasonByCode,
};
