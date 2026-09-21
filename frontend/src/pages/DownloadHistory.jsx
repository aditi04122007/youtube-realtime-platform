import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Download,
  Clock,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Crown,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  getDownloadHistory,
  getDownloadQuota,
  getDownloadSummary,
  deleteDownloadHistory,
} from '../services/downloadHistoryService';
import { useAuth } from '../context/AuthContext';

const formatBytes = (bytes = 0) => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const formatDate = (dateString) => {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
};

const formatPeriodDate = (dateString) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
};

const DownloadHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [quota, setQuota] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Load history and quota
  const loadData = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const [histRes, quotaRes, sumRes] = await Promise.allSettled([
        getDownloadHistory({ page, limit: 10 }),
        getDownloadQuota(),
        getDownloadSummary(),
      ]);

      if (histRes.status === 'fulfilled' && histRes.value.success) {
        setItems(histRes.value.items || []);
        setPagination(histRes.value.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
      } else {
        throw new Error(histRes.reason?.message || 'Failed to load download history.');
      }

      if (quotaRes.status === 'fulfilled' && quotaRes.value.success) {
        setQuota(quotaRes.value.quota || null);
      }

      if (sumRes.status === 'fulfilled' && sumRes.value.success) {
        setSummary(sumRes.value.summary || null);
      }
    } catch (err) {
      console.error('[DownloadHistory] Loading error:', err);
      setError(err.message || 'Unable to load download history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(1);
  }, [loadData]);

  // Handle delete history record
  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteDownloadHistory(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setDeleteConfirmId(null);
      setToastMessage('Download history record removed. (Consumed quota remains unchanged).');
      setTimeout(() => setToastMessage(null), 4000);
      // Reload summary to reflect active counts
      getDownloadSummary().then((res) => {
        if (res.success) setSummary(res.summary);
      });
    } catch (err) {
      console.error('[DownloadHistory] Delete error:', err);
      alert(err.response?.data?.message || err.message || 'Failed to delete record.');
    } finally {
      setDeletingId(null);
    }
  };

  const isUnlimited = quota?.unlimited;
  const isFreePlan = quota?.planCode === 'FREE' || (!quota?.limit && !isUnlimited);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 sm:px-6 lg:px-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 px-4 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xl text-xs font-semibold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center space-x-3">
            <Download className="w-7 h-7 text-indigo-600 dark:text-cyan-400" />
            <span>Download History</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your offline video downloads and monthly allowance.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadData(pagination.page)}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Section 23: Quota Summary Card */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-indigo-900 via-slate-900 to-[#0a0e17] text-white border border-indigo-950 shadow-xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="flex items-center space-x-2.5">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-white/10 text-indigo-300 border border-white/10 flex items-center space-x-1">
                <Crown className="w-3 h-3 text-amber-400 mr-1" />
                Plan: {quota?.planName || quota?.planCode || 'Standard'}
              </span>
              {isUnlimited && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>VIP Unlimited</span>
                </span>
              )}
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white">Your Downloads</h2>
              {isFreePlan ? (
                <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                  Downloads are not included in your current plan. Upgrade your plan to download and watch videos offline anytime.
                </p>
              ) : isUnlimited ? (
                <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                  Unlimited downloads active. Enjoy unrestricted offline access across all downloadable videos.
                </p>
              ) : (
                <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                  You have consumed <strong>{quota?.used ?? 0}</strong> of your monthly{' '}
                  <strong>{quota?.limit ?? 20}</strong> downloads.
                </p>
              )}
            </div>

            {/* Quota Period display */}
            {quota?.periodStart && quota?.periodEnd && (
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <Clock className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                <span>
                  Period: {formatPeriodDate(quota.periodStart)} – {formatPeriodDate(quota.periodEnd)}
                </span>
              </div>
            )}
          </div>

          {/* Quota Stats & Manage Action */}
          <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch md:items-center gap-4">
            {!isFreePlan && !isUnlimited && quota && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-6">
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Used
                  </div>
                  <div className="text-2xl font-black text-white">{quota.used}</div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Remaining
                  </div>
                  <div className="text-2xl font-black text-cyan-400">{quota.remaining}</div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Limit
                  </div>
                  <div className="text-2xl font-black text-white">{quota.limit}</div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate('/subscription-dashboard')}
              className="py-3 px-5 rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center space-x-2 self-stretch sm:self-auto"
            >
              <span>Manage Subscription</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading && (
        <div className="py-16 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-cyan-400" />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Loading your download history...
          </span>
        </div>
      )}

      {!loading && error && (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={() => loadData(pagination.page)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State (Section 22) */}
      {!loading && !error && items.length === 0 && (
        <div className="py-20 px-4 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-cyan-400 flex items-center justify-center mx-auto shadow-inner">
            <Download className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              No downloads yet.
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Videos you download will appear here for offline tracking.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-colors"
          >
            <span>Explore Videos</span>
          </button>
        </div>
      )}

      {/* History Items List */}
      {!loading && !error && items.length > 0 && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm">
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Left: Thumbnail & Details */}
                  <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                    <Link
                      to={`/watch/${item.videoId}`}
                      className="relative flex-shrink-0 w-24 h-14 sm:w-28 sm:h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 group"
                    >
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <Download className="w-5 h-5 opacity-40" />
                        </div>
                      )}
                    </Link>

                    <div className="min-w-0 flex-1 space-y-1">
                      <Link
                        to={`/watch/${item.videoId}`}
                        className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-cyan-400 transition-colors line-clamp-1"
                      >
                        {item.title}
                      </Link>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{formatDate(item.downloadedAt)}</span>
                        {item.fileSize > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center space-x-1">
                              <HardDrive className="w-3 h-3 text-slate-400" />
                              <span>{formatBytes(item.fileSize)}</span>
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span className="font-mono text-[10px] text-slate-400 truncate max-w-[140px]">
                          {item.fileName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Status badge & Actions */}
                  <div className="flex items-center space-x-3 self-end sm:self-center">
                    {item.status === 'COMPLETED' ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span>Completed</span>
                      </span>
                    ) : item.status === 'STARTED' ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">
                        <Loader2 className="w-3 h-3 animate-spin text-cyan-500" />
                        <span>Started</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                        <AlertCircle className="w-3 h-3 text-rose-500" />
                        <span>Failed</span>
                      </span>
                    )}

                    {/* Delete Action (Section 11) */}
                    {deleteConfirmId === item.id ? (
                      <div className="flex items-center space-x-1.5 animate-fadeIn">
                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => handleDelete(item.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold transition-colors disabled:opacity-50"
                        >
                          {deletingId === item.id ? 'Deleting...' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-semibold transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Delete download history record (does not restore quota)"
                        aria-label="Delete history record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-2 pt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <div>
                Showing {(pagination.page - 1) * pagination.limit + 1} –{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} records
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => loadData(pagination.page - 1)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => loadData(pagination.page + 1)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DownloadHistory;
