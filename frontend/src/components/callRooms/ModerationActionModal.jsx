import React, { useState } from 'react';
import { AlertTriangle, UserX, ShieldBan, MicOff, VideoOff, Loader2, X } from 'lucide-react';
import Button from '../common/Button';

const ACTION_CONFIGS = {
  MUTE: {
    title: 'Mute Participant',
    description: 'This will forcibly mute the participant’s microphone. They will not be able to unmute themselves until you allow it.',
    icon: MicOff,
    confirmText: 'Mute Microphone',
    variant: 'danger',
    reasons: ['Background noise', 'Speaking out of turn', 'Disruptive audio', 'Other'],
  },
  CAMERA_DISABLE: {
    title: 'Disable Participant Camera',
    description: 'This will turn off the participant’s camera feed. They will not be able to turn it back on until you allow it.',
    icon: VideoOff,
    confirmText: 'Turn Off Camera',
    variant: 'danger',
    reasons: ['Inappropriate video stream', 'Bandwidth conservation', 'Disruptive visuals', 'Other'],
  },
  REMOVE: {
    title: 'Remove Participant',
    description: 'This will immediately disconnect the participant from the call room. They will not be able to rejoin unless invited or permitted.',
    icon: UserX,
    confirmText: 'Remove Participant',
    variant: 'danger',
    reasons: ['Inappropriate behavior', 'Spam / Disruptive', 'Uninvited guest', 'Other'],
  },
  BLOCK: {
    title: 'Block Participant from Room',
    description: 'This will disconnect the participant and add them to this room’s ban list. They will be strictly blocked from rejoining.',
    icon: ShieldBan,
    confirmText: 'Block and Eject',
    variant: 'danger',
    reasons: ['Harassment or abuse', 'Repeated rule violations', 'Trolling / malicious intent', 'Other'],
  },
};

const ModerationActionModal = ({
  isOpen,
  onClose,
  actionType, // 'MUTE' | 'CAMERA_DISABLE' | 'REMOVE' | 'BLOCK'
  participant,
  onConfirm, // async (reason) => Promise<void>
}) => {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !actionType || !participant) return null;

  const config = ACTION_CONFIGS[actionType] || {
    title: 'Moderate Participant',
    description: 'Confirm this moderation action.',
    icon: AlertTriangle,
    confirmText: 'Confirm',
    variant: 'danger',
    reasons: ['Violation of rules', 'Other'],
  };

  const Icon = config.icon;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const finalReason = reason === 'Other' ? (customReason || 'Other') : (reason || config.reasons[0]);

    try {
      await onConfirm(finalReason);
      setReason('');
      setCustomReason('');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Action failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start space-x-3.5">
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 flex-shrink-0">
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {config.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Target: <span className="font-semibold text-slate-800 dark:text-slate-200">{participant.name}</span>
            </p>
          </div>
        </div>

        {/* Action Warning */}
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {config.description}
        </p>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 rounded-xl text-xs text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* Reason Selector */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Reason (Optional)
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="">Select a reason...</option>
              {config.reasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {reason === 'Other' && (
            <div className="space-y-1.5">
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Specify reason..."
                maxLength={255}
                disabled={loading}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="flex-1"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="md"
              className="flex-1"
              disabled={loading}
              leftIcon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            >
              {loading ? 'Processing...' : config.confirmText}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModerationActionModal;
