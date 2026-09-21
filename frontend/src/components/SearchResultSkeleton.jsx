import React from 'react';

const SearchResultSkeleton = ({ count = 5 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 p-3 sm:p-4 flex flex-col sm:flex-row gap-4 animate-pulse"
        >
          {/* Thumbnail Skeleton */}
          <div className="aspect-video w-full sm:w-72 md:w-80 bg-slate-200 dark:bg-slate-800 rounded-xl flex-shrink-0" />

          {/* Details Skeleton */}
          <div className="flex-1 space-y-3 py-1">
            {/* Title */}
            <div className="space-y-1.5">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-4/5" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-3/5" />
            </div>

            {/* Views & Date */}
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-1/4" />

            {/* Channel */}
            <div className="flex items-center space-x-2 pt-1">
              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-24" />
            </div>

            {/* Description */}
            <div className="space-y-1 pt-1">
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-full" />
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SearchResultSkeleton;
