import React from 'react';

const VideoCardSkeleton = ({ className = '' }) => {
  return (
    <div
      className={`flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 animate-pulse ${className}`}
    >
      {/* Thumbnail Skeleton (16:9) */}
      <div className="aspect-video w-full bg-slate-200 dark:bg-slate-800" />

      {/* Metadata Skeleton */}
      <div className="p-3.5 flex space-x-3 flex-1">
        {/* Avatar Circle */}
        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0 mt-0.5" />

        {/* Text Lines */}
        <div className="flex-1 space-y-2 py-0.5">
          {/* Title Lines */}
          <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-11/12" />
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-8/12" />

          {/* Channel Name Line */}
          <div className="h-2.5 bg-slate-200 dark:bg-slate-800/80 rounded w-5/12 pt-1" />

          {/* Views & Timestamp Line */}
          <div className="h-2.5 bg-slate-200 dark:bg-slate-800/60 rounded w-4/12" />
        </div>
      </div>
    </div>
  );
};

export default VideoCardSkeleton;
