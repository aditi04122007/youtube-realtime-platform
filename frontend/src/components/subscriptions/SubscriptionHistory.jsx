import React from 'react';
import { History, ArrowRight, Sparkles, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import Button from '../common/Button';

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return dateStr;
  }
};

const getActionBadge = (action) => {
  switch ((action || '').toUpperCase()) {
    case 'UPGRADED':
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
          UPGRADE
        </span>
      );
    case 'DOWNGRADED':
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
          DOWNGRADE
        </span>
      );
    case 'EXPIRED':
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
          EXPIRED
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          CANCELLED
        </span>
      );
    case 'RENEWED':
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-300">
          RENEWED
        </span>
      );
    case 'ASSIGNED':
    default:
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300">
          INITIALIZED
        </span>
      );
  }
};

const SubscriptionHistory = ({
  history = [],
  pagination = {},
  onPageChange,
  isLoading = false,
}) => {
  if (history.length === 0 && !isLoading) {
    return (
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center mx-auto mb-3">
          <History className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-slate-900 dark:text-white">
          No subscription changes yet
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
          When you upgrade, downgrade, or renew your tier plan, your transition audit logs will be listed here.
        </p>
      </div>
    );
  }

  const { page = 1, totalPages = 1, total = history.length } = pagination;

  return (
    <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-500" />
            Membership Transition Timeline
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Immutable audit record of plan upgrades, downgrades, and lifecycle changes
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Total Changes: {total}
        </span>
      </div>

      {/* Timeline View */}
      <div className="p-5 sm:p-6 divide-y divide-slate-100 dark:divide-slate-800/60">
        {history.map((item, idx) => {
          const prevName = item.previousPlanName || item.previousPlanCode || 'None';
          const newName = item.newPlanName || item.newPlanCode || 'Free Starter';

          return (
            <div key={item.id || idx} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {prevName}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-sm text-indigo-600 dark:text-cyan-400">
                      {newName}
                    </span>
                    {getActionBadge(item.action)}
                  </div>
                  {item.reason && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {item.reason}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-400 flex items-center gap-1.5 self-end sm:self-center font-medium">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(item.createdAt)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="xs"
              variant="outline"
              disabled={page <= 1 || isLoading}
              onClick={() => onPageChange && onPageChange(page - 1)}
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
              Previous
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={page >= totalPages || isLoading}
              onClick={() => onPageChange && onPageChange(page + 1)}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionHistory;
