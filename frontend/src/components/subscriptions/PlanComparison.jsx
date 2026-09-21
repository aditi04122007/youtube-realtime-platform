import React, { useState } from 'react';
import { Check, Sparkles, Crown, Shield, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';
import Button from '../common/Button';

const PLAN_RANKS = {
  FREE: 0,
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const PlanComparison = ({
  plans = [],
  currentPlanCode = 'FREE',
  onSelectPlan,
  isProcessing = false,
}) => {
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'

  const currentRank = PLAN_RANKS[(currentPlanCode || 'FREE').toUpperCase()] ?? 0;

  return (
    <div className="space-y-6">
      {/* Header & Billing Cadence Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Available Membership Plans
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Compare platform features and select the tier that fits your creative workflow.
          </p>
        </div>

        {/* Cadence Switcher */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl self-start sm:self-auto border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              billingCycle === 'monthly'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-cyan-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('yearly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              billingCycle === 'yearly'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-cyan-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Yearly</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Save ~16%
            </span>
          </button>
        </div>
      </div>

      {/* Grid of Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const code = (plan.code || plan.slug || '').toUpperCase();
          const isCurrent = code === (currentPlanCode || 'FREE').toUpperCase();
          const targetRank = PLAN_RANKS[code] ?? 0;
          const isUpgrade = targetRank > currentRank;
          const isDowngrade = targetRank < currentRank;

          const price = billingCycle === 'yearly'
            ? (plan.yearlyPrice || plan.yearly_price || 0)
            : (plan.monthlyPrice || plan.monthly_price || plan.price || 0);

          const isGold = code === 'GOLD';
          const isSilver = code === 'SILVER';
          const isBronze = code === 'BRONZE';

          return (
            <div
              key={plan.id || code}
              className={`relative flex flex-col justify-between rounded-2xl p-6 transition-all duration-200 border ${
                isCurrent
                  ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500/80 shadow-md ring-1 ring-indigo-500/50'
                  : isGold
                  ? 'bg-gradient-to-b from-amber-500/5 to-transparent dark:from-amber-500/10 dark:to-transparent border-amber-400/40 hover:border-amber-400/80 shadow-sm'
                  : 'bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
              }`}
            >
              {/* Popular / VIP Tag */}
              {isSilver && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-sm">
                  Most Popular
                </div>
              )}
              {isGold && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-sm">
                  VIP Elite
                </div>
              )}

              {/* Plan Header */}
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-black text-slate-900 dark:text-white">
                    {plan.name || code}
                  </h4>
                  {isCurrent && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-cyan-400 bg-indigo-100/80 dark:bg-indigo-950/80 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Current
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 min-h-[32px]">
                  {plan.description || `${plan.name} platform tier`}
                </p>

                {/* Price Display */}
                <div className="mt-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                      {code === 'FREE' ? '₹0' : formatCurrency(price)}
                    </span>
                    <span className="text-xs font-medium text-slate-400">
                      {code === 'FREE' ? 'Forever' : billingCycle === 'yearly' ? '/ yr' : '/ mo'}
                    </span>
                  </div>
                  {billingCycle === 'yearly' && code !== 'FREE' && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                      Equivalent to {formatCurrency(Math.round(price / 12))} / month
                    </p>
                  )}
                </div>

                {/* Feature List */}
                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>
                      <strong>
                        {plan.maxVideoUploads === 0 ? 'Unlimited' : plan.maxVideoUploads}
                      </strong>{' '}
                      video uploads
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>
                      <strong>
                        {plan.maxStorageGb === 0 ? 'Unlimited' : `${plan.maxStorageGb} GB`}
                      </strong>{' '}
                      cloud storage
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>
                      <strong>
                        {plan.maxPlaylists === 0 ? 'Unlimited' : plan.maxPlaylists}
                      </strong>{' '}
                      playlists
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>
                      <strong>
                        {plan.downloadLimit === 0 && (isGold || isSilver)
                          ? '100+'
                          : plan.downloadLimit || 'Standard'}
                      </strong>{' '}
                      downloads / mo
                    </span>
                  </div>
                  {plan.prioritySupport && (
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold">
                      <Sparkles className="w-4 h-4 flex-shrink-0" />
                      <span>24/7 VIP Priority Support</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                {isCurrent ? (
                  <Button
                    disabled
                    variant="outline"
                    className="w-full text-xs font-bold cursor-default opacity-70"
                  >
                    Current Active Plan
                  </Button>
                ) : isUpgrade ? (
                  <Button
                    variant={isGold ? 'primary' : 'primary'}
                    onClick={() => onSelectPlan({ plan, billingCycle, actionType: 'UPGRADE' })}
                    disabled={isProcessing}
                    className={`w-full text-xs font-bold ${
                      isGold
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black'
                        : ''
                    }`}
                  >
                    Upgrade to {plan.name}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => onSelectPlan({ plan, billingCycle, actionType: 'DOWNGRADE' })}
                    disabled={isProcessing}
                    className="w-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    Downgrade
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlanComparison;
