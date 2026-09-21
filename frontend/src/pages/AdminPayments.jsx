import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  Search,
  RefreshCw,
  ArrowLeft,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  Shield,
  Layers,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import { timeAgo } from '../utils/timeAgo';
import { getAdminPayments, getAdminPaymentById } from '../services/paymentService';

const AdminPayments = () => {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Details Modal
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const fetchPayments = useCallback(async (page = 1) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await getAdminPayments({
        page,
        limit: 15,
        status: statusFilter,
        plan: planFilter,
        search: searchQuery,
        sort: sortBy,
      });

      if (res && res.payments) {
        setPayments(res.payments);
        setStats(res.stats || null);
        setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
      }
    } catch (err) {
      console.error('Failed to load admin payments:', err);
      setErrorMsg(err?.message || 'Failed to retrieve payment records.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, planFilter, searchQuery, sortBy]);

  useEffect(() => {
    fetchPayments(1);
  }, [fetchPayments]);

  const handleOpenDetails = async (paymentId) => {
    setIsLoadingDetails(true);
    setDetailsModalOpen(true);
    try {
      const res = await getAdminPaymentById(paymentId);
      if (res && res.payment) {
        setSelectedPayment(res.payment);
      }
    } catch (err) {
      console.error('Failed to load payment details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            PAID
          </span>
        );
      case 'PENDING':
      case 'CREATED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
            <Clock className="w-3 h-3 mr-1" />
            {status}
          </span>
        );
      case 'VERIFICATION_FAILED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            VERIFY FAILED
          </span>
        );
      case 'FAILED':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
            <XCircle className="w-3 h-3 mr-1" />
            {status || 'FAILED'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <Link
            to="/admin"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Back to Admin Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <CreditCard className="w-6 h-6 text-indigo-500" />
              <span>Payment Ledger</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Razorpay test transaction history, payment verification audits, and revenue ledger
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchPayments(pagination.page)}
          className="self-start sm:self-auto flex items-center space-x-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Telemetry Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Total Transactions</p>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                {stats.totalTransactions.toLocaleString()}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <CreditCard className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Completed Payments</p>
              <h3 className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {stats.paidCount.toLocaleString()}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Total Processed Volume</p>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                ₹{stats.totalVolume.toLocaleString()}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Failed / Unverified</p>
              <h3 className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
                {stats.failedCount.toLocaleString()}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-5 h-5" />
            </div>
          </Card>
        </div>
      )}

      {/* Filter Bar */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="User, email, or order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">PAID</option>
              <option value="CREATED">CREATED</option>
              <option value="PENDING">PENDING</option>
              <option value="FAILED">FAILED</option>
              <option value="VERIFICATION_FAILED">VERIFICATION_FAILED</option>
            </select>
          </div>

          {/* Plan Tier Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Tier Plan</label>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Plans</option>
              <option value="BRONZE">Bronze</option>
              <option value="SILVER">Silver</option>
              <option value="GOLD">Gold</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Sort Order</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Payment Table */}
      {isLoading ? (
        <div className="py-12">
          <Loading message="Loading payment transactions..." />
        </div>
      ) : payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No Payment Transactions Found"
          description="No payment records match the current filter criteria."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-semibold">Receipt / ID</th>
                  <th className="py-3 px-4 font-semibold">User</th>
                  <th className="py-3 px-4 font-semibold">Tier Plan</th>
                  <th className="py-3 px-4 font-semibold">Amount</th>
                  <th className="py-3 px-4 font-semibold">Provider Order</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-white">
                      {p.receipt || `#${p.id}`}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {p.user?.username || 'Unknown'}
                      </div>
                      <div className="text-[11px] text-slate-400">{p.user?.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {p.plan?.name || p.plan?.code}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-black text-slate-900 dark:text-white">
                      ₹{p.amount}
                      <span className="text-[10px] font-normal text-slate-400 block">
                        {p.billingCycle}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 truncate max-w-[140px]" title={p.providerOrderId}>
                      {p.providerOrderId || '—'}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(p.status)}</td>
                    <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                      {p.paidAt ? timeAgo(p.paidAt) : timeAgo(p.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDetails(p.id)}
                        className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950"
                        title="View Payment Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing page <span className="font-semibold text-slate-900 dark:text-white">{pagination.page}</span> of{' '}
                <span className="font-semibold text-slate-900 dark:text-white">{pagination.totalPages}</span> ({pagination.total} total)
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchPayments(pagination.page - 1)}
                  className="p-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchPayments(pagination.page + 1)}
                  className="p-1.5"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Payment Details Modal */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title="Payment Transaction Details"
      >
        {isLoadingDetails ? (
          <div className="py-8">
            <Loading message="Fetching transaction metadata..." />
          </div>
        ) : selectedPayment ? (
          <div className="space-y-4 pt-2 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Transaction Status:</span>
                <div>{getStatusBadge(selectedPayment.status)}</div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Internal Reference:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {selectedPayment.receipt || `#${selectedPayment.id}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {selectedPayment.user?.username} ({selectedPayment.user?.email})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Plan Purchased:</span>
                <span className="font-bold text-indigo-600 dark:text-cyan-400">
                  {selectedPayment.plan?.name} ({selectedPayment.billingCycle})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Amount Charged:</span>
                <span className="font-black text-base text-slate-900 dark:text-white">
                  ₹{selectedPayment.amount} {selectedPayment.currency}
                </span>
              </div>
            </div>

            <div className="space-y-2 p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 text-[11px] font-mono">
              <div>
                <span className="text-slate-500">Provider:</span>{' '}
                <span className="text-slate-900 dark:text-white">{selectedPayment.provider} (Test Mode)</span>
              </div>
              <div>
                <span className="text-slate-500">Razorpay Order ID:</span>{' '}
                <span className="text-slate-900 dark:text-white">{selectedPayment.providerOrderId || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">Razorpay Payment ID:</span>{' '}
                <span className="text-slate-900 dark:text-white">{selectedPayment.providerPaymentId || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">Created At:</span>{' '}
                <span className="text-slate-900 dark:text-white">
                  {new Date(selectedPayment.createdAt).toLocaleString()}
                </span>
              </div>
              {selectedPayment.paidAt && (
                <div>
                  <span className="text-slate-500">Paid At:</span>{' '}
                  <span className="text-slate-900 dark:text-white">
                    {new Date(selectedPayment.paidAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {selectedPayment.failureReason && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-700 dark:text-rose-300">
                <strong>Failure Reason:</strong> {selectedPayment.failureReason}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setDetailsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default AdminPayments;
