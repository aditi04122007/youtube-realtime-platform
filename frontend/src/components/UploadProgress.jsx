import React from 'react';
import { Loader2, XCircle, CheckCircle2 } from 'lucide-react';

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const UploadProgress = ({
  progress = 0,
  loadedBytes = 0,
  totalBytes = 0,
  isProcessing = false,
  onCancel = null,
}) => {
  const isComplete = progress >= 100 && !isProcessing;

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          {progress < 100 ? (
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
              {progress}%
            </div>
          ) : isProcessing ? (
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {progress < 100
                ? 'Uploading video file...'
                : isProcessing
                ? 'Finalizing and processing video...'
                : 'Upload complete!'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {progress < 100 && totalBytes > 0
                ? `${formatBytes(loadedBytes)} of ${formatBytes(totalBytes)}`
                : isProcessing
                ? 'Saving metadata, categories, and tags'
                : 'Video has been successfully processed'}
            </p>
          </div>
        </div>

        {onCancel && progress < 100 && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 flex items-center space-x-1 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <XCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Cancel Upload</span>
          </button>
        )}
      </div>

      {/* Progress Track */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            progress < 100
              ? 'bg-gradient-to-r from-indigo-500 to-indigo-600'
              : isProcessing
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 animate-pulse'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-600'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>

      {isProcessing && (
        <div className="flex items-center space-x-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 rounded-xl">
          <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
          <span>Upload finished. Waiting for server verification... Do not close this window.</span>
        </div>
      )}
    </div>
  );
};

export default UploadProgress;
