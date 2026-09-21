import React, { useState, useEffect, useRef } from 'react';
import { Flag, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { getReportReasons, submitCommentReport } from '../services/moderationService';
import Modal from './common/Modal';
import Button from './common/Button';

// Module-level cache for reasons
let cachedReasonsPromise = null;

const fetchReasonsCached = () => {
  if (!cachedReasonsPromise) {
    cachedReasonsPromise = getReportReasons()
      .then((res) => (res && res.reasons) || [])
      .catch((err) => {
        cachedReasonsPromise = null;
        throw err;
      });
  }
  return cachedReasonsPromise;
};

const ReportCommentModal = ({
  isOpen,
  onClose,
  commentId,
  commentAuthor = 'this user',
  onReportSuccess,
}) => {
  const [reasons, setReasons] = useState([]);
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [loadingReasons, setLoadingReasons] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Load reasons when modal opens
  useEffect(() => {
    if (isOpen) {
      setError('');
      setIsSuccess(false);
      setSelectedReason('');
      setDescription('');
      setLoadingReasons(true);

      fetchReasonsCached()
        .then((data) => {
          setReasons(data);
          setLoadingReasons(false);
        })
        .catch((err) => {
          setError('Failed to load report categories. Please check your connection.');
          setLoadingReasons(false);
        });
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedReason || isSubmitting) return;

    setIsSubmitting(true);
    setError('');

    try {
      const result = await submitCommentReport(commentId, {
        reason: selectedReason,
        description: description.trim() || undefined,
      });

      setIsSuccess(true);
      if (onReportSuccess) {
        onReportSuccess(result.report);
      }

      // Auto close after 2.5 seconds on success
      setTimeout(() => {
        if (isOpen) {
          onClose();
        }
      }, 2500);
    } catch (err) {
      console.error('[ReportCommentModal] Submission error:', err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Unable to submit report. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center space-x-2 text-slate-900 dark:text-white text-base font-bold">
          <Flag className="w-5 h-5 text-rose-500" />
          <span>Report comment</span>
        </div>
      }
      size="md"
    >
      {isSuccess ? (
        <div className="py-8 px-2 text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Report submitted successfully
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            Thank you for helping keep the community safe. Our moderation team will review this comment according to our guidelines.
          </p>
          <div className="pt-2">
            <Button variant="secondary" size="sm" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Why are you reporting this comment by <span className="font-semibold text-slate-900 dark:text-white">{commentAuthor}</span>?
          </p>

          {/* Error Notice */}
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Reasons Radio List */}
          {loadingReasons ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-2 text-xs text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              <span>Loading reasons...</span>
            </div>
          ) : (
            <div
              className="max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 dark:divide-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 p-2"
              role="radiogroup"
              aria-label="Report reasons"
            >
              {reasons.map((r) => {
                const isSelected = selectedReason === r.code;
                return (
                  <label
                    key={r.code}
                    className={`pt-1.5 first:pt-0 flex items-start space-x-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-rose-50/70 dark:bg-rose-950/30 text-rose-950 dark:text-rose-100'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="report_reason"
                      value={r.code}
                      checked={isSelected}
                      onChange={() => setSelectedReason(r.code)}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500 focus:ring-offset-0 border-slate-300 dark:border-slate-600"
                    />
                    <div className="text-xs">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{r.label}</div>
                      {r.description && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          {r.description}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {/* Optional Details Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="report-desc" className="font-medium text-slate-700 dark:text-slate-300">
                Additional details <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <span
                className={`text-[11px] ${
                  description.length > 900 ? 'text-amber-500 font-bold' : 'text-slate-400'
                }`}
              >
                {description.length} / 1000
              </span>
            </div>
            <textarea
              id="report-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              placeholder="Provide extra context to help our moderation team understand the violation..."
              rows={3}
              className="w-full text-xs rounded-xl p-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:focus:ring-rose-400 resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              disabled={!selectedReason || isSubmitting || loadingReasons}
              className="flex items-center space-x-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Flag className="w-3.5 h-3.5 mr-1" />
                  <span>Submit report</span>
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default ReportCommentModal;
