import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Play, CheckCircle2, Video as VideoIcon } from 'lucide-react';
import { formatNumber } from '../utils/formatNumber';
import { timeAgo, formatDuration } from '../utils/timeAgo';
import { getMediaUrl } from '../services/api';
import PremiumBadge from './videos/PremiumBadge';
import WatchLaterButton from './playlists/WatchLaterButton';

const VideoCard = ({ video, className = '' }) => {
  const [thumbError, setThumbError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const navigate = useNavigate();

  if (!video) return null;

  const {
    id,
    title,
    thumbnail_url,
    duration_seconds,
    view_count,
    published_at,
    channel = {},
  } = video;

  const channelId = channel.id || channel.handle || 'unknown';
  const channelName = channel.channel_name || 'Creator';
  const channelAvatar = channel.avatar_url ? getMediaUrl(channel.avatar_url) : null;
  const channelInitial = channelName.charAt(0).toUpperCase();

  // Handle media URL for thumbnail
  const resolvedThumbnail = thumbnail_url ? getMediaUrl(thumbnail_url) : null;

  const handleCardClick = (e) => {
    // If user clicked directly on channel link/avatar, don't trigger video navigation
    if (e.target.closest('.channel-link')) return;
    navigate(`/watch/${id}`);
  };

  return (
    <article
      onClick={handleCardClick}
      className={`group cursor-pointer flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-500/40 dark:hover:border-indigo-500/30 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/5 ${className}`}
    >
      {/* 1. Thumbnail Container (16:9 Aspect Ratio) */}
      <div className="relative aspect-video w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
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

        {/* Quick Watch Later button on top right */}
        <div className="absolute top-2 right-2 z-10 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <WatchLaterButton videoId={id} variant="icon" />
        </div>

        {/* Duration Badge */}
        {duration_seconds > 0 && (
          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-[11px] font-semibold text-white tracking-wide">
            {formatDuration(duration_seconds)}
          </span>
        )}
      </div>

      {/* 2. Metadata Section */}
      <div className="p-3 sm:p-3.5 flex space-x-3 flex-1">
        {/* Channel Avatar */}
        <Link
          to={`/channel/${channel.handle || channelId}`}
          onClick={(e) => e.stopPropagation()}
          className="channel-link flex-shrink-0 mt-0.5 group/avatar focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full"
          title={channelName}
        >
          {!avatarError && channelAvatar ? (
            <img
              src={channelAvatar}
              alt={channelName}
              onError={() => setAvatarError(true)}
              className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700 group-hover/avatar:ring-indigo-500 transition-all"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
              {channelInitial}
            </div>
          )}
        </Link>

        {/* Video & Channel Details */}
        <div className="flex-1 min-w-0">
          {/* Title (2-line clamp) */}
          <h3
            className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug break-words group-hover:text-indigo-600 dark:group-hover:text-cyan-400 transition-colors"
            title={title}
          >
            {title}
          </h3>

          {/* Channel Name */}
          <div className="mt-1 flex items-center space-x-1 min-w-0">
            <Link
              to={`/channel/${channel.handle || channelId}`}
              onClick={(e) => e.stopPropagation()}
              className="channel-link text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:underline truncate max-w-full"
            >
              {channelName}
            </Link>
            {channel.subscriber_count > 500 && (
              <CheckCircle2
                className="w-3.5 h-3.5 text-indigo-500 dark:text-cyan-400 flex-shrink-0"
                title="Verified Channel"
              />
            )}
          </div>

          {/* Metadata: Views & Relative Time */}
          <div className="flex items-center space-x-1 text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            <span>{formatNumber(view_count)} views</span>
            <span>•</span>
            <span>{timeAgo(published_at)}</span>
          </div>
        </div>
      </div>
    </article>
  );
};

export default VideoCard;
