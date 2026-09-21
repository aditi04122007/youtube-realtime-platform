import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Clock,
  UserCheck,
  Loader2,
  X,
  History,
  ShieldBan,
  RefreshCw,
} from 'lucide-react';
import { fetchModerationHistory, unblockParticipant } from '../../services/callModerationService';
import Button from '../common/Button';

const ACTION_LABELS = {
  MUTE: { label: 'Microphone Muted', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  UNMUTE: { label: 'Microphone Allowed', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  CAMERA_DISABLE: { label: 'Camera Disabled', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  CAMERA_ENABLE: { label: 'Camera Allowed', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  REMOVE: { label: 'Removed from Room', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  BLOCK_REJOIN: { label: 'Blocked from Rejoining', color: 'bg-red-500/30 text-red-300 border-red-500/40' },
  UNBLOCK_REJOIN: { label: 'Unblocked', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
  END_ROOM: { label: 'Room Ended', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  REPORT: { label: 'Confidential Report', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
};

const ModerationHistoryModal = ({
  isOpen,
  onClose,
  roomCode,
}) => {
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'blocks'
  const [history, setHistory] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unblockingId, setUnblockingId] = useState(null);

  const loadData = async () => {
    if (!roomCode) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchModerationHistory(roomCode);
      if (data?.success) {
        setHistory(data.history || []);
        setBlocks(data.blocks || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load moderation logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, roomCode]);

  const handleUnblock = async (userId) => {
    setUnblockingId(userId);
    try {
      await unblockParticipant(roomCode, userId);
      // Refresh
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to unblock participant.');
    } finally {
      setUnblockingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 pr-10">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-cyan-950/50 text-indigo-600 dark:text-cyan-400 border border-indigo-200 dark:border-cyan-900/50">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Room Moderation Log
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Audit history and active bans for room <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{roomCode}</span>
              </p>
            </div>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 pt-4 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit History ({history.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('blocks')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'blocks'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldBan className="w-3.5 h-3.5" />
            <span>Banned Users ({blocks.length})</span>
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {loading && history.length === 0 && blocks.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="text-xs">Loading logs...</p>
            </div>
          ) : error ? (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 rounded-xl text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          ) : activeTab === 'history' ? (
            /* History Tab */
            history.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No moderation actions have been recorded yet for this room.
              </div>
            ) : (
              <div className="space-y-2.5">
                {history.map((item) => {
                  const cfg = ACTION_LABELS[item.action] || {
                    label: item.action,
                    color: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
                  };
                  const dateStr = item.createdAt
                    ? new Date(item.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : '';

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-start justify-between space-x-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold uppercase tracking-wide ${cfg.color}`}
                          >
                            {cfg.label}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{dateStr}</span>
                          </span>
                        </div>
                        <div className="text-slate-800 dark:text-slate-200">
                          <span className="font-semibold">{item.actorName || 'Host'}</span>
                          {item.targetName && (
                            <>
                              {' '}→{' '}
                              <span className="font-semibold text-indigo-600 dark:text-cyan-400">
                                {item.targetName}
                              </span>
                            </>
                          )}
                        </div>
                        {item.reason && (
                          <div className="text-slate-500 dark:text-slate-400 italic">
                            Reason: {item.reason}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Blocks Tab */
            blocks.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No users are currently blocked from this room.
              </div>
            ) : (
              <div className="space-y-2.5">
                {blocks.map((block) => {
                  const dateStr = block.createdAt
                    ? new Date(block.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';

                  return (
                    <div
                      key={block.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between space-x-3"
                    >
                      <div className="space-y-0.5 text-xs">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {block.userName || `User #${block.userId}`}
                        </div>
                        {block.reason && (
                          <div className="text-slate-500 dark:text-slate-400 italic">
                            Reason: {block.reason}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400 flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Blocked on {dateStr}</span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={unblockingId === block.userId}
                        onClick={() => handleUnblock(block.userId)}
                        leftIcon={
                          unblockingId === block.userId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                          )
                        }
                        className="text-xs"
                      >
                        Unblock
                      </Button>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ModerationHistoryModal;
