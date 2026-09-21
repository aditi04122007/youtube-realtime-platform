import React, { useState, useEffect } from 'react';
import {
  Flag,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Film,
  User,
  ShieldCheck,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import AdminConfirmModal from '../components/admin/AdminConfirmModal';
import {
  getAdminReports,
  resolveReport,
  dismissReport,
} from '../services/adminService';

const AdminReports = () => {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    confirmVariant: 'primary',
    requireReason: false,
    reasonPlaceholder: '',
    action: null,
  });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReports = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminReports({
        page,
        limit: 20,
        status,
        type,
        search,
      });
      setReports(res.reports || []);
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError(err.message || 'Failed to load content reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReports(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, status, type]);

  const handleResolve = (report) => {
    setConfirmModal({
      isOpen: true,
      title: `Resolve Report #${report.id}`,
      message: 'Mark this report as RESOLVED and document the moderation outcome.',
      confirmText: 'Resolve Report',
      confirmVariant: 'primary',
      requireReason: false,
      reasonPlaceholder: 'Enter resolution note (e.g., Content hidden, user warned)...',
      action: async (resolutionNote) => {
        setActionLoading(true);
        try {
          await resolveReport(report.id, resolutionNote);
          setConfirmModal({ ...confirmModal, isOpen: false });
          fetchReports(pagination.page);
        } catch (err) {
          alert(err.message || 'Failed to resolve report');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleDismiss = (report) => {
    setConfirmModal({
      isOpen: true,
      title: `Dismiss Report #${report.id}`,
      message: 'Dismiss this report if it is a false flag or does not violate platform policies.',
      confirmText: 'Dismiss Report',
      confirmVariant: 'warning',
      requireReason: false,
      reasonPlaceholder: 'Enter dismissal note (e.g., False flag, content within guidelines)...',
      action: async (resolutionNote) => {
        setActionLoading(true);
        try {
          await dismissReport(report.id, resolutionNote);
          setConfirmModal({ ...confirmModal, isOpen: false });
          fetchReports(pagination.page);
        } catch (err) {
          alert(err.message || 'Failed to dismiss report');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2.5">
            <Flag className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            <span>Content Reports Console</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Review user-submitted reports for comments, videos, and accounts; resolve violations or dismiss false flags
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => fetchReports(pagination.page)}
          disabled={loading}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </div>

      {/* Filters & Status Tabs */}
      <div className="space-y-3">
        {/* Status Navigation Tabs */}
        <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
          {['ALL', 'PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                status === s
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Search & Type filter */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by reason, description, or reporter username..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition shadow-sm"
            />
          </div>

          <div className="sm:col-span-4">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition shadow-sm"
            >
              <option value="ALL">All Target Types</option>
              <option value="COMMENT">Comments</option>
              <option value="VIDEO">Videos</option>
              <option value="USER">User Accounts</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Reports Table */}
      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Reported Content / Target</th>
                <th className="py-3 px-4">Reason & Description</th>
                <th className="py-3 px-4">Reporter</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Filed Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-rose-600 mb-2" />
                    <span>Loading reports queue...</span>
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    🎉 No reports found matching current status and filters
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          r.targetType === 'COMMENT'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                            : r.targetType === 'VIDEO'
                            ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300'
                            : 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300'
                        }`}
                      >
                        {r.targetType === 'COMMENT' && <MessageSquare className="w-3 h-3" />}
                        {r.targetType === 'VIDEO' && <Film className="w-3 h-3" />}
                        {r.targetType === 'USER' && <User className="w-3 h-3" />}
                        <span>{r.targetType}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-semibold text-slate-900 dark:text-white line-clamp-2">
                        {r.targetTitle || `Target ID #${r.targetId}`}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: #{r.targetId}</div>
                    </td>

                    <td className="py-3 px-4 max-w-sm">
                      <div className="font-bold text-rose-600 dark:text-rose-400">
                        {r.reason}
                      </div>
                      {r.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                          {r.description}
                        </p>
                      )}
                      {r.resolutionNote && (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 italic">
                          Resolution: {r.resolutionNote}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                      @{r.reporter?.username || 'user'}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          r.status === 'PENDING'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            : r.status === 'RESOLVED' || r.status === 'ACTION_TAKEN'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : r.status === 'DISMISSED'
                            ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {r.status === 'PENDING' || r.status === 'REVIEWING' ? (
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleResolve(r)}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
                          >
                            Resolve
                          </button>
                          <button
                            onClick={() => handleDismiss(r)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                          >
                            Dismiss
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Completed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing {reports.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} reports
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="xs"
              variant="outline"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchReports(pagination.page - 1)}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </Button>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              size="xs"
              variant="outline"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchReports(pagination.page + 1)}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Confirmation Modal */}
      <AdminConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmVariant={confirmModal.confirmVariant}
        requireReason={confirmModal.requireReason}
        reasonPlaceholder={confirmModal.reasonPlaceholder}
        onConfirm={confirmModal.action}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        loading={actionLoading}
      />
    </div>
  );
};

export default AdminReports;
