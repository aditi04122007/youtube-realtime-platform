import React, { useState } from 'react';
import { inviteToCallRoom } from '../../services/callRoomService';
import Button from '../common/Button';
import { UserPlus, Copy, Check, X, AlertCircle, Loader2 } from 'lucide-react';

const InviteModal = ({ isOpen, onClose, roomCode }) => {
  const [targetUserId, setTargetUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  if (!isOpen) return null;

  const roomUrl = `${window.location.origin}/call-room/${roomCode}`;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!targetUserId.trim()) return;

    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await inviteToCallRoom(roomCode, targetUserId.trim());
      if (res?.success) {
        setStatusMessage({ type: 'success', text: 'Invitation sent successfully!' });
        setTargetUserId('');
      } else {
        setStatusMessage({ type: 'error', text: res?.message || 'Failed to send invite.' });
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Error sending invitation.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-cyan-950/40 flex items-center justify-center text-indigo-600 dark:text-cyan-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Invite to Room</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Share code or invite registered users</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Copyable Room Code & Link */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Room Code & Link
          </label>
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-slate-100 dark:bg-slate-800/80 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-mono text-sm font-bold text-slate-800 dark:text-slate-200 truncate select-all">
              {roomCode}
            </div>
            <Button
              type="button"
              variant={copied ? 'secondary' : 'outline'}
              size="md"
              onClick={handleCopyLink}
              leftIcon={copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        {/* Status notice */}
        {statusMessage && (
          <div
            className={`p-3 rounded-2xl text-xs flex items-center space-x-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400'
            }`}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Direct Invite Form */}
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Invite User by ID
            </label>
            <input
              type="number"
              min="1"
              required
              placeholder="Enter user ID (e.g. 42)"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-cyan-400 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="pt-2 flex items-center space-x-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="flex-1"
              onClick={onClose}
              disabled={loading}
            >
              Close
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="flex-1"
              disabled={loading || !targetUserId.trim()}
              leftIcon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            >
              {loading ? 'Sending...' : 'Send Invite'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteModal;
