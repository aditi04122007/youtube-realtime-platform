import React from 'react';
import { Globe, Lock, EyeOff, CheckCircle2, Clock, AlertTriangle, Trash2 } from 'lucide-react';

export const VisibilityBadge = ({ visibility = 'PUBLIC', className = '' }) => {
  const vis = String(visibility).toUpperCase();

  switch (vis) {
    case 'PUBLIC':
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 ${className}`}
        >
          <Globe className="w-3 h-3 mr-1" />
          Public
        </span>
      );
    case 'UNLISTED':
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 ${className}`}
        >
          <EyeOff className="w-3 h-3 mr-1" />
          Unlisted
        </span>
      );
    case 'PRIVATE':
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 ${className}`}
        >
          <Lock className="w-3 h-3 mr-1" />
          Private
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 ${className}`}>
          {vis}
        </span>
      );
  }
};

export const StatusBadge = ({ status = 'PUBLISHED', className = '' }) => {
  const st = String(status).toUpperCase();

  switch (st) {
    case 'PUBLISHED':
    case 'READY':
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 ${className}`}
        >
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {st === 'PUBLISHED' ? 'Published' : 'Ready'}
        </span>
      );
    case 'PROCESSING':
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 ${className}`}
        >
          <Clock className="w-3 h-3 mr-1 animate-spin" />
          Processing
        </span>
      );
    case 'FAILED':
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 ${className}`}
        >
          <AlertTriangle className="w-3 h-3 mr-1" />
          Failed
        </span>
      );
    case 'DELETED':
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 ${className}`}
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Deleted
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 ${className}`}>
          {st}
        </span>
      );
  }
};

export default {
  VisibilityBadge,
  StatusBadge,
};
