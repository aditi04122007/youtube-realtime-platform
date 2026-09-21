import React, { useState } from 'react';
import { Flag, ShieldCheck, Loader2, X } from 'lucide-react';
import Button from '../common/Button';

const REPORT_CATEGORIES = [
  'Harassment',
  'Abusive behavior',
  'Inappropriate content',
  'Spam',
  'Impersonation',
  'Privacy violation',
  'Other',
];

const ReportModal = ({
  isOpen,
  onClose,
  participant,
  onSubmit, // async ({ category, reason, details }) => Promise<void>
}) => {
  const [category, setCategory] = useState(REPORT_CATEGORIES[0]);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !participant) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onSubmit({
        targetUserId: participant.userId,
        category,
        reason: category,
        details: details.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setCategory(REPORT_CATEGORIES[0]);
        setDetails('');
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to submit report.');
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
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 flex-shrink-0">
            <Flag className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Report Participant
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Reporting: <span className="font-semibold text-slate-800 dark:text-slate-200">{participant.name}</span>
            </p>
          </div>
        </div>

        {/* Confidentiality Notice */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-start space-x-2.5 text-xs text-slate-600 dark:text-slate-300">
          <ShieldCheck className="w-4 h-4 text-cyan-500 flex-shrink-0 mt-0.5" />
          <span>
            Reports are strictly confidential. The reported user and other participants in the call will not be notified.
          </span>
        </div>

        {success ? (
          <div className="py-6 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white">Report Submitted</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Thank you for helping keep our community safe.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 rounded-xl text-xs text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}

            {/* Category Select */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Reason for report <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {REPORT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Details textarea */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Additional Details (Optional)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Provide any context that helps explain the violation..."
                disabled={loading}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
              <div className="text-right text-[11px] text-slate-400">
                {details.length} / 1000
              </div>
            </div>

            {/* Submit / Cancel */}
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
                variant="primary"
                size="md"
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                disabled={loading}
                leftIcon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
