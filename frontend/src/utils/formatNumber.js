/**
 * Formats numeric metrics (views, subscribers, likes) into compact human-readable strings.
 *
 * Examples:
 *   999        -> "999"
 *   1200       -> "1.2K"
 *   15000      -> "15K"
 *   1200000    -> "1.2M"
 *   1500000000 -> "1.5B"
 *
 * @param {number|string} num - The number to format
 * @returns {string} - Formatted compact number string
 */
export const formatNumber = (num) => {
  if (num === null || num === undefined || isNaN(Number(num))) {
    return '0';
  }

  const value = Math.abs(Number(num));

  if (value < 1000) {
    return String(Math.floor(value));
  }

  if (value < 1000000) {
    const k = value / 1000;
    // Show one decimal place if < 10K, else integer
    return k < 10 ? `${k.toFixed(1).replace(/\.0$/, '')}K` : `${Math.floor(k)}K`;
  }

  if (value < 1000000000) {
    const m = value / 1000000;
    return m < 10 ? `${m.toFixed(1).replace(/\.0$/, '')}M` : `${Math.floor(m)}M`;
  }

  const b = value / 1000000000;
  return b < 10 ? `${b.toFixed(1).replace(/\.0$/, '')}B` : `${Math.floor(b)}B`;
};

export default formatNumber;
