import React from 'react';
import { Crown, Sparkles, Shield, Zap, RefreshCw, Calendar, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import Button from '../common/Button';

const getPlanBadge = (code) => {
  switch ((code || '').toUpperCase()) {
    case 'GOLD':
      return {
        bg: 'from-amber-500 to-yellow-400 text-slate-950 font-bold',
        badge: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800',
        icon: Crown,
      };
    case 'SILVER':
      return {
        bg: 'from-slate-300 to-slate-100 text-slate-900 font-bold',
        badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800/80 dark:text-slate-200 border border-slate-300 dark:border-slate-700',
        icon: Sparkles,
      };
    case 'BRONZE':
      return {
        bg: 'from-amber-700 to-amber-600 text-white font-bold',
        badge: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900',
        icon: Shield,
      };
    case 'FREE':
    default:
      return {
        bg: 'from-indigo-600 to-cyan-500 text-white font-semibold',
        badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-cyan-300 border border-indigo-200 dark:border-indigo-800',
        icon: Zap,
      };
  }
};

const getStatusBadge = (status) => {
  switch ((status || '').toUpperCase()) {
    case 'ACTIVE':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          ACTIVE
        </span>
      );
    case 'EXPIRED':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <AlertCircle className="w-3.5 h-3.5 mr-1" />
          EXPIRED
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
          <XCircle className="w-3.5 h-3.5 mr-1" />
          CANCELLED
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
          {status || 'PENDING'}
        </span>
      );
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (e) {
    return dateStr;
  }
};

const CurrentPlanCard = ({
  subscription,
  onToggleAutoRenew,
  isTogglingAutoRenew,
  onExplorePlans,
}) => {
  if (!subscription) return null;

  const plan = subscription.plan || {};
  const code = (plan.code || 'FREE').toUpperCase();
  const isFree = code === 'FREE';
  const planStyle = getPlanBadge(code);
  const Icon = planStyle.icon;

  const billingCycleLabel =
    (subscription.billingCycle || 'MONTHLY').toUpperCase() === 'YEARLY'
      ? 'Yearly'
      : 'Monthly';

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-7 transition-all">
      {/* Top Background Gradient Glow */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-gradient-to-br from-indigo-500/10 via-cyan-500/10 to-transparent pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        {/* Left Side: Plan Info & Badges */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className={`p-2.5 rounded-xl bg-gradient-to-tr ${planStyle.bg} shadow-sm`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {plan.name || code}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${planStyle.badge}`}>
                  {code}
                </span>
                {getStatusBadge(subscription.status)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {plan.description || 'Standard platform tier membership'}
              </p>
            </div>
          </div>

          {/* Details Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <div>
              <span className="block text-slate-400 dark:text-slate-500 font-medium">Billing Cadence</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {isFree ? 'Free' : billingCycleLabel}
              </span>
            </div>
            <div>
              <span className="block text-slate-400 dark:text-slate-500 font-medium">Started On</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {formatDate(subscription.startDate)}
              </span>
            </div>
            <div>
              <span className="block text-slate-400 dark:text-slate-500 font-medium">
                {subscription.status === 'EXPIRED' ? 'Expired On' : 'Valid Until / Renews'}
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                {isFree ? 'Lifetime (Free)' : formatDate(subscription.endDate)}
              </span>
            </div>
            <div>
              <span className="block text-slate-400 dark:text-slate-500 font-medium">Payment Provider</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {isFree ? 'None (Platform Free)' : subscription.paymentProvider || 'Razorpay (Test)'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Auto-Renew & Action Buttons */}
        <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between gap-4 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
          {/* Auto-renew switch */}
          {!isFree && (
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 w-full md:w-auto">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Auto-Renew
                    </span>
                    <span
                      className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                        subscription.autoRenew
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {subscription.autoRenew ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 max-w-[200px]">
                    {subscription.autoRenew
                      ? 'Plan is set to renew when period expires.'
                      : 'Plan expires at end date without renewal.'}
                  </p>
                </div>

                <button
                  onClick={() => onToggleAutoRenew(!subscription.autoRenew)}
                  disabled={isTogglingAutoRenew}
                  aria-label="Toggle auto renew"
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    subscription.autoRenew
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 dark:text-rose-300'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {isTogglingAutoRenew ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : subscription.autoRenew ? (
                    'Turn Off'
                  ) : (
                    'Turn On'
                  )}
                </button>
              </div>
            </div>
          )}

          <Button
            size="sm"
            variant="primary"
            onClick={onExplorePlans}
            className="w-full sm:w-auto font-bold"
          >
            {isFree ? 'Upgrade to Premium' : 'Change Plan'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CurrentPlanCard;
