import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Video as VideoIcon, Film } from 'lucide-react';
import { getRelatedVideos } from '../services/videoService';
import { formatNumber } from '../utils/formatNumber';
import { timeAgo, formatDuration } from '../utils/timeAgo';
import { getMediaUrl } from '../services/api';
import PremiumBadge from './videos/PremiumBadge';

const RelatedVideos = ({ currentVideoId }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!currentVideoId) return;

    setLoading(true);
    getRelatedVideos(currentVideoId, 10)
      .then((res) => {
        if (!isMounted) return;
        const list = res.videos || res.data || [];
        setVideos(list);
      })
      .catch((err) => {
        console.warn('[RelatedVideos] Failed to load recommendations:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentVideoId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Related Videos
        </h3>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="flex space-x-3 p-2 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 animate-pulse"
            >
              <div className="w-28 sm:w-36 md:w-40 aspect-video bg-slate-200 dark:bg-slate-800 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
                <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded w-2/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 text-center space-y-2">
        <Film className="w-8 h-8 text-slate-400 mx-auto opacity-70" />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          No related videos found at this time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
        Related Videos
      </h3>
      <div className="space-y-2.5">
        {videos.map((vid) => {
          const thumb = vid.thumbnail_url ? getMediaUrl(vid.thumbnail_url) : null;
          const channelName = vid.channel?.channel_name || 'Creator';

          return (
            <Link
              key={vid.id}
              to={`/watch/${vid.id}`}
              className="group flex space-x-3 p-2 rounded-2xl bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800/60 hover:border-indigo-500/30 transition-all shadow-sm"
            >
              {/* Thumbnail Container */}
              <div className="relative w-28 sm:w-36 md:w-40 aspect-video rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0">
                {thumb ? (
                  <img
                    src={thumb}
                    alt={vid.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-200 dark:bg-slate-800 text-slate-400">
                    <VideoIcon className="w-6 h-6 mb-0.5" />
                    <span className="text-[9px] font-medium">StreamWave</span>
                  </div>
                )}

                {/* Premium Badge */}
                {(vid.is_premium || vid.access?.is_premium) && (
                  <div className="absolute top-1 left-1 z-10">
                    <PremiumBadge
                      plan={vid.access?.minimum_plan_code || vid.minimum_plan_code || 'PREMIUM'}
                      size="xs"
                    />
                  </div>
                )}

                {/* Duration Badge */}
                {vid.duration_seconds > 0 && (
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[10px] font-semibold text-white">
                    {formatDuration(vid.duration_seconds)}
                  </span>
                )}

                {/* Play hover badge */}
                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Text Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1">
                <h4
                  className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-cyan-400 transition-colors"
                  title={vid.title}
                >
                  {vid.title}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {channelName}
                </p>
                <div className="flex items-center space-x-1 text-[10px] text-slate-400 dark:text-slate-500">
                  <span>{formatNumber(vid.view_count)} views</span>
                  <span>•</span>
                  <span>{timeAgo(vid.published_at)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default RelatedVideos;
