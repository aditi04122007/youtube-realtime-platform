import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  RefreshCw,
  Shield,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  FileText,
  Clock,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { getAdminActivityLogs } from '../services/adminService';

const AdminActivity = () => {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [targetType, setTargetType] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedLogId, setExpandedLogId] = useState(null);

  const fetchLogs = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminActivityLogs({
        page,
        limit: 20,
        search,
        targetType,
      });
      setLogs(res.logs || []);
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Error fetching admin activity logs:', err);
      setError(err.message || 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, targetType]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2.5">
            <History className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Administrative Audit Log</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Immutable chronicle of all moderation events, role modifications, and administrative operations
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => fetchLogs(pagination.page)}
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
            placeholder="Search action, description, reason, or admin username..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
          />
        </div>

        <div className="sm:col-span-4">
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
          >
            <option value="ALL">All Target Types</option>
            <option value="USER">User Actions</option>
            <option value="CHANNEL">Channel Actions</option>
            <option value="VIDEO">Video Actions</option>
            <option value="COMMENT">Comment Actions</option>
            <option value="REPORT">Report Resolutions</option>
            <option value="CALL_ROOM">Call Room Overrides</option>
            <option value="PLAN">Subscription Plans</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Audit Log Table */}
      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Admin</th>
                <th className="py-3 px-4">Action Type</th>
                <th className="py-3 px-4">Target</th>
                <th className="py-3 px-4">Description & Reason</th>
                <th className="py-3 px-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                    <span>Loading audit records...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    No administrative audit records found
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {new Date(l.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(l.createdAt).toLocaleTimeString()}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-indigo-600 dark:text-indigo-400">
                        @{l.adminUsername || `Admin #${l.adminId}`}
                      </div>
                      <div className="text-[10px] text-slate-400">{l.adminEmail}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                        {l.actionType}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {l.targetType}
                      </span>
                      {l.targetId && (
                        <span className="text-[10px] text-slate-400 font-mono ml-1">
                          #{l.targetId}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 max-w-md">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {l.description || l.reason || 'Administrative action logged'}
                      </div>
                      {l.reason && l.reason !== l.description && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Reason: {l.reason}
                        </div>
                      )}
                      {l.metadata && (
                        <button
                          onClick={() => setExpandedLogId(expandedLogId === l.id ? null : l.id)}
                          className="mt-1 text-[10px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline block"
                        >
                          {expandedLogId === l.id ? 'Hide Metadata' : 'View Metadata'}
                        </button>
                      )}
                      {expandedLogId === l.id && l.metadata && (
                        <pre className="mt-1 p-2 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] text-slate-700 dark:text-slate-300 overflow-x-auto">
                          {typeof l.metadata === 'object' ? JSON.stringify(l.metadata, null, 2) : l.metadata}
                        </pre>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {l.ipAddress || '127.0.0.1'}
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
            Showing {logs.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} records
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="xs"
              variant="outline"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchLogs(pagination.page - 1)}
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
              onClick={() => fetchLogs(pagination.page + 1)}
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

export default AdminActivity;
