import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Button from './Button';

const ErrorMessage = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while loading content.',
  onRetry = null,
  className = '',
}) => {
  return (
    <div
      className={`rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${className}`}
      role="alert"
    >
      <div className="flex items-start space-x-3">
        <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex-shrink-0">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-rose-900 dark:text-rose-200">
            {title}
          </h4>
          <p className="text-xs text-rose-700 dark:text-rose-300/80 mt-0.5">
            {message}
          </p>
        </div>
      </div>

      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          className="border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40"
        >
          Retry
        </Button>
      )}
    </div>
  );
};

export default ErrorMessage;
