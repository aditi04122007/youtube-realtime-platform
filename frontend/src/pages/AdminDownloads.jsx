import React, { useState, useEffect } from 'react';
import {
  Download,
  Search,
  RefreshCw,
  HardDrive,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import {
  getAdminDownloadStats,
  getAdminDownloads,
} from '../services/adminService';

const AdminDownloads = () => {
  const [stats, setStats] = useState(null);
  const [downloads, setDownloads] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      const res = await getAdminDownloadStats();
      setStats(res.stats);
    } catch (err) {
      console.error('Error fetching download stats:', err);
    }
  };

  const fetchDownloads = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminDownloads({
        page,
        limit: 20,
        search,
        status,
      });
      setDownloads(res.downloads || []);
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Error fetching downloads:', err);
      setError(err.message || 'Failed to load downloads telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDownloads(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, status]);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2.5">
            <Download className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            <span>Downloads & Bandwidth Telemetry</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Monitor offline download volumes, storage consumption, and track failed transfers
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            fetchStats();
            fetchDownloads(pagination.page);
          }}
          disabled={loading}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Downloads</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600">
              <Download className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {stats?.totalDownloads?.toLocaleString() || 0}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1 font-semibold">
            {stats?.completedDownloads?.toLocaleString() || 0} completed
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Today's Transfers</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {stats?.todayDownloads?.toLocaleString() || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Last 24 hours
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Monthly Volume</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {stats?.monthDownloads?.toLocaleString() || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Past 30 days
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Bandwidth Consumed</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {formatBytes(stats?.totalStorageBytes || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Storage bandwidth
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-8 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user username, email, or video title..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition shadow-sm"
          />
        </div>

        <div className="sm:col-span-4">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition shadow-sm"
          >
            <option value="ALL">All Download Statuses</option>
            <option value="COMPLETED">Completed Only</option>
            <option value="FAILED">Failed Only</option>
            <option value="PENDING">Pending / In Progress</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Downloads Table */}
      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Video</th>
                <th className="py-3 px-4">File Name</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Note / Failure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-600 mb-2" />
                    <span>Loading download records...</span>
                  </td>
                </tr>
              ) : downloads.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    No download activity found
                  </td>
                </tr>
              ) : (
                downloads.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        @{d.username}
                      </div>
                      <div className="text-[10px] text-slate-400">{d.email}</div>
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                        {d.videoTitle}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">Video #{d.videoId}</div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-700 dark:text-slate-300 max-w-xs truncate">
                      {d.fileName}
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {formatBytes(d.fileSize)}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          d.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : d.status === 'FAILED'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(d.downloadedAt).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-[11px] text-slate-400 italic">
                      {d.failureReason || '—'}
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
            Showing {downloads.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} downloads
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="xs"
              variant="outline"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchDownloads(pagination.page - 1)}
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
              onClick={() => fetchDownloads(pagination.page + 1)}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminDownloads;
