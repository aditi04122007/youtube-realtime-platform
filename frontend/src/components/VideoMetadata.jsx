import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronUp, Bell, FolderPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatNumber } from '../utils/formatNumber';
import { timeAgo } from '../utils/timeAgo';
import { getMediaUrl } from '../services/api';
import {
  subscribeToChannel,
  unsubscribeFromChannel,
  getChannelSubscriptionStatus,
} from '../services/notificationService';
import Card from './common/Card';
import VideoReactions from './VideoReactions';
import PremiumBadge from './videos/PremiumBadge';
import DownloadButton from './videos/DownloadButton';
import WatchLaterButton from './playlists/WatchLaterButton';
import SaveToPlaylistModal from './playlists/SaveToPlaylistModal';

const VideoMetadata = ({ video }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  if (!video) return null;

  const {
    title = '',
    description = '',
    view_count = 0,
    published_at,
    category,
    tags = [],
    channel = {},
  } = video;

  const channelId = channel.id || channel.handle || 'unknown';
  const channelHandle = channel.handle || channelId;
  const channelName = channel.channel_name || 'Creator';
  const channelAvatar = channel.avatar_url ? getMediaUrl(channel.avatar_url) : null;
  const channelInitial = channelName.charAt(0).toUpperCase();
  const subscriberCount = Number(channel.subscriber_count) || 0;

  const isPremium = video.is_premium || video.access?.is_premium;
  const minPlan = video.access?.minimum_plan_code || video.minimum_plan_code || 'PREMIUM';

  const { isAuthenticated, user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [currentSubCount, setCurrentSubCount] = useState(subscriberCount);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    setCurrentSubCount(subscriberCount);
  }, [subscriberCount]);

  useEffect(() => {
    if (channel.id && isAuthenticated) {
      getChannelSubscriptionStatus(channel.id)
        .then((res) => {
          if (res?.success) {
            setIsSubscribed(res.isSubscribed);
            if (typeof res.subscriberCount === 'number') {
              setCurrentSubCount(res.subscriberCount);
            }
          }
        })
        .catch(() => {});
    }
  }, [channel.id, isAuthenticated]);

  const handleSubscribeToggle = async () => {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }
    if (subscribing || !channel.id) return;
    setSubscribing(true);
    try {
      if (isSubscribed) {
        const res = await unsubscribeFromChannel(channel.id);
        if (res?.success) {
          setIsSubscribed(false);
          setCurrentSubCount((prev) => Math.max(0, prev - 1));
        }
      } else {
        const res = await subscribeToChannel(channel.id);
        if (res?.success) {
          setIsSubscribed(true);
          setCurrentSubCount((prev) => prev + 1);
        }
      }
    } catch (err) {
      console.error('Subscription toggle failed:', err);
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Title */}
      <div className="flex flex-wrap items-center gap-2.5">
        {isPremium && <PremiumBadge plan={minPlan} size="sm" />}
        <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-snug break-words">
          {title}
        </h1>
      </div>

      {/* 2. Channel Row & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        {/* Creator Channel Block */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3.5 min-w-0">
          <Link
            to={`/channel/${channelHandle}`}
            className="group/avatar flex-shrink-0"
          >
            {!avatarError && channelAvatar ? (
              <img
                src={channelAvatar}
                alt={channelName}
                onError={() => setAvatarError(true)}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700 group-hover/avatar:ring-indigo-500 transition-all"
              />
            ) : (
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 flex items-center justify-center text-white text-sm sm:text-base font-bold shadow-md">
                {channelInitial}
              </div>
            )}
          </Link>

          <div className="min-w-0 flex-1 sm:flex-initial">
            <Link
              to={`/channel/${channelHandle}`}
              className="group/name inline-flex items-center space-x-1.5 focus:outline-none max-w-full"
            >
              <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white group-hover/name:text-indigo-600 dark:group-hover/name:text-cyan-400 transition-colors truncate">
                {channelName}
              </span>
              {currentSubCount > 500 && (
                <CheckCircle2 className="w-4 h-4 text-indigo-500 dark:text-cyan-400 flex-shrink-0" />
              )}
            </Link>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {formatNumber(currentSubCount)} subscribers
            </p>
          </div>

          {/* Subscribe Button */}
          {(!user || Number(channel.user_id) !== Number(user.id)) && (
            <button
              type="button"
              disabled={subscribing}
              onClick={handleSubscribeToggle}
              className={`inline-flex items-center space-x-1.5 px-4 py-2 min-h-[38px] rounded-full text-xs font-bold shadow-xs transition-all active:scale-95 flex-shrink-0 ${
                isSubscribed
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700'
                  : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
              }`}
            >
              <Bell className={`w-3.5 h-3.5 ${isSubscribed ? 'fill-current' : ''}`} />
              <span>{isSubscribed ? 'Subscribed' : 'Subscribe'}</span>
            </button>
          )}
        </div>

        {/* Action Pills: Reactions + Download (Phase 19) + Watch Later + Save to Playlist (Phase 21) + Views Meta */}
        <div className="flex flex-wrap items-center gap-2">
          <VideoReactions
            videoId={video.id}
            initialLikeCount={video.like_count ?? video.likeCount ?? 0}
            initialDislikeCount={video.dislike_count ?? video.dislikeCount ?? 0}
          />

          <DownloadButton video={video} />

          <WatchLaterButton videoId={video.id} />

          <button
            type="button"
            onClick={() => setShowSaveModal(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all active:scale-95 shadow-2xs"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>

          <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {formatNumber(view_count)} views • {timeAgo(published_at)}
          </span>
        </div>
      </div>

      {/* Save to Playlist Modal (Phase 21) */}
      <SaveToPlaylistModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        videoId={video.id}
        videoTitle={title}
      />

      {/* 3. Description Card */}
      <Card className="p-4 bg-slate-100/90 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl space-y-2.5">
        {/* Metric Header */}
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 dark:text-white">
          <span>{Number(view_count).toLocaleString()} views</span>
          <span>•</span>
          <span>{timeAgo(published_at)}</span>
          {category && (
            <>
              <span>•</span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold">
                {category}
              </span>
            </>
          )}
        </div>

        {/* Text Description */}
        <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line break-words">
          {description ? (
            isExpanded ? (
              description
            ) : (
              <p className="line-clamp-3">{description}</p>
            )
          ) : (
            <p className="italic text-slate-400">No description provided for this video.</p>
          )}
        </div>

        {/* Tags if available */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tags.map((tag) => (
              <span
                key={tag.id || tag.name}
                className="text-xs text-indigo-600 dark:text-cyan-400 font-medium hover:underline"
              >
                #{tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Show more / Show less toggle */}
        {description && description.length > 120 && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center space-x-1 text-xs font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-cyan-400 pt-1"
          >
            <span>{isExpanded ? 'Show less' : 'Show more'}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </Card>
    </div>
  );
};

export default VideoMetadata;
