/**
 * Formats a date or timestamp into a relative human-readable string.
 *
 * Examples:
 *   "just now"
 *   "15 minutes ago"
 *   "2 hours ago"
 *   "3 days ago"
 *   "2 weeks ago"
 *   "4 months ago"
 *   "1 year ago"
 *
 * @param {string|number|Date} dateInput - The date to format
 * @returns {string} - Relative time string
 */
export const timeAgo = (dateInput) => {
  if (!dateInput) return '';

  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 30) {
    return 'just now';
  }

  if (seconds < 60) {
    return `${seconds} seconds ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }

  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
};

/**
 * Format video duration in seconds to standard MM:SS or HH:MM:SS format
 *
 * @param {number|string} secondsInput - Duration in seconds
 * @returns {string} Formatted duration (e.g. "04:15", "01:23:45")
 */
export const formatDuration = (secondsInput) => {
  const totalSeconds = parseInt(secondsInput, 10);
  if (isNaN(totalSeconds) || totalSeconds <= 0) return '0:00';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const paddedSeconds = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const paddedMinutes = String(minutes).padStart(2, '0');
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${minutes}:${paddedSeconds}`;
};

export default timeAgo;
