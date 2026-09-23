import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Lock,
  Clock,
  Home,
  RefreshCw,
  Film,
  RotateCcw,
  X,
  CheckCircle2,
} from 'lucide-react';
import {
  getVideoById,
  getVideoStreamUrl,
  getVideoWatchHistory,
  saveWatchProgress,
  getRelatedVideos,
} from '../services/videoService';
import { getMediaUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDuration } from '../utils/formatDuration';
import VideoPlayer from '../components/VideoPlayer';
import VideoMetadata from '../components/VideoMetadata';
import CommentsSection from '../components/CommentsSection';
import RelatedVideos from '../components/RelatedVideos';
import PremiumAccessGate from '../components/videos/PremiumAccessGate';
import Card from '../components/common/Card';
import Button from '../components/common/Button';

const Watch = () => {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const playerRef = useRef(null);

  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState(null); // 404 | 403 | 'processing' | 'generic'
  const [errorMessage, setErrorMessage] = useState('');

  // Theater Mode & Autoplay Next state
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [nextVideo, setNextVideo] = useState(null);

  // Phase 10: Watch History & Resume Playback State
  const [initialResumeTime, setInitialResumeTime] = useState(0);
  const [resumeNotice, setResumeNotice] = useState(null); // { type: 'resume' | 'completed', seconds: number }
  const [dismissedNotice, setDismissedNotice] = useState(false);

  // Playback tracking refs (avoid stale closures in throttled/unload callbacks)
  const currentProgressRef = useRef(0);
  const currentDurationRef = useRef(0);
  const lastSavedTimeRef = useRef(0);
  const lastSavedTimestampRef = useRef(Date.now());
  const isSavingRef = useRef(false);

  // Helper to persist watch progress to backend (UPSERT)
  const persistProgress = useCallback(
    async ({ progressSeconds, durationSeconds, completed = false, isBeacon = false }) => {
      if (!isAuthenticated || !user || !videoId) return;

      const p = Math.max(0, Math.floor(Number(progressSeconds) || 0));
      const d = Math.max(0, Math.floor(Number(durationSeconds) || 0));

      lastSavedTimeRef.current = p;
      lastSavedTimestampRef.current = Date.now();

      // Best effort background beacon / fetch on page leave
      if (isBeacon) {
        try {
          const rootBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
          fetch(`${rootBase}/api/watch-history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            keepalive: true,
            body: JSON.stringify({
              videoId: Number(videoId),
              progressSeconds: p,
              durationSeconds: d,
              completed,
            }),
          }).catch(() => {});
        } catch (e) {}
        return;
      }

      if (isSavingRef.current) return;
      isSavingRef.current = true;
      try {
        await saveWatchProgress({
          videoId: Number(videoId),
          progressSeconds: p,
          durationSeconds: d,
          completed,
        });
      } catch (err) {
        console.warn('[Watch] Failed to save watch progress:', err);
      } finally {
        isSavingRef.current = false;
      }
    },
    [isAuthenticated, user, videoId]
  );

  const fetchVideo = async () => {
    if (!videoId) return;

    setLoading(true);
    setErrorStatus(null);
    setErrorMessage('');

    try {
      const res = await getVideoById(videoId);
      const fetchedVideo = res.video || res.data;

      if (!fetchedVideo) {
        setErrorStatus(404);
        setErrorMessage('Video not found.');
      } else {
        // Ensure stream_url is resolved
        if (!fetchedVideo.stream_url) {
          fetchedVideo.stream_url = getVideoStreamUrl(fetchedVideo.id);
        }
        setVideo(fetchedVideo);
        if (fetchedVideo.duration_seconds) {
          currentDurationRef.current = fetchedVideo.duration_seconds;
        }
      }
    } catch (err) {
      console.error('[Watch] Failed to fetch video details:', err);
      const status = err.status || err.response?.status;
      const msg = err.message || err.response?.data?.message || '';

      if (status === 404) {
        setErrorStatus(404);
      } else if (status === 403) {
        if (msg.toLowerCase().includes('processing')) {
          setErrorStatus('processing');
        } else {
          setErrorStatus(403);
        }
      } else {
        setErrorStatus('generic');
        setErrorMessage(msg || 'Unable to load video. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch video data on videoId change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchVideo();
  }, [videoId]);

  // Fetch next recommended video for autoplay countdown
  useEffect(() => {
    if (!videoId) return;
    setNextVideo(null);
    getRelatedVideos(videoId, 5)
      .then((res) => {
        const list = res.videos || res.data || [];
        if (list.length > 0) {
          setNextVideo(list[0]);
        }
      })
      .catch((err) => {
        console.warn('[Watch] Failed to fetch next recommended video:', err);
      });
  }, [videoId]);

  // Fetch watch history & resume position for authenticated users
  useEffect(() => {
    setInitialResumeTime(0);
    setResumeNotice(null);
    setDismissedNotice(false);
    currentProgressRef.current = 0;
    currentDurationRef.current = 0;
    lastSavedTimeRef.current = 0;
    lastSavedTimestampRef.current = Date.now();

    if (isAuthenticated && user && videoId) {
      getVideoWatchHistory(videoId)
        .then((res) => {
          if (res && res.success) {
            const progress = Number(res.progressSeconds) || 0;
            const isCompleted = Boolean(res.completed);
            if (isCompleted) {
              setResumeNotice({ type: 'completed', seconds: progress });
              setInitialResumeTime(0); // Completed videos do not resume frozen at the end
            } else if (progress >= 5) {
              setResumeNotice({ type: 'resume', seconds: progress });
              setInitialResumeTime(progress);
            }
          }
        })
        .catch((err) => {
          console.warn('[Watch] Failed to fetch watch history for video:', err);
        });
    }
  }, [videoId, isAuthenticated, user]);

  // Player callbacks
  const handleProgress = ({ currentTime, duration }) => {
    currentProgressRef.current = currentTime;
    if (duration > 0) currentDurationRef.current = duration;

    // Throttled saving: every ~12 seconds or 10s difference of playback time
    const timeDiff = Math.abs(currentTime - lastSavedTimeRef.current);
    const realElapsed = Date.now() - lastSavedTimestampRef.current;
    if (timeDiff >= 10 || realElapsed >= 12000) {
      persistProgress({
        progressSeconds: currentTime,
        durationSeconds: duration || currentDurationRef.current,
        completed: false,
      });
    }
  };

  const handlePause = ({ currentTime, duration }) => {
    currentProgressRef.current = currentTime;
    if (duration > 0) currentDurationRef.current = duration;
    persistProgress({
      progressSeconds: currentTime,
      durationSeconds: duration || currentDurationRef.current,
      completed: false,
    });
  };

  const handleEnded = ({ duration }) => {
    const dur = duration || currentDurationRef.current || video?.duration_seconds || 0;
    currentProgressRef.current = dur;
    setResumeNotice({ type: 'completed', seconds: dur });
    persistProgress({
      progressSeconds: dur,
      durationSeconds: dur,
      completed: true,
    });
  };

  // Best-effort progress save on page visibility change or unload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && currentProgressRef.current > 0) {
        persistProgress({
          progressSeconds: currentProgressRef.current,
          durationSeconds: currentDurationRef.current,
          completed: false,
          isBeacon: true,
        });
      }
    };

    const handleBeforeUnload = () => {
      if (currentProgressRef.current > 0) {
        persistProgress({
          progressSeconds: currentProgressRef.current,
          durationSeconds: currentDurationRef.current,
          completed: false,
          isBeacon: true,
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Final save on unmount
      if (currentProgressRef.current > 0) {
        persistProgress({
          progressSeconds: currentProgressRef.current,
          durationSeconds: currentDurationRef.current,
          completed: false,
          isBeacon: true,
        });
      }
    };
  }, [persistProgress]);

  // 1. Loading Skeleton State
  if (loading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 max-w-7xl mx-auto pb-12">
        {/* Left: Player & Details Skeleton */}
        <div className="xl:col-span-2 space-y-5">
          {/* Player Box */}
          <div className="aspect-video w-full rounded-3xl bg-slate-200 dark:bg-slate-800/80 animate-pulse shadow-lg" />

          {/* Title Skeleton */}
          <div className="space-y-2">
            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-lg w-3/4 animate-pulse" />
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/3 animate-pulse" />
          </div>

          {/* Channel Row Skeleton */}
          <div className="flex items-center space-x-3 pt-2">
            <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4 animate-pulse" />
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/6 animate-pulse" />
            </div>
          </div>

          {/* Description Card Skeleton */}
          <div className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800/60 animate-pulse" />
        </div>

        {/* Right: Recommendations Skeleton */}
        <div className="space-y-3">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-4 animate-pulse" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex space-x-3 p-2 rounded-2xl bg-slate-200/50 dark:bg-slate-800/40 animate-pulse"
            >
              <div className="w-36 aspect-video bg-slate-200 dark:bg-slate-800 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-4/5" />
                <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. 404 Video Not Found
  if (errorStatus === 404) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <Card className="p-8 space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Film className="w-8 h-8 opacity-70" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Video not found
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              This video may have been deleted or is no longer available on StreamWave.
            </p>
          </div>
          <Link to="/">
            <Button
              variant="primary"
              size="sm"
              icon={<Home className="w-3.5 h-3.5" />}
              className="w-full"
            >
              Back to Home
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  // 3. 403 Private Video
  if (errorStatus === 403) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <Card className="p-8 space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              This video is private
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              The creator has made this video private. If you believe you should have access, please sign in with an authorized account.
            </p>
          </div>
          <Link to="/">
            <Button
              variant="secondary"
              size="sm"
              icon={<Home className="w-3.5 h-3.5" />}
              className="w-full"
            >
              Back to Home
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  // 4. Processing Video
  if (errorStatus === 'processing') {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <Card className="p-8 space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-cyan-400 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Video is still processing
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              This video is currently being prepared for streaming. Please check back soon.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={fetchVideo}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            className="w-full"
          >
            Check Status
          </Button>
        </Card>
      </div>
    );
  }

  // 5. Generic Error
  if (errorStatus === 'generic' || !video) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <Card className="p-8 space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Unable to load video
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {errorMessage || 'A network error occurred while loading the video.'}
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={fetchVideo}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            className="w-full"
          >
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  // 6. Success: Watch Experience Layout
  const rawStream = video.stream_url || video.video_url;
  const streamUrl = canWatch
    ? (rawStream ? getMediaUrl(rawStream) : getVideoStreamUrl(video.id))
    : null;
  const posterUrl = video.thumbnail_url ? getMediaUrl(video.thumbnail_url) : null;

  const renderPlayer = () => {
    if (!canWatch) {
      return <PremiumAccessGate video={video} onRefresh={fetchVideo} />;
    }
    return (
      <VideoPlayer
        ref={playerRef}
        src={streamUrl}
        poster={posterUrl}
        title={video.title}
        autoPlay={false}
        initialTime={initialResumeTime}
        onProgress={handleProgress}
        onPause={handlePause}
        onEnded={handleEnded}
        isTheaterMode={isTheaterMode}
        onToggleTheaterMode={() => setIsTheaterMode((prev) => !prev)}
        nextVideo={nextVideo}
        onAutoplayNext={() => {
          if (nextVideo) {
            navigate(`/watch/${nextVideo.id}`);
          }
        }}
      />
    );
  };

  return (
    <div className="w-full pb-16">
      {/* Theater Mode: Top Full-Width Player Container */}
      {isTheaterMode && (
        <div className="w-full bg-slate-950/90 py-2 sm:py-4 px-2 sm:px-6 mb-6 shadow-2xl border-b border-slate-800">
          <div className="max-w-6xl mx-auto">
            {renderPlayer()}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column: Player (if not theater mode), Resume notice, Metadata, Description */}
          <div className="xl:col-span-2 space-y-4">
            {!isTheaterMode && renderPlayer()}

            {/* Non-intrusive Resume Playback Notice Banner */}
            {resumeNotice && !dismissedNotice && (
              <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center justify-between px-3.5 py-2.5 rounded-2xl bg-indigo-50/90 dark:bg-slate-800/90 border border-indigo-200/80 dark:border-slate-700/80 text-xs sm:text-sm shadow-sm backdrop-blur transition-all">
                <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200">
                  {resumeNotice.type === 'completed' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span>You completed this video previously.</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      <span>
                        Resuming from{' '}
                        <span className="font-semibold text-indigo-600 dark:text-cyan-400">
                          {formatDuration(resumeNotice.seconds)}
                        </span>
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      playerRef.current?.seekTo(0);
                      setResumeNotice(null);
                      setDismissedNotice(true);
                      persistProgress({
                        progressSeconds: 0,
                        durationSeconds: currentDurationRef.current || video?.duration_seconds || 0,
                        completed: false,
                      });
                    }}
                    className="text-xs font-semibold text-indigo-600 dark:text-cyan-400 hover:underline flex items-center space-x-1 focus:outline-none"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-0.5" />
                    <span>Start from beginning</span>
                  </button>

                  <button
                    type="button"
                    aria-label="Dismiss resume notification"
                    onClick={() => setDismissedNotice(true)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 focus:outline-none"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Video Metadata & Creator Info */}
            <VideoMetadata video={video} />

            {/* Video Comments & Replies Section (Phase 12) */}
            <CommentsSection
              videoId={video.id}
              initialCommentCount={video.comment_count ?? video.commentCount ?? 0}
            />
          </div>

          {/* Right Column: Recommendations Rail */}
          <div className="xl:col-span-1">
            <RelatedVideos currentVideoId={video.id} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Watch;
