import React from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Receipt,
  FileText,
} from 'lucide-react';
import Button from '../common/Button';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

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

const getStatusBadge = (status) => {
  switch ((status || '').toUpperCase()) {
    case 'PAID':
    case 'SUCCESS':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          PAID
        </span>
      );
    case 'PENDING':
    case 'CREATED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
          <Clock className="w-3 h-3 mr-1" />
          {status}
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
          <XCircle className="w-3 h-3 mr-1" />
          FAILED
        </span>
      );
    case 'VERIFICATION_FAILED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
          <AlertCircle className="w-3 h-3 mr-1" />
          VERIF FAILED
        </span>
      );
    case 'REFUNDED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300">
          REFUNDED
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400">
          CANCELLED
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
          {status}
        </span>
      );
  }
};

const PaymentHistory = ({
  payments = [],
  pagination = {},
  onPageChange,
  isLoading = false,
}) => {
  if (payments.length === 0 && !isLoading) {
    return (
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center mx-auto mb-3">
          <Receipt className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-slate-900 dark:text-white">
          No payment history yet
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
          When you upgrade to a premium plan via Razorpay Test Mode, your invoices and receipts will appear here.
        </p>
      </div>
    );
  }

  const { page = 1, totalPages = 1, total = payments.length } = pagination;

  return (
    <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-500" />
            Payment & Invoicing Ledger
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Authoritative records of your Razorpay test transactions
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Total: {total} {total === 1 ? 'transaction' : 'transactions'}
        </span>
      </div>

      {/* Responsive Table for Desktop/Tablet */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="py-3 px-5">Date & Time</th>
              <th className="py-3 px-4">Plan</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Payment ID / Order</th>
              <th className="py-3 px-4">Method</th>
              <th className="py-3 px-5 text-right">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {payments.map((p) => {
              const planName = p.plan?.name || p.plan?.code || 'Subscription';
              return (
                <tr
                  key={p.id}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors"
                >
                  <td className="py-3.5 px-5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {formatDate(p.createdAt)}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                    {planName}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {formatCurrency(p.amount)}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {getStatusBadge(p.status)}
                    {p.failureReason && (
                      <p className="text-[10px] text-rose-500 mt-0.5 truncate max-w-[150px]" title={p.failureReason}>
                        {p.failureReason}
                      </p>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    <div>{p.providerPaymentId || p.providerOrderId || `TXN-${p.id}`}</div>
                    {p.providerOrderId && p.providerPaymentId && (
                      <div className="text-[10px] text-slate-400">{p.providerOrderId}</div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                    {p.paymentMethod || 'Razorpay Test'}
                  </td>
                  <td className="py-3.5 px-5 text-right font-mono text-[11px] text-slate-400">
                    {p.receipt || `rcpt_${p.id}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Stack */}
      <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
        {payments.map((p) => {
          const planName = p.plan?.name || p.plan?.code || 'Subscription';
          return (
            <div key={p.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {planName}
                </span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {formatCurrency(p.amount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{formatDate(p.createdAt)}</span>
                {getStatusBadge(p.status)}
              </div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                ID: {p.providerPaymentId || p.providerOrderId || `TXN-${p.id}`}
              </div>
              {p.failureReason && (
                <div className="text-[11px] text-rose-500">
                  Reason: {p.failureReason}
                </div>
              )}
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

export default PaymentHistory;
