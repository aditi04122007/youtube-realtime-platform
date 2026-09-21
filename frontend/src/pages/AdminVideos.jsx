import React, { useState, useEffect } from 'react';
import {
  Film,
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import AdminConfirmModal from '../components/admin/AdminConfirmModal';
import {
  getAdminVideos,
  updateVideoStatus,
  updateVideoVisibility,
} from '../services/adminService';

const AdminVideos = () => {
  const [videos, setVideos] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [visibility, setVisibility] = useState('ALL');
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

  const fetchVideos = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminVideos({
        page,
        limit: 20,
        search,
        status,
        visibility,
      });
      setVideos(res.videos || []);
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Error fetching videos:', err);
      setError(err.message || 'Failed to load video catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVideos(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, status, visibility]);

  const handleStatusChange = (video, newStatus) => {
    const isDestructive = newStatus === 'REMOVED' || newStatus === 'HIDDEN';
    setConfirmModal({
      isOpen: true,
      title: `${newStatus === 'REMOVED' ? 'Remove' : newStatus === 'HIDDEN' ? 'Hide' : 'Restore'} Video`,
      message: `Are you sure you want to change status of "${video.title}" to ${newStatus}?`,
      confirmText: newStatus === 'REMOVED' ? 'Remove Video' : newStatus === 'HIDDEN' ? 'Hide Video' : 'Publish Video',
      confirmVariant: newStatus === 'REMOVED' ? 'danger' : newStatus === 'HIDDEN' ? 'warning' : 'primary',
      requireReason: isDestructive,
      action: async (reason) => {
        setActionLoading(true);
        try {
          await updateVideoStatus(video.id, newStatus, reason);
          setConfirmModal({ ...confirmModal, isOpen: false });
          fetchVideos(pagination.page);
        } catch (err) {
          alert(err.message || 'Failed to update video status');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleVisibilityChange = (video, newVisibility) => {
    setConfirmModal({
      isOpen: true,
      title: `Change Visibility to ${newVisibility}`,
      message: `Set visibility of "${video.title}" to ${newVisibility}?`,
      confirmText: 'Change Visibility',
      confirmVariant: 'primary',
      requireReason: false,
      action: async (reason) => {
        setActionLoading(true);
        try {
          await updateVideoVisibility(video.id, newVisibility, reason);
          setConfirmModal({ ...confirmModal, isOpen: false });
          fetchVideos(pagination.page);
        } catch (err) {
          alert(err.message || 'Failed to update visibility');
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
            <Film className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            <span>Video Content Management</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Search, moderate video status (Publish, Hide, Remove), adjust privacy, and inspect reports
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => fetchVideos(pagination.page)}
          disabled={loading}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-6 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, channel handle, or video ID..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition shadow-sm"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition shadow-sm"
          >
            <option value="ALL">All Video Statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="HIDDEN">Hidden (Moderated)</option>
            <option value="REMOVED">Removed (Moderated)</option>
            <option value="PROCESSING">Processing</option>
            <option value="DELETED">Deleted by User</option>
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition shadow-sm"
          >
            <option value="ALL">All Visibilities</option>
            <option value="PUBLIC">Public</option>
            <option value="UNLISTED">Unlisted</option>
            <option value="PRIVATE">Private</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Videos Table */}
      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Video</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Visibility</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Stats (Views / Likes)</th>
                <th className="py-3 px-4">Reports</th>
                <th className="py-3 px-4">Published</th>
                <th className="py-3 px-4 text-right">Moderation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-600 mb-2" />
                    <span>Loading videos...</span>
                  </td>
                </tr>
              ) : videos.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No videos found matching the criteria
                  </td>
                </tr>
              ) : (
                videos.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-16 h-10 rounded-lg bg-slate-200 dark:bg-slate-800 overflow-hidden flex-shrink-0 relative">
                          {v.thumbnailUrl ? (
                            <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                              No Thumb
                            </div>
                          )}
                        </div>
                        <div className="max-w-xs">
                          <a
                            href={`/watch/${v.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-slate-900 dark:text-white hover:text-cyan-600 line-clamp-1 flex items-center space-x-1"
                          >
                            <span>{v.title}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400 opacity-60" />
                          </a>
                          <div className="text-[10px] text-slate-400 font-mono">ID: #{v.id}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {v.channel?.name || 'Channel'}
                      </div>
                      <div className="text-[10px] text-slate-400">@{v.uploader?.username}</div>
                    </td>

                    <td className="py-3 px-4">
                      <select
                        value={v.visibility}
                        onChange={(e) => handleVisibilityChange(v, e.target.value)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                      >
                        <option value="PUBLIC">PUBLIC</option>
                        <option value="UNLISTED">UNLISTED</option>
                        <option value="PRIVATE">PRIVATE</option>
                      </select>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          v.status === 'PUBLISHED'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : v.status === 'HIDDEN'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : v.status === 'REMOVED'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800'
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {v.views.toLocaleString()} views
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {v.likes} likes • {v.comments} comments
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {v.reportsCount > 0 ? (
                        <span className="font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-lg">
                          {v.reportsCount} flagged
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {v.status === 'PUBLISHED' ? (
                          <button
                            onClick={() => handleStatusChange(v, 'HIDDEN')}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition"
                            title="Hide video from public view"
                          >
                            <EyeOff className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(v, 'PUBLISHED')}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
                            title="Publish / Restore video"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}

                        {v.status !== 'REMOVED' && (
                          <button
                            onClick={() => handleStatusChange(v, 'REMOVED')}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                            title="Remove video"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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
            Showing {videos.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} videos
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="xs"
              variant="outline"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchVideos(pagination.page - 1)}
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
              onClick={() => fetchVideos(pagination.page + 1)}
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

export default AdminVideos;
