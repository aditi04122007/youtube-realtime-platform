import React from 'react';
import { CreditCard, Calendar, Clock, CheckCircle2, ShieldCheck, Tag } from 'lucide-react';

const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (e) {
    return dateStr;
  }
};

const BillingCard = ({ subscription }) => {
  if (!subscription) return null;

  const plan = subscription.plan || {};
  const code = (plan.code || 'FREE').toUpperCase();
  const isFree = code === 'FREE';
  const isYearly = (subscription.billingCycle || 'MONTHLY').toUpperCase() === 'YEARLY';

  const planPrice = isYearly
    ? (plan.yearly_price ?? plan.yearlyPrice ?? 0)
    : (plan.monthly_price ?? plan.monthlyPrice ?? plan.price ?? 0);

  return (
    <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-cyan-400">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Billing & Invoicing Summary
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Details for your current billing cycle and renewal
            </p>
          </div>
        </div>

        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 mr-1 text-indigo-500" />
          {isFree ? 'Zero Cost' : 'Razorpay Verified'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pt-5 text-sm">
        {/* Cost & Cadence */}
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            Recurring Rate
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {isFree ? '₹0' : formatCurrency(planPrice)}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {isFree ? 'Forever' : isYearly ? '/ year' : '/ month'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            {isFree ? 'Basic community privileges' : 'Taxes included, billed in INR'}
          </p>
        </div>

        {/* Next Renewal / End Date */}
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {subscription.status === 'EXPIRED' ? 'Expired Date' : 'Next Renewal Date'}
          </span>
          <div className="text-base font-bold text-slate-800 dark:text-slate-200">
            {isFree ? 'No expiration (Active)' : formatDate(subscription.endDate)}
          </div>
          <p className="text-[11px] text-slate-400">
            {isFree
              ? 'Lifetime Free Starter membership'
              : subscription.autoRenew
              ? 'Auto-renewal will take effect on this date'
              : 'Membership ends unless renewed manually'}
          </p>
        </div>

        {/* Payment Channel */}
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Payment Channel & Mode
          </span>
          <div className="text-base font-bold text-slate-800 dark:text-slate-200">
            {isFree ? 'Platform System' : `${subscription.paymentProvider || 'Razorpay'} (Test Mode)`}
          </div>
          <p className="text-[11px] text-slate-400">
            {isFree ? 'No gateway attached' : 'Test gateway with zero financial charge'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BillingCard;
