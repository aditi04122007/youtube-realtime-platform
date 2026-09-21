import React, { useState, useEffect } from 'react';
import {
  Video,
  Search,
  RefreshCw,
  PhoneOff,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import AdminConfirmModal from '../components/admin/AdminConfirmModal';
import {
  getAdminCalls,
  endAdminCallRoom,
} from '../services/adminService';

const AdminCalls = () => {
  const [rooms, setRooms] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [roomType, setRoomType] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Terminate Room',
    confirmVariant: 'danger',
    requireReason: true,
    action: null,
  });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCalls = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminCalls({
        page,
        limit: 20,
        search,
        status,
        roomType,
      });
      setRooms(res.rooms || []);
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Error fetching call rooms:', err);
      setError(err.message || 'Failed to load call rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCalls(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, status, roomType]);

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleEndRoom = (room) => {
    setConfirmModal({
      isOpen: true,
      title: `Terminate Call Room: ${room.roomCode}`,
      message: 'This will immediately disconnect all active WebRTC peers, emit room:ended to connected clients, and mark the call room as ENDED.',
      confirmText: 'Terminate Room',
      confirmVariant: 'danger',
      requireReason: true,
      action: async (reason) => {
        setActionLoading(true);
        try {
          await endAdminCallRoom(room.roomCode, reason);
          setConfirmModal({ ...confirmModal, isOpen: false });
          fetchCalls(pagination.page);
        } catch (err) {
          alert(err.message || 'Failed to terminate call room');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    if (h === 0) return `${m}m ${s}s`;
    return `${h}h ${remM}m`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2.5">
            <Video className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            <span>Video Call Monitoring</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Monitor real-time WebRTC rooms, inspect active participant counts, and terminate calls
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => fetchCalls(pagination.page)}
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
            placeholder="Search by room code or host username..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition shadow-sm"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition shadow-sm"
          >
            <option value="ALL">All Call Statuses</option>
            <option value="ACTIVE">Active Calls Only</option>
            <option value="WAITING">Waiting Calls</option>
            <option value="ENDED">Ended Calls</option>
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition shadow-sm"
          >
            <option value="ALL">All Room Types</option>
            <option value="GROUP">Group Calls</option>
            <option value="ONE_TO_ONE">1:1 Calls</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Calls Table */}
      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Room Code</th>
                <th className="py-3 px-4">Host</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Participants</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-rose-600 mb-2" />
                    <span>Loading call rooms...</span>
                  </td>
                </tr>
              ) : rooms.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No video call rooms matching current filter
                  </td>
                </tr>
              ) : (
                rooms.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center space-x-2">
                        <span>{r.roomCode}</span>
                        <button
                          onClick={() => handleCopy(r.roomCode)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded"
                          title="Copy room code"
                        >
                          {copiedCode === r.roomCode ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        @{r.hostUsername || 'Host'}
                      </div>
                      <div className="text-[10px] text-slate-400">{r.hostEmail}</div>
                    </td>

                    <td className="py-3 px-4 font-medium">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {r.roomType === 'ONE_TO_ONE' ? '1:1 Direct' : 'Group'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          r.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 animate-pulse'
                            : r.status === 'WAITING'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5 font-semibold text-slate-800 dark:text-slate-200">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        <span>
                          {r.activeParticipants} / {r.maxParticipants || 8}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {formatDuration(r.durationSeconds)}
                    </td>

                    <td className="py-3 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {r.status === 'ACTIVE' || r.status === 'WAITING' ? (
                        <button
                          onClick={() => handleEndRoom(r)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 dark:border-rose-900 rounded-lg transition"
                        >
                          <PhoneOff className="w-3 h-3" />
                          <span>End Room</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Closed</span>
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
            Showing {rooms.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} rooms
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="xs"
              variant="outline"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchCalls(pagination.page - 1)}
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
              onClick={() => fetchCalls(pagination.page + 1)}
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

export default AdminCalls;
