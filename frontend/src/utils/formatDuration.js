/**
 * Formats a duration in seconds into a standard YouTube-style time string (M:SS or H:MM:SS)
 *
 * Safely handles NaN, Infinity, null, undefined, and negative values.
 *
 * Examples:
 *   formatDuration(5)     => "0:05"
 *   formatDuration(65)    => "1:05"
 *   formatDuration(3665)  => "1:01:05"
 *   formatDuration(null)  => "0:00"
 *   formatDuration(NaN)   => "0:00"
 *
 * @param {number|string|null|undefined} secondsInput - Duration in seconds
 * @returns {string} - Formatted duration string
 */
export const formatDuration = (secondsInput) => {
  if (
    secondsInput === null ||
    secondsInput === undefined ||
    typeof secondsInput === 'boolean'
  ) {
    return '0:00';
  }

  const parsed = Number(secondsInput);

  if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(parsed);
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

export default formatDuration;
