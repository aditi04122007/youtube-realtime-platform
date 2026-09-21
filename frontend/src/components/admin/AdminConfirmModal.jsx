import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, ShieldAlert } from 'lucide-react';
import Button from '../common/Button';

const AdminConfirmModal = ({
  isOpen,
  title = 'Confirm Administrative Action',
  message = 'Are you sure you want to proceed with this action?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  requireReason = false,
  reasonPlaceholder = 'Provide a reason for administrative audit logging...',
  onConfirm,
  onClose,
  loading = false,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireReason && !reason.trim()) {
      setError('A reason is mandatory for this administrative action');
      return;
    }
    setError('');
    onConfirm(reason.trim());
  };

  const getVariantStyles = () => {
    switch (confirmVariant) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 text-white';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white';
      default:
        return 'bg-indigo-600 hover:bg-indigo-700 text-white';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2.5 text-slate-900 dark:text-white">
            <div className={`p-2 rounded-xl ${confirmVariant === 'danger' ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold">{title}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-sm">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            {message}
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Reason {requireReason && <span className="text-rose-500">*</span>}
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              rows={3}
              placeholder={reasonPlaceholder}
              disabled={loading}
              className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
            />
            {error && (
              <p className="text-xs text-rose-500 mt-1 flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{error}</span>
              </p>
            )}
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              This action and reason will be immutably recorded in the platform administrative audit log.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-2.5 p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`px-4 py-2 text-xs font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 ${getVariantStyles()}`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminConfirmModal;
