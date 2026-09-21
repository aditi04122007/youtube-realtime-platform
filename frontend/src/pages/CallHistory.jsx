import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCallHistory } from '../services/callService';
import { useCall } from '../context/CallContext';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { timeAgo } from '../utils/timeAgo';
import { getMediaUrl } from '../services/api';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  Video,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
} from 'lucide-react';
import CreateRoomModal from '../components/callRooms/CreateRoomModal';

const CallHistory = () => {
  const [calls, setCalls] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'MISSED' | 'COMPLETED'
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const { initiateCall } = useCall();
  const navigate = useNavigate();

  const loadHistory = async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetchCallHistory({ page, limit: 20 });
      if (res?.success) {
        setCalls(res.data || []);
        setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
      }
    } catch (err) {
      console.error('Failed to load call history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(1);
  }, []);

  const handleCallAgain = async (userId) => {
    const result = await initiateCall(userId);
    if (result.success && result.callId) {
      navigate(`/call/${result.callId}`);
    }
  };

  // Filter calls locally for fast tab transitions
  const filteredCalls = calls.filter((c) => {
    if (filter === 'MISSED') return c.status === 'MISSED' || c.endReason === 'timeout';
    if (filter === 'COMPLETED') return c.status === 'ACCEPTED' || (c.status === 'ENDED' && c.durationSeconds > 0);
    return true;
  });

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const getStatusBadge = (call) => {
    if (call.status === 'MISSED' || call.endReason === 'timeout') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
          <PhoneMissed className="w-3 h-3" />
          <span>Missed</span>
        </span>
      );
    }
    if (call.status === 'REJECTED' || call.endReason === 'rejected') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          <PhoneOff className="w-3 h-3" />
          <span>Declined</span>
        </span>
      );
    }
    if (call.status === 'FAILED' && call.endReason === 'busy') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
          <span>Busy</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
        <span>Connected</span>
      </span>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-2 sm:px-4 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center space-x-2.5">
            <Video className="w-7 h-7 text-indigo-600 dark:text-cyan-400" />
            <span>Call History</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review your recent incoming, outgoing, and missed video calls.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl">
            {['ALL', 'COMPLETED', 'MISSED'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  filter === tab
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            variant="primary"
            leftIcon={<Users className="w-4 h-4" />}
            onClick={() => setIsCreateRoomOpen(true)}
          >
            New Video Room
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-cyan-400" />
          <p className="text-xs">Loading call records...</p>
        </div>
      ) : filteredCalls.length === 0 ? (
        <Card className="py-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-cyan-400 mx-auto flex items-center justify-center shadow-inner">
            <Phone className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Call Records Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {filter === 'ALL'
                ? 'You have not made or received any video calls yet.'
                : `No calls matching the '${filter.toLowerCase()}' filter.`}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCalls.map((call) => {
            const isOutgoing = call.direction === 'OUTGOING';
            const other = call.otherUser || {};
            const avatarSrc = other.avatarUrl ? getMediaUrl(other.avatarUrl) : null;
            const initial = (other.displayName || other.username || 'U').charAt(0).toUpperCase();

            return (
              <div
                key={call.id}
                className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm"
              >
                <div className="flex items-center space-x-3.5">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white font-bold shadow flex-shrink-0">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt={other.displayName} className="w-full h-full object-cover" />
                    ) : (
                      initial
                    )}
                  </div>

                  {/* Info */}
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {other.displayName || other.username || 'User'}
                      </h4>
                      {other.username && (
                        <span className="text-xs text-slate-500">@{other.username}</span>
                      )}
                      {getStatusBadge(call)}
                    </div>

                    <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400">
                      {/* Direction */}
                      <span className="flex items-center space-x-1">
                        {isOutgoing ? (
                          <>
                            <PhoneOutgoing className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Outgoing</span>
                          </>
                        ) : (
                          <>
                            <PhoneIncoming className="w-3.5 h-3.5 text-cyan-500" />
                            <span>Incoming</span>
                          </>
                        )}
                      </span>

                      <span>•</span>

                      {/* Duration */}
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDuration(call.durationSeconds)}</span>
                      </span>

                      <span>•</span>

                      {/* Time */}
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{timeAgo(call.createdAt)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Call Again Action */}
                <div className="flex items-center space-x-2 self-end sm:self-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCallAgain(other.id)}
                    leftIcon={<Video className="w-3.5 h-3.5 text-indigo-600 dark:text-cyan-400" />}
                  >
                    Call Again
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} calls)
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.page <= 1}
                  onClick={() => loadHistory(pagination.page - 1)}
                  leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => loadHistory(pagination.page + 1)}
                  rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Phase 24 Create Room Modal */}
      <CreateRoomModal
        isOpen={isCreateRoomOpen}
        onClose={() => setIsCreateRoomOpen(false)}
      />
    </div>
  );
};

export default CallHistory;
