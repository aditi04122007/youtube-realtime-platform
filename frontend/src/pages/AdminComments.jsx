import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
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
  getAdminComments,
  updateCommentStatus,
} from '../services/adminService';

const AdminComments = () => {
  const [comments, setComments] = useState([]);
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

  const fetchComments = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminComments({
        page,
        limit: 20,
        search,
        status,
      });
      setComments(res.comments || []);
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError(err.message || 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchComments(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, status]);

  const handleStatusChange = (comment, newStatus) => {
    const isDestructive = newStatus === 'REMOVED' || newStatus === 'HIDDEN';
    setConfirmModal({
      isOpen: true,
      title: `${newStatus === 'REMOVED' ? 'Remove' : newStatus === 'HIDDEN' ? 'Hide' : 'Restore'} Comment`,
      message: `Set status of this comment to ${newStatus}?`,
      confirmText: newStatus === 'REMOVED' ? 'Remove Comment' : newStatus === 'HIDDEN' ? 'Hide Comment' : 'Restore Comment',
      confirmVariant: newStatus === 'REMOVED' ? 'danger' : newStatus === 'HIDDEN' ? 'warning' : 'primary',
      requireReason: isDestructive,
      action: async (reason) => {
        setActionLoading(true);
        try {
          await updateCommentStatus(comment.id, newStatus, reason);
          setConfirmModal({ ...confirmModal, isOpen: false });
          fetchComments(pagination.page);
        } catch (err) {
          alert(err.message || 'Failed to update comment status');
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
            <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Comment Moderation</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Review user comments, hide abusive messages, and inspect moderation reports
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => fetchComments(pagination.page)}
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
            placeholder="Search comment content, author username, or video title..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
          />
        </div>

        <div className="sm:col-span-4">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
          >
            <option value="ALL">All Comment Statuses</option>
            <option value="VISIBLE">Visible Comments</option>
            <option value="HIDDEN">Hidden Comments</option>
            <option value="REMOVED">Removed Comments</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Comments Table */}
      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Comment Content</th>
                <th className="py-3 px-4">Author</th>
                <th className="py-3 px-4">Video</th>
                <th className="py-3 px-4">Likes / Replies</th>
                <th className="py-3 px-4">Reports</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    <span>Loading comments...</span>
                  </td>
                </tr>
              ) : comments.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No comments found
                  </td>
                </tr>
              ) : (
                comments.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 max-w-sm">
                      <div className="text-slate-900 dark:text-white font-medium line-clamp-2">
                        {c.content}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: #{c.id}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        @{c.author?.username}
                      </div>
                      <div className="text-[10px] text-slate-400">{c.author?.email}</div>
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <a
                        href={`/watch/${c.videoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-800 dark:text-slate-200 hover:text-blue-600 line-clamp-1 font-medium flex items-center space-x-1"
                      >
                        <span>{c.videoTitle}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 opacity-60" />
                      </a>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {c.likeCount} likes • {c.replyCount} replies
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {c.reportsCount > 0 ? (
                        <span className="font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-lg">
                          {c.reportsCount} flagged
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          c.status === 'VISIBLE'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : c.status === 'HIDDEN'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {c.status === 'VISIBLE' ? (
                          <button
                            onClick={() => handleStatusChange(c, 'HIDDEN')}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition"
                            title="Hide comment"
                          >
                            <EyeOff className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(c, 'VISIBLE')}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
                            title="Restore / Show comment"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}

                        {c.status !== 'REMOVED' && (
                          <button
                            onClick={() => handleStatusChange(c, 'REMOVED')}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                            title="Remove comment"
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
            Showing {comments.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} comments
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="xs"
              variant="outline"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchComments(pagination.page - 1)}
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
              onClick={() => fetchComments(pagination.page + 1)}
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

export default AdminComments;
