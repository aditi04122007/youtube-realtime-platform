import React from 'react';
import { Loader2 } from 'lucide-react';

const Loading = ({
  type = 'spinner', // 'spinner' | 'skeleton' | 'overlay'
  message = 'Loading...',
  className = '',
}) => {
  if (type === 'skeleton') {
    return (
      <div className={`animate-pulse space-y-3 ${className}`}>
        <div className="aspect-video bg-slate-200 dark:bg-slate-800 rounded-2xl w-full" />
        <div className="flex space-x-3">
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (type === 'overlay') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center p-8 space-y-3 ${className}`}>
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      {message && (
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {message}
        </p>
      )}
    </div>
  );
};

export default Loading;
