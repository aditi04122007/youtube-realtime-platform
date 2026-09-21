import React, { useState, useEffect } from 'react';
import {
  Tv,
  Search,
  Filter,
  RefreshCw,
  ShieldAlert,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import AdminConfirmModal from '../components/admin/AdminConfirmModal';
import {
  getAdminChannels,
  suspendChannel,
  restoreChannel,
} from '../services/adminService';

const AdminChannels = () => {
  const [channels, setChannels] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    confirmVariant: 'danger',
    requireReason: false,
    action: null,
  });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchChannels = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminChannels({
        page,
        limit: 20,
        search,
        status,
      });
      setChannels(res.channels || []);
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Error fetching channels:', err);
      setError(err.message || 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchChannels(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, status]);

  const handleSuspend = (channel) => {
    setConfirmModal({
      isOpen: true,
      title: `Suspend Channel: ${channel.name}`,
      message: 'Suspending this channel hides its public profile and restricts video distribution.',
      confirmText: 'Suspend Channel',
      confirmVariant: 'warning',
      requireReason: true,
      action: async (reason) => {
        setActionLoading(true);
        try {
          await suspendChannel(channel.id, reason);
          setConfirmModal({ ...confirmModal, isOpen: false });
          fetchChannels(pagination.page);
        } catch (err) {
          alert(err.message || 'Failed to suspend channel');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleRestore = (channel) => {
    setConfirmModal({
      isOpen: true,
      title: `Restore Channel: ${channel.name}`,
      message: 'Restore this channel to ACTIVE status and normal platform distribution.',
      confirmText: 'Restore Channel',
      confirmVariant: 'primary',
      requireReason: false,
      action: async (reason) => {
        setActionLoading(true);
        try {
          await restoreChannel(channel.id, reason);
          setConfirmModal({ ...confirmModal, isOpen: false });
          fetchChannels(pagination.page);
        } catch (err) {
          alert(err.message || 'Failed to restore channel');
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
            <Tv className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Channel Management</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Monitor creator channels, subscriber metrics, and moderate channel visibility
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => fetchChannels(pagination.page)}
          disabled={loading}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-8 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by channel name, handle, owner username, or email..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
          />
        </div>

        <div className="sm:col-span-4">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
          >
            <option value="ALL">All Channel Statuses</option>
            <option value="ACTIVE">Active Channels</option>
            <option value="SUSPENDED">Suspended Channels</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Channels Table */}
      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4">Subscribers</th>
                <th className="py-3 px-4">Videos</th>
                <th className="py-3 px-4">Total Views</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                    <span>Loading channels...</span>
                  </td>
                </tr>
              ) : channels.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No channels found matching the query
                  </td>
                </tr>
              ) : (
                channels.map((ch) => (
                  <tr key={ch.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
                          {ch.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white line-clamp-1">
                            {ch.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">@{ch.handle}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-slate-800 dark:text-slate-200 font-medium">
                        @{ch.owner?.username}
                      </div>
                      <div className="text-[10px] text-slate-400">{ch.owner?.email}</div>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {ch.subscriberCount.toLocaleString()}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {ch.videoCount}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {ch.totalViews.toLocaleString()}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          ch.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {ch.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(ch.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {ch.status === 'ACTIVE' ? (
                        <button
                          onClick={() => handleSuspend(ch)}
                          className="px-2.5 py-1 text-xs font-semibold text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRestore(ch)}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
                        >
                          Restore
                        </button>
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
            Showing {channels.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} channels
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="xs"
              variant="outline"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchChannels(pagination.page - 1)}
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
              onClick={() => fetchChannels(pagination.page + 1)}
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
        onConfirm={confirmModal.action}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        loading={actionLoading}
      />
    </div>
  );
};

export default AdminChannels;
