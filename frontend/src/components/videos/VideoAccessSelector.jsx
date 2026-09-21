import React from 'react';
import { Globe, Crown, ShieldCheck } from 'lucide-react';

/**
 * VideoAccessSelector
 * Allows creators to select monetization / access tier (Free vs Premium)
 * and choose the minimum subscription plan required for playback.
 */
const VideoAccessSelector = ({
  accessType = 'FREE',
  onChangeAccessType,
  minimumPlanCode = 'BRONZE',
  onChangeMinimumPlanCode,
  disabled = false,
}) => {
  const isPremium = accessType === 'PREMIUM';

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
        Access & Monetization Tier
      </label>

      {/* Free vs Premium Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Free Option */}
        <div
          onClick={() => !disabled && onChangeAccessType('FREE')}
          className={`cursor-pointer p-3.5 rounded-2xl border transition-all flex items-start space-x-3 select-none ${
            !isPremium
              ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500/80 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
              !isPremium
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}
          >
            <Globe className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Free Video
              </span>
              {!isPremium && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
              Available to all visitors and registered members without restrictions.
            </p>
          </div>
        </div>

        {/* Premium Option */}
        <div
          onClick={() => !disabled && onChangeAccessType('PREMIUM')}
          className={`cursor-pointer p-3.5 rounded-2xl border transition-all flex items-start space-x-3 select-none ${
            isPremium
              ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-500/80 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
              isPremium
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}
          >
            <Crown className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Premium Video
              </span>
              {isPremium && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
              Exclusive to paying subscribers. Protected backend media streaming.
            </p>
          </div>
        </div>
      </div>

      {/* Minimum Plan Selector (only visible when Premium is active) */}
      {isPremium && (
        <div className="p-3 bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200/60 dark:border-amber-900/40 rounded-2xl space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Minimum Required Subscription Tier
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { code: 'BRONZE', label: 'Bronze Supporter', price: '₹199+' },
              { code: 'SILVER', label: 'Silver Creator', price: '₹499+' },
              { code: 'GOLD', label: 'Gold VIP Only', price: '₹999' },
            ].map((tier) => {
              const selected = minimumPlanCode === tier.code;
              return (
                <button
                  type="button"
                  key={tier.code}
                  disabled={disabled}
                  onClick={() => onChangeMinimumPlanCode(tier.code)}
                  className={`p-2 rounded-xl text-left border transition-all flex flex-col ${
                    selected
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-amber-300'
                  }`}
                >
                  <span className="text-[11px] font-bold">{tier.code}</span>
                  <span className="text-[9px] opacity-80">{tier.price}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoAccessSelector;
