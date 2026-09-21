import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Crown, Sparkles, LogIn, CreditCard, RefreshCw, AlertCircle } from 'lucide-react';
import Button from '../common/Button';
import PremiumBadge from './PremiumBadge';
import { getMediaUrl } from '../../services/api';

/**
 * PremiumAccessGate
 * Displayed in place of the VideoPlayer when the user does not have permission
 * to stream a premium video (guest, free tier, or insufficient subscription rank).
 *
 * @param {Object} video - Full video object with access metadata
 * @param {Function} onRefresh - Callback to re-check access state
 */
const PremiumAccessGate = ({ video, onRefresh }) => {
  const [refreshing, setRefreshing] = useState(false);

  if (!video) return null;

  const access = video.access || {};
  const isGuest = Boolean(access.requiresAuth);
  const minPlan = access.minimumPlanCode || video.minimum_plan_code || 'BRONZE';
  const planName = access.minimumPlanName || (minPlan.charAt(0).toUpperCase() + minPlan.slice(1).toLowerCase());
  const posterUrl = video.thumbnail_url ? getMediaUrl(video.thumbnail_url) : null;

  const handleRefresh = async () => {
    if (typeof onRefresh === 'function') {
      try {
        setRefreshing(true);
        await onRefresh();
      } finally {
        setTimeout(() => setRefreshing(false), 600);
      }
    }
  };

  return (
    <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center p-6 text-center select-none">
      {/* 1. Blurred Background Poster */}
      {posterUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-xl scale-110 opacity-25"
          style={{ backgroundImage: `url(${posterUrl})` }}
        />
      )}

      {/* 2. Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-900/60" />
      <div className="absolute inset-0 bg-radial from-amber-500/10 via-transparent to-transparent opacity-40" />

      {/* 3. Centered Content Card */}
      <div className="relative z-10 max-w-lg mx-auto flex flex-col items-center space-y-4 px-4">
        {/* Glow Crown Icon */}
        <div className="relative">
          <div className="absolute -inset-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full blur-md opacity-50 animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-0.5 shadow-xl flex items-center justify-center text-slate-950">
            <div className="w-full h-full bg-slate-900/90 rounded-[14px] flex items-center justify-center">
              <Crown className="w-8 h-8 text-amber-400 fill-amber-400/20" />
            </div>
          </div>
        </div>

        {/* Badge & Title */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-center space-x-2">
            <PremiumBadge plan={minPlan} size="sm" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
              Exclusive Content
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Premium Video Access Required
          </h2>
        </div>

        {/* Dynamic Explanation */}
        <p className="text-xs sm:text-sm text-slate-300 max-w-md leading-relaxed">
          {isGuest ? (
            <>
              This video is reserved for subscribers. Sign in to your StreamWave account and choose a plan to unlock instant streaming.
            </>
          ) : (
            <>
              This video requires an active <strong className="text-amber-400 font-semibold">{planName} Plan</strong> (or higher). Upgrade your subscription to start watching right away.
            </>
          )}
        </p>

        {/* Call to Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {isGuest ? (
            <>
              <Link to={`/login?redirect=/watch/${video.id}`} className="w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="md"
                  icon={<LogIn className="w-4 h-4" />}
                  className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold border-none shadow-lg shadow-amber-500/20"
                >
                  Sign In to Watch
                </Button>
              </Link>
              <Link to="/pricing" className="w-full sm:w-auto">
                <Button
                  variant="secondary"
                  size="md"
                  icon={<CreditCard className="w-4 h-4" />}
                  className="w-full sm:w-auto text-slate-200 border-slate-700 bg-slate-900/80 hover:bg-slate-800"
                >
                  Explore Plans
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/subscription-dashboard" className="w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="md"
                  icon={<CreditCard className="w-4 h-4" />}
                  className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold border-none shadow-lg shadow-amber-500/20"
                >
                  Upgrade Subscription
                </Button>
              </Link>
              {onRefresh && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  icon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
                  className="w-full sm:w-auto text-slate-200 border-slate-700 bg-slate-900/80 hover:bg-slate-800"
                >
                  {refreshing ? 'Checking...' : 'Check Access'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PremiumAccessGate;
