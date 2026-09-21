import React from 'react';
import VideoCard from './VideoCard';
import VideoCardSkeleton from './VideoCardSkeleton';

const VideoSection = ({
  title,
  icon: Icon,
  videos = [],
  loading = false,
  skeletonCount = 4,
  actionLabel,
  onAction,
  emptyMessage = 'No videos in this section yet.',
  className = '',
}) => {
  // If not loading and no videos, we can either render the section with empty state or omit
  if (!loading && (!videos || videos.length === 0)) {
    return null;
  }

  return (
    <section className={`space-y-4 ${className}`}>
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          {Icon && (
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-cyan-400">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h2>
        </div>

        {actionLabel && (
          <button
            onClick={onAction}
            className="text-xs font-semibold text-indigo-600 dark:text-cyan-400 hover:text-indigo-700 dark:hover:text-cyan-300 hover:underline transition-colors"
          >
            {actionLabel}
          </button>
        )}
      </div>

      {/* Responsive Video Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-5">
        {loading
          ? Array.from({ length: skeletonCount }).map((_, index) => (
              <VideoCardSkeleton key={`skeleton-${index}`} />
            ))
          : videos.map((video) => <VideoCard key={video.id} video={video} />)}
      </div>
    </section>
  );
};

export default VideoSection;
