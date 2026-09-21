import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Play, CheckCircle2, Video as VideoIcon } from 'lucide-react';
import { formatNumber } from '../utils/formatNumber';
import { timeAgo, formatDuration } from '../utils/timeAgo';
import { getMediaUrl } from '../services/api';
import PremiumBadge from './videos/PremiumBadge';

const SearchResultCard = ({ video, className = '' }) => {
  const [thumbError, setThumbError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const navigate = useNavigate();

  if (!video) return null;

  const {
    id,
    title,
    description,
    thumbnail_url,
    duration_seconds,
    view_count,
    published_at,
    category,
    channel = {},
  } = video;

  const channelId = channel.id || channel.handle || 'unknown';
  const channelHandle = channel.handle || channelId;
  const channelName = channel.channel_name || 'Creator';
  const channelAvatar = channel.avatar_url ? getMediaUrl(channel.avatar_url) : null;
  const channelInitial = channelName.charAt(0).toUpperCase();

  const resolvedThumbnail = thumbnail_url ? getMediaUrl(thumbnail_url) : null;

  const handleCardClick = (e) => {
    if (e.target.closest('.channel-link')) return;
    navigate(`/watch/${id}`);
  };

  return (
    <article
      onClick={handleCardClick}
      className={`group cursor-pointer rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-500/40 dark:hover:border-indigo-500/30 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/5 overflow-hidden p-3 sm:p-4 flex flex-col sm:flex-row gap-4 items-start ${className}`}
    >
      {/* 1. 16:9 Thumbnail */}
      <div className="relative aspect-video w-full sm:w-72 md:w-80 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
        {!thumbError && resolvedThumbnail ? (
          <img
            src={resolvedThumbnail}
            alt={title}
            onError={() => setThumbError(true)}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 text-slate-400 dark:text-slate-600">
            <VideoIcon className="w-10 h-10 mb-1 opacity-70 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-medium tracking-wide">StreamWave</span>
          </div>
        )}

        {/* Hover Play Button Overlay */}
        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-11 h-11 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>

        {/* Premium Badge */}
        {(video.is_premium || video.access?.is_premium) && (
          <div className="absolute top-2 left-2 z-10 shadow-md">
            <PremiumBadge
              plan={video.access?.minimum_plan_code || video.minimum_plan_code || 'PREMIUM'}
              size="xs"
            />
          </div>
        )}

        {/* Duration Badge */}
        {duration_seconds > 0 && (
          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-[11px] font-semibold text-white tracking-wide">
            {formatDuration(duration_seconds)}
          </span>
        )}
      </div>

      {/* 2. Metadata Section */}
      <div className="flex-1 min-w-0 flex flex-col justify-between h-full space-y-2 py-0.5">
        <div>
          {/* Title */}
          <h2
            className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug break-words group-hover:text-indigo-600 dark:group-hover:text-cyan-400 transition-colors"
            title={title}
          >
            {title}
          </h2>

          {/* Metrics */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>{formatNumber(view_count)} views</span>
            <span>•</span>
            <span>{timeAgo(published_at)}</span>
            {category && (
              <>
                <span>•</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  {category}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Channel Row */}
        <Link
          to={`/channel/${channelHandle}`}
          onClick={(e) => e.stopPropagation()}
          className="channel-link inline-flex items-center space-x-2.5 pt-1 group/channel focus:outline-none"
        >
          {!avatarError && channelAvatar ? (
            <img
              src={channelAvatar}
              alt={channelName}
              onError={() => setAvatarError(true)}
              className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700 group-hover/channel:ring-indigo-500 transition-all flex-shrink-0"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 flex items-center justify-center text-white text-[11px] font-bold shadow-sm flex-shrink-0">
              {channelInitial}
            </div>
          )}

          <div className="flex items-center space-x-1 min-w-0">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover/channel:text-indigo-600 dark:group-hover/channel:text-cyan-400 truncate">
              {channelName}
            </span>
            {channel.subscriber_count > 500 && (
              <CheckCircle2
                className="w-3.5 h-3.5 text-indigo-500 dark:text-cyan-400 flex-shrink-0"
                title="Verified Channel"
              />
            )}
          </div>
        </Link>

        {/* Description Snippet */}
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed pt-1 break-words">
            {description}
          </p>
        )}
      </div>
    </article>
  );
};

export default SearchResultCard;
