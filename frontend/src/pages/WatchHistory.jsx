import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  Trash2,
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Film,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import {
  getWatchHistory,
  getContinueWatching,
  deleteWatchHistoryItem,
  clearWatchHistory,
} from '../services/videoService';
import { getMediaUrl } from '../services/api';
import { formatDuration } from '../utils/formatDuration';
import { timeAgo } from '../utils/timeAgo';
import { formatNumber } from '../utils/formatNumber';

const WatchHistory = () => {
  const [historyItems, setHistoryItems] = useState([]);
  const [continueItems, setContinueItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  // Modal & Action states
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Load continue watching and full history
  const loadData = useCallback(async (targetPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const [historyRes, continueRes] = await Promise.all([
        getWatchHistory({ page: targetPage, limit: 20 }),
        getContinueWatching().catch(() => ({ items: [] })),
      ]);

      if (historyRes && historyRes.success) {
        setHistoryItems(historyRes.items || []);
        if (historyRes.pagination) {
          setPagination(historyRes.pagination);
          setPage(historyRes.pagination.page);
        }
      }

      if (continueRes && continueRes.success) {
        setContinueItems(continueRes.items || []);
      }
    } catch (err) {
      console.error('[WatchHistory] Failed to load watch history:', err);
      setError(err.message || 'Unable to load watch history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(page);
  }, [loadData, page]);

  // Handle single item removal
  const handleRemoveItem = async (e, videoId) => {
    e.preventDefault();
    e.stopPropagation();

    setRemovingId(videoId);
    try {
      await deleteWatchHistoryItem(videoId);

      // Immediately update local states
      setHistoryItems((prev) => prev.filter((item) => item.videoId !== videoId));
      setContinueItems((prev) => prev.filter((item) => item.videoId !== videoId));
      setPagination((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
      }));

      setActionFeedback('Video removed from watch history');
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err) {
      console.error('[WatchHistory] Failed to remove item:', err);
      setActionFeedback('Failed to remove video. Please try again.');
      setTimeout(() => setActionFeedback(null), 3000);
    } finally {
      setRemovingId(null);
    }
  };

  // Handle clearing entire history
  const handleClearAll = async () => {
    setClearing(true);
    try {
      await clearWatchHistory();
      setHistoryItems([]);
      setContinueItems([]);
      setPagination({ page: 1, limit: 20, total: 0, totalPages: 1 });
      setIsClearModalOpen(false);
      setActionFeedback('Watch history cleared');
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err) {
      console.error('[WatchHistory] Failed to clear history:', err);
      setActionFeedback('Failed to clear watch history.');
      setTimeout(() => setActionFeedback(null), 3000);
    } finally {
      setClearing(false);
    }
  };

  // 1. Loading Skeleton State
  if (loading && historyItems.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 pb-16">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse" />
          </div>
          <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
        </div>

        {/* Continue Watching Skeleton */}
        <div className="space-y-4">
          <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="aspect-video bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>

        {/* History List Skeleton */}
        <div className="space-y-4">
          <div className="h-5 w-36 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4 p-4 rounded-2xl bg-slate-200/60 dark:bg-slate-800/40 animate-pulse">
              <div className="w-48 aspect-video bg-slate-200 dark:bg-slate-800 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2 py-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error && historyItems.length === 0) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <Card className="p-8 space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Unable to load watch history</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{error}</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => loadData(page)}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            className="w-full"
          >
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const hasHistory = historyItems.length > 0;
  const hasContinueWatching = continueItems.length > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Toast Feedback Notification */}
      {actionFeedback && (
        <div className="fixed bottom-20 right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold shadow-2xl flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-cyan-400 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <span>Watch History</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {pagination.total > 0
              ? `${pagination.total} video${pagination.total === 1 ? '' : 's'} in your watch history`
              : 'Track videos you have watched and resume where you left off'}
          </p>
        </div>

        {hasHistory && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsClearModalOpen(true)}
            icon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
            className="hover:border-rose-300 dark:hover:border-rose-900 text-slate-700 dark:text-slate-200 self-start sm:self-auto"
          >
            Clear History
          </Button>
        )}
      </div>

      {/* 3. Global Empty State (No history at all) */}
      {!hasHistory && !hasContinueWatching ? (
        <div className="max-w-md mx-auto py-16 text-center">
          <Card className="p-8 space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-cyan-400 flex items-center justify-center mx-auto">
              <History className="w-8 h-8 opacity-75" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Your watch history is empty</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Videos you watch will appear here so you can easily continue watching later.
              </p>
            </div>
            <Link to="/">
              <Button variant="primary" size="sm" icon={<Play className="w-3.5 h-3.5" />} className="w-full">
                Explore Videos
              </Button>
            </Link>
          </Card>
        </div>
      ) : (
        <>
          {/* 4. Section: Continue Watching Shelf */}
          {hasContinueWatching && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <span>Continue Watching</span>
                </h2>
                <span className="text-xs text-slate-400">{continueItems.length} in progress</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {continueItems.map((item) => {
                  const thumb = item.thumbnailUrl ? getMediaUrl(item.thumbnailUrl) : null;
                  const progressPct = item.progressPercentage || 0;

                  return (
                    <Card
                      key={`continue-${item.videoId}`}
                      hoverEffect
                      className="group overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0f1523] flex flex-col"
                    >
                      {/* Video Thumbnail with Progress Bar */}
                      <Link to={`/watch/${item.videoId}`} className="relative aspect-video w-full bg-slate-900 block overflow-hidden">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600">
                            <Film className="w-10 h-10 opacity-50" />
                          </div>
                        )}

                        {/* Resume Play Floating Pill */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-11 h-11 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </div>
                        </div>

                        {/* Duration Badge */}
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-[2px] text-[10px] font-semibold text-white">
                          {formatDuration(item.durationSeconds)}
                        </div>

                        {/* Progress Bar Track */}
                        <div
                          className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800/80"
                          role="progressbar"
                          aria-valuenow={progressPct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Watched ${progressPct} percent`}
                        >
                          <div
                            className="h-full bg-indigo-600 dark:bg-cyan-400 transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </Link>

                      {/* Card Body */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <Link to={`/watch/${item.videoId}`} className="block">
                            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-cyan-400 transition-colors">
                              {item.title}
                            </h3>
                          </Link>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {item.channel?.channelName || 'StreamWave Creator'}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>
                            {formatDuration(item.progressSeconds)} / {formatDuration(item.durationSeconds)}
                          </span>
                          <span className="font-semibold text-indigo-600 dark:text-cyan-400">{progressPct}%</span>
                        </div>

                        <Link to={`/watch/${item.videoId}`} className="block w-full">
                          <Button variant="secondary" size="sm" icon={<Play className="w-3 h-3" />} className="w-full text-xs py-1.5">
                            Continue
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* 5. Section: Full Watch History List */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <History className="w-4 h-4 text-indigo-500" />
                <span>All Watch History</span>
              </h2>
            </div>

            <div className="space-y-3">
              {historyItems.map((item) => {
                const thumb = item.thumbnailUrl ? getMediaUrl(item.thumbnailUrl) : null;
                const channelAvatar = item.channel?.avatarUrl ? getMediaUrl(item.channel.avatarUrl) : null;
                const progressPct = item.progressPercentage || 0;
                const isRemoving = removingId === item.videoId;

                return (
                  <Card
                    key={`history-${item.historyId}-${item.videoId}`}
                    hoverEffect
                    className={`p-3 sm:p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-white dark:bg-[#0f1523] transition-all ${
                      isRemoving ? 'opacity-40 pointer-events-none' : ''
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row gap-4 group">
                      {/* Left: Video Thumbnail */}
                      <Link
                        to={`/watch/${item.videoId}`}
                        className="relative w-full sm:w-56 aspect-video bg-slate-900 rounded-xl overflow-hidden flex-shrink-0 block"
                      >
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600">
                            <Film className="w-8 h-8 opacity-50" />
                          </div>
                        )}

                        {/* Duration Badge */}
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-[2px] text-[10px] font-semibold text-white">
                          {formatDuration(item.durationSeconds)}
                        </div>

                        {/* Bottom Progress Bar */}
                        <div
                          className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800/90"
                          role="progressbar"
                          aria-valuenow={progressPct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Watched ${progressPct} percent`}
                        >
                          <div
                            className={`h-full ${
                              item.completed ? 'bg-emerald-500' : 'bg-indigo-600 dark:bg-cyan-400'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </Link>

                      {/* Center: Video Details */}
                      <div className="flex-1 flex flex-col justify-between space-y-2">
                        <div className="space-y-1">
                          <Link to={`/watch/${item.videoId}`}>
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-cyan-400 transition-colors line-clamp-2">
                              {item.title}
                            </h3>
                          </Link>

                          {/* Channel Meta */}
                          <div className="flex items-center space-x-2 pt-0.5">
                            {channelAvatar ? (
                              <img
                                src={channelAvatar}
                                alt={item.channel?.channelName}
                                className="w-5 h-5 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-bold flex items-center justify-center text-slate-600 dark:text-slate-300">
                                {(item.channel?.channelName || 'C')[0]}
                              </div>
                            )}
                            <Link
                              to={`/channel/${item.channel?.handle || item.channel?.id}`}
                              className="text-xs text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-cyan-400 transition-colors truncate"
                            >
                              {item.channel?.channelName || 'StreamWave Creator'}
                            </Link>
                          </div>
                        </div>

                        {/* Progress Status and Timestamps */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-1">
                          {item.completed ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-cyan-300">
                              Watched {progressPct}% ({formatDuration(item.progressSeconds)} /{' '}
                              {formatDuration(item.durationSeconds)})
                            </span>
                          )}

                          <span>•</span>
                          <span>Watched {timeAgo(item.lastWatchedAt)}</span>

                          {item.viewCount > 0 && (
                            <>
                              <span>•</span>
                              <span>{formatNumber(item.viewCount)} views</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right: Remove Item Action */}
                      <div className="flex sm:flex-col items-center justify-end sm:justify-start">
                        <button
                          type="button"
                          aria-label="Remove from watch history"
                          onClick={(e) => handleRemoveItem(e, item.videoId)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
                          title="Remove from history"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2 pt-6">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  icon={<ChevronLeft className="w-4 h-4" />}
                >
                  Previous
                </Button>

                <div className="px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Page {page} of {pagination.totalPages}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  icon={<ChevronRight className="w-4 h-4" />}
                >
                  Next
                </Button>
              </div>
            )}
          </section>
        </>
      )}

      {/* 6. Clear All History Confirmation Modal */}
      {isClearModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-history-title"
        >
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 id="clear-history-title" className="text-base font-bold text-slate-900 dark:text-white">
                Clear watch history?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                This will remove all videos from your watch history. You cannot undo this action.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsClearModalOpen(false)}
                disabled={clearing}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleClearAll}
                loading={clearing}
              >
                Clear History
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WatchHistory;
