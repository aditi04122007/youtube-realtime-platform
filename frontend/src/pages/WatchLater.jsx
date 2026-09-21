import React, { useState, useEffect } from 'react';
import { Clock, Play, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';
import Loading from '../components/common/Loading';
import Card from '../components/common/Card';
import PremiumBadge from '../components/videos/PremiumBadge';
import { useAuth } from '../context/AuthContext';
import { getWatchLater, removeFromWatchLater } from '../services/watchLaterService';
import { getMediaUrl } from '../services/api';
import { formatNumber } from '../utils/formatNumber';
import { timeAgo, formatDuration } from '../utils/timeAgo';

const WatchLater = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    if (user) {
      fetchWatchLater(1);
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchWatchLater = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getWatchLater({ page, limit: 20 });
      setVideos(res.data || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load Watch Later videos');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (videoId) => {
    setActionLoading((prev) => ({ ...prev, [videoId]: true }));
    try {
      await removeFromWatchLater(videoId);
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      setPagination((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
      }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove from Watch Later');
    } finally {
      setActionLoading((prev) => ({ ...prev, [videoId]: false }));
    }
  };

  const firstVideo = videos.length > 0 ? videos[0] : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-cyan-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Watch Later
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {pagination.total > 0
                ? `${pagination.total} ${pagination.total === 1 ? 'video' : 'videos'} saved to watch`
                : 'Save videos to watch whenever you have time'}
            </p>
          </div>
        </div>

        {firstVideo && (
          <Link to={`/watch/${firstVideo.id}`}>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Play className="w-4 h-4 fill-current" />}
            >
              Play All
            </Button>
          </Link>
        )}
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <Loading size="lg" message="Loading saved videos..." />
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 text-xs text-red-600 dark:text-red-400 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : videos.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No videos in Watch Later"
          description="Videos you save for later will appear here. Start exploring to find videos you like."
          action={
            <Link to="/">
              <Button variant="primary" size="sm" leftIcon={<Play className="w-4 h-4" />}>
                Explore Videos
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2.5">
            {videos.map((vid, index) => {
              const vidThumb = vid.thumbnailUrl ? getMediaUrl(vid.thumbnailUrl) : null;
              const progress = vid.watchProgress;
              const isRemoving = actionLoading[vid.id];

              return (
                <div
                  key={vid.id}
                  className="group relative flex items-center space-x-3 sm:space-x-4 p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-500/40 dark:hover:border-indigo-500/30 transition-all"
                >
                  {/* Position number */}
                  <div className="w-5 text-center text-xs font-bold text-slate-400">
                    {index + 1}
                  </div>

                  {/* Thumbnail with duration and watch progress */}
                  <Link
                    to={`/watch/${vid.id}`}
                    className="relative w-32 sm:w-44 aspect-video flex-shrink-0 rounded-xl overflow-hidden bg-slate-900 group/thumb block"
                  >
                    {vidThumb ? (
                      <img
                        src={vidThumb}
                        alt={vid.title}
                        className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
                        <Play className="w-6 h-6" />
                      </div>
                    )}

                    {vid.durationSeconds > 0 && (
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-semibold text-white">
                        {formatDuration(vid.durationSeconds)}
                      </span>
                    )}

                    {/* Progress bar */}
                    {progress && progress.progressPercent > 0 && (
                      <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-700/80">
                        <div
                          className="h-full bg-red-600"
                          style={{ width: `${progress.progressPercent}%` }}
                        />
                      </div>
                    )}
                  </Link>

                  {/* Details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center space-x-1.5">
                      {vid.access?.isPremium && (
                        <PremiumBadge
                          plan={vid.access.minimumPlanCode || 'PREMIUM'}
                          size="xs"
                        />
                      )}
                      <Link
                        to={`/watch/${vid.id}`}
                        className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-cyan-400 transition-colors line-clamp-2 leading-snug"
                      >
                        {vid.title}
                      </Link>
                    </div>

                    {vid.channel && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {vid.channel.name}
                      </p>
                    )}

                    <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                      <span>{formatNumber(vid.viewCount)} views</span>
                      <span>•</span>
                      <span>Saved {timeAgo(vid.addedAt)}</span>
                      {progress?.completed && (
                        <span className="inline-flex items-center space-x-0.5 text-emerald-500 font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Watched</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <Link to={`/watch/${vid.id}`}>
                      <Button
                        variant="secondary"
                        size="xs"
                        leftIcon={<Play className="w-3 h-3 fill-current" />}
                        className="hidden sm:inline-flex"
                      >
                        Watch
                      </Button>
                    </Link>

                    <button
                      type="button"
                      disabled={isRemoving}
                      onClick={() => handleRemove(vid.id)}
                      title="Remove from Watch Later"
                      className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 pt-6">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchWatchLater(pagination.page - 1)}
              >
                Previous
              </Button>
              <span className="text-xs text-slate-500 px-3">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchWatchLater(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WatchLater;
