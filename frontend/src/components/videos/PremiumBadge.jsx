import React from 'react';
import { Crown, Sparkles } from 'lucide-react';

/**
 * Premium badge component displaying tier indicator with crown icon
 *
 * @param {string} plan - Minimum required plan or badge label (e.g. 'PREMIUM', 'BRONZE', 'SILVER', 'GOLD')
 * @param {string} size - 'xs' | 'sm' | 'md'
 * @param {boolean} showText - Whether to display the text label
 * @param {string} className - Additional CSS classes
 */
const PremiumBadge = ({
  plan = 'PREMIUM',
  size = 'xs',
  showText = true,
  className = '',
}) => {
  const normalized = String(plan || 'PREMIUM').toUpperCase();

  // Tier-specific styles
  const tierStyles = {
    GOLD: 'from-amber-400 via-amber-500 to-yellow-500 text-slate-950 border-amber-300/40 shadow-amber-500/20',
    SILVER: 'from-slate-300 via-slate-200 to-indigo-200 text-slate-900 border-slate-300/40 shadow-slate-400/20',
    BRONZE: 'from-amber-600 via-orange-600 to-amber-700 text-white border-amber-500/40 shadow-orange-500/20',
    PREMIUM: 'from-amber-500 via-amber-600 to-orange-500 text-white border-amber-400/30 shadow-amber-500/20',
  };

  const currentStyle = tierStyles[normalized] || tierStyles.PREMIUM;

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5 space-x-1 rounded-md',
    sm: 'text-xs px-2.5 py-1 space-x-1.5 rounded-lg',
    md: 'text-sm px-3 py-1.5 space-x-2 rounded-xl',
  };

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  };

  return (
    <span
      className={`inline-flex items-center font-bold tracking-wider uppercase bg-gradient-to-r shadow-sm border backdrop-blur-sm ${currentStyle} ${sizeClasses[size] || sizeClasses.xs} ${className}`}
      title={`Requires ${normalized} tier or higher`}
    >
      <Crown className={`${iconSizes[size] || iconSizes.xs} fill-current flex-shrink-0`} />
      {showText && <span>{normalized}</span>}
    </span>
  );
};

export default PremiumBadge;
