import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  Settings as SettingsIcon,
  PictureInPicture2,
  AlertCircle,
  RefreshCw,
  Loader2,
  Tv,
  Subtitles,
  SkipForward,
  X,
} from 'lucide-react';
import { formatDuration } from '../utils/formatDuration';
import VideoPlayerSettings from './VideoPlayerSettings';

const VideoPlayer = forwardRef(
  (
    {
      src,
      poster,
      title = 'Video player',
      autoPlay = false,
      initialTime = 0,
      onProgress,
      onPause,
      onPlay,
      onEnded,
      onLoadedMetadata,
      isTheaterMode = false,
      onToggleTheaterMode,
      nextVideo = null,
      onAutoplayNext,
      className = '',
    },
    ref
  ) => {
  // DOM References
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const progressBarRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);

  // Audio state
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(1);

  // View state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Captions state
  const [showCaptions, setShowCaptions] = useState(false);

  // Autoplay next state
  const [showAutoplayOverlay, setShowAutoplayOverlay] = useState(false);
  const [autoplayCountdown, setAutoplayCountdown] = useState(5);
  const autoplayTimerRef = useRef(null);

  // Loading & Error states
  const [isBuffering, setIsBuffering] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Seek preview tooltip state
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);

  // Feature detection
  const isPiPSupported =
    typeof document !== 'undefined' &&
    document.pictureInPictureEnabled &&
    typeof HTMLVideoElement !== 'undefined' &&
    HTMLVideoElement.prototype.requestPictureInPicture;

  // Ref tracking whether initial resume position has been applied
  const initialSeekAppliedRef = useRef(false);

  // Expose imperative API to parent components (e.g. Watch page)
  useImperativeHandle(ref, () => ({
    seekTo: (timeInSeconds) => {
      const video = videoRef.current;
      if (!video) return;
      const target = Math.max(0, Math.min(video.duration || duration || 0, timeInSeconds));
      video.currentTime = target;
      setCurrentTime(target);
    },
    getCurrentTime: () => (videoRef.current ? videoRef.current.currentTime : currentTime),
    getDuration: () => (videoRef.current ? videoRef.current.duration : duration),
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
  }));

  // Reset seek applied state and error status when src changes
  useEffect(() => {
    initialSeekAppliedRef.current = false;
    setShowAutoplayOverlay(false);
    setAutoplayCountdown(5);
    setHasError(false);
    setErrorMessage('');
    setIsLoadingMetadata(true);
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [src]);

  // Autoplay Countdown Timer Effect
  useEffect(() => {
    if (showAutoplayOverlay && autoplayCountdown > 0) {
      autoplayTimerRef.current = setTimeout(() => {
        setAutoplayCountdown((prev) => prev - 1);
      }, 1000);
    } else if (showAutoplayOverlay && autoplayCountdown === 0) {
      setShowAutoplayOverlay(false);
      if (onAutoplayNext) {
        onAutoplayNext();
      }
    }
    return () => {
      if (autoplayTimerRef.current) clearTimeout(autoplayTimerRef.current);
    };
  }, [showAutoplayOverlay, autoplayCountdown, onAutoplayNext]);

  const cancelAutoplay = () => {
    if (autoplayTimerRef.current) clearTimeout(autoplayTimerRef.current);
    setShowAutoplayOverlay(false);
    setAutoplayCountdown(5);
  };

  const triggerAutoplayNow = () => {
    if (autoplayTimerRef.current) clearTimeout(autoplayTimerRef.current);
    setShowAutoplayOverlay(false);
    if (onAutoplayNext) {
      onAutoplayNext();
    }
  };

  // Apply initial resume position if metadata was already loaded or arrives later
  useEffect(() => {
    if (
      !initialSeekAppliedRef.current &&
      initialTime > 0 &&
      videoRef.current &&
      !isLoadingMetadata &&
      duration > 0
    ) {
      if (initialTime < duration) {
        videoRef.current.currentTime = initialTime;
        setCurrentTime(initialTime);
      }
      initialSeekAppliedRef.current = true;
    }
  }, [initialTime, isLoadingMetadata, duration]);

  // ----------------------------------------------------
  // Controls Visibility Timer (Auto-hide after 3s)
  // ----------------------------------------------------
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!showSettings) {
          setShowControls(false);
        }
      }, 3000);
    }
  }, [isPlaying, showSettings]);

  const handleMouseMove = () => {
    resetControlsTimer();
  };

  const handleMouseLeave = () => {
    if (isPlaying && !showSettings) {
      setShowControls(false);
    }
  };

  // ----------------------------------------------------
  // Play / Pause Toggle
  // ----------------------------------------------------
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      video
        .play()
        .then(() => {
          setIsPlaying(true);
          resetControlsTimer();
        })
        .catch((err) => {
          console.warn('[VideoPlayer] Play interrupted or blocked:', err);
        });
    } else {
      video.pause();
      setIsPlaying(false);
      setShowControls(true);
    }
  }, [resetControlsTimer]);

  // ----------------------------------------------------
  // Volume & Mute Handling
  // ----------------------------------------------------
  const handleVolumeChange = (newVolume) => {
    const safeVol = Math.max(0, Math.min(1, Number(newVolume) || 0));
    setVolume(safeVol);
    if (videoRef.current) {
      videoRef.current.volume = safeVol;
      videoRef.current.muted = safeVol === 0;
    }
    if (safeVol > 0) {
      setIsMuted(false);
      setPrevVolume(safeVol);
    } else {
      setIsMuted(true);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted || volume === 0) {
      const restored = prevVolume > 0 ? prevVolume : 1;
      setVolume(restored);
      setIsMuted(false);
      video.volume = restored;
      video.muted = false;
    } else {
      setPrevVolume(volume);
      setVolume(0);
      setIsMuted(true);
      video.volume = 0;
      video.muted = true;
    }
  };

  // ----------------------------------------------------
  // Seek Handling (Click & Drag)
  // ----------------------------------------------------
  const calculateSeekTime = (clientX) => {
    if (!progressBarRef.current || duration <= 0) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const position = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return position * duration;
  };

  const handleSeek = (clientX) => {
    const targetTime = calculateSeekTime(clientX);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleProgressBarMouseMove = (e) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);

    if (isDraggingSeek) {
      handleSeek(e.clientX);
    }
  };

  const handleProgressBarMouseDown = (e) => {
    setIsDraggingSeek(true);
    handleSeek(e.clientX);
  };

  useEffect(() => {
    const handleMouseUp = () => {
      if (isDraggingSeek) {
        setIsDraggingSeek(false);
      }
    };

    if (isDraggingSeek) {
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSeek]);

  // Touch handling for seek bar on mobile
  const handleTouchSeek = (e) => {
    if (e.touches && e.touches[0]) {
      handleSeek(e.touches[0].clientX);
    }
  };

  // ----------------------------------------------------
  // Fullscreen Handling
  // ----------------------------------------------------
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(() => {});
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  // ----------------------------------------------------
  // Picture-in-Picture Handling
  // ----------------------------------------------------
  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video || !isPiPSupported) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else {
        await video.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch (err) {
      console.warn('[VideoPlayer] Picture-in-Picture error:', err);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnterPiP = () => setIsPiP(true);
    const onLeavePiP = () => setIsPiP(false);

    video.addEventListener('enterpictureinpicture', onEnterPiP);
    video.addEventListener('leavepictureinpicture', onLeavePiP);

    return () => {
      video.removeEventListener('enterpictureinpicture', onEnterPiP);
      video.removeEventListener('leavepictureinpicture', onLeavePiP);
    };
  }, []);

  // ----------------------------------------------------
  // Playback Rate Change
  // ----------------------------------------------------
  const handlePlaybackRateChange = (rate) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  // ----------------------------------------------------
  // Video Element Event Handlers
  // ----------------------------------------------------
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    const dur = video.duration || 0;
    setDuration(dur);
    setIsLoadingMetadata(false);
    setHasError(false);

    // Apply resume position if valid and not yet applied (without auto-playing!)
    if (
      !initialSeekAppliedRef.current &&
      initialTime > 0 &&
      initialTime < dur
    ) {
      video.currentTime = initialTime;
      setCurrentTime(initialTime);
      initialSeekAppliedRef.current = true;
    }

    if (onLoadedMetadata) {
      onLoadedMetadata({ duration: dur });
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);

    // Calculate buffered range
    if (video.buffered && video.buffered.length > 0 && video.duration > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      setBufferedPercent(Math.min(100, (bufferedEnd / video.duration) * 100));
    }

    if (onProgress) {
      onProgress({
        currentTime: video.currentTime,
        duration: video.duration || duration,
      });
    }
  };

  const handleWaiting = () => {
    setIsBuffering(true);
  };

  const handlePlaying = () => {
    setIsBuffering(false);
    setIsPlaying(true);
    if (onPlay && videoRef.current) {
      onPlay({
        currentTime: videoRef.current.currentTime,
        duration: videoRef.current.duration || duration,
      });
    }
  };

  const handlePause = () => {
    setIsPlaying(false);
    setShowControls(true);
    if (onPause && videoRef.current) {
      onPause({
        currentTime: videoRef.current.currentTime,
        duration: videoRef.current.duration || duration,
      });
    }
  };

  const handleCanPlay = () => {
    setIsBuffering(false);
  };

  const handleError = () => {
    setIsBuffering(false);
    setIsLoadingMetadata(false);
    setHasError(true);
    setErrorMessage('Unable to play this video. Please try again later.');
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setShowControls(true);
    const finalDur = videoRef.current?.duration || duration;
    if (onEnded) {
      onEnded({
        currentTime: finalDur,
        duration: finalDur,
      });
    }
    if (onAutoplayNext || nextVideo) {
      setAutoplayCountdown(5);
      setShowAutoplayOverlay(true);
    }
  };

  const handleRetry = () => {
    setHasError(false);
    setIsLoadingMetadata(true);
    const video = videoRef.current;
    if (video) {
      video.load();
      video.play().catch(() => {});
    }
  };

  // ----------------------------------------------------
  // Keyboard Shortcuts (Space, K, Arrows, J, L, M, F, P, T, C)
  // ----------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Do not trigger shortcuts if user is typing in form controls
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        document.activeElement?.isContentEditable
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'j':
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
            resetControlsTimer();
          }
          break;
        case 'l':
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime = Math.min(
              duration,
              videoRef.current.currentTime + 10
            );
            resetControlsTimer();
          }
          break;
        case 'arrowleft':
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
            resetControlsTimer();
          }
          break;
        case 'arrowright':
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime = Math.min(
              duration,
              videoRef.current.currentTime + 5
            );
            resetControlsTimer();
          }
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          resetControlsTimer();
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          resetControlsTimer();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          resetControlsTimer();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 't':
          if (onToggleTheaterMode) {
            e.preventDefault();
            onToggleTheaterMode();
          }
          break;
        case 'c':
          e.preventDefault();
          setShowCaptions((prev) => !prev);
          break;
        case 'p':
          if (isPiPSupported) {
            e.preventDefault();
            togglePiP();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlay, duration, volume, isPiPSupported, resetControlsTimer, onToggleTheaterMode]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Calculate played percentage
  const playedPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseMove}
      className={`relative w-full aspect-video bg-black rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl select-none group border border-slate-800 ${className}`}
    >
      {/* Native Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
        controls={false}
        onClick={togglePlay}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onCanPlay={handleCanPlay}
        onError={handleError}
        onPause={handlePause}
        onEnded={handleVideoEnded}
        className="w-full h-full object-contain cursor-pointer"
        aria-label={title}
      />

      {/* 1. Buffering Spinner */}
      {isBuffering && !hasError && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/20 backdrop-blur-[2px] z-20">
          <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center text-white shadow-xl animate-spin">
            <Loader2 className="w-8 h-8 text-indigo-400" />
          </div>
        </div>
      )}

      {/* 2. Error State Overlay */}
      {hasError && (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center text-center p-6 z-30 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-950/80 text-rose-400 flex items-center justify-center shadow-lg">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h4 className="text-base font-bold text-white">Playback Error</h4>
            <p className="text-xs text-slate-400 leading-relaxed">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 3. Center Play / Pause Button Overlay (Shown when paused & not error & not autoplay) */}
      {!isPlaying && !hasError && !isLoadingMetadata && !showAutoplayOverlay && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] cursor-pointer z-10"
        >
          <button
            type="button"
            aria-label="Play video"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white flex items-center justify-center shadow-2xl transform transition-transform hover:scale-110 active:scale-95"
          >
            <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-1" />
          </button>
        </div>
      )}

      {/* Autoplay Next Countdown Overlay */}
      {showAutoplayOverlay && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center">
          <div className="space-y-4 max-w-sm w-full bg-slate-900/95 border border-slate-700/80 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-indigo-400">Up Next</span>
              <span>Playing in <strong className="text-white text-sm">{autoplayCountdown}s</strong></span>
            </div>

            {nextVideo && (
              <div className="text-left space-y-1 py-1">
                <p className="text-sm font-bold text-white line-clamp-1">{nextVideo.title}</p>
                <p className="text-xs text-slate-400">{nextVideo.channel?.channel_name || 'StreamWave'}</p>
              </div>
            )}

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-500 h-full transition-all duration-1000 ease-linear"
                style={{ width: `${((5 - autoplayCountdown) / 5) * 100}%` }}
              />
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={cancelAutoplay}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={triggerAutoplayNow}
                className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Play Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Captions Overlay Indicator */}
      {showCaptions && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3 py-1 rounded-lg bg-black/80 border border-white/15 text-white text-xs font-medium tracking-wide shadow-md backdrop-blur-sm">
          [Captions Enabled]
        </div>
      )}

      {/* 4. Settings Popup Menu */}
      <VideoPlayerSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        playbackRate={playbackRate}
        onPlaybackRateChange={handlePlaybackRateChange}
      />

      {/* 5. Custom Control Bar Overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 pt-10 pb-3 px-3 sm:px-5 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 ${
          showControls || !isPlaying || showSettings ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Seek Bar */}
        <div
          ref={progressBarRef}
          onMouseMove={handleProgressBarMouseMove}
          onMouseDown={handleProgressBarMouseDown}
          onMouseLeave={() => setHoverTime(null)}
          onTouchStart={handleTouchSeek}
          onTouchMove={handleTouchSeek}
          className="relative w-full h-2 group/progress cursor-pointer flex items-center mb-3.5"
          role="slider"
          aria-label="Video seek slider"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
        >
          {/* Track background */}
          <div className="absolute inset-0 bg-white/20 rounded-full h-1.5 group-hover/progress:h-2 transition-all" />

          {/* Buffered Progress */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-white/40 rounded-full h-1.5 group-hover/progress:h-2 transition-all pointer-events-none"
            style={{ width: `${bufferedPercent}%` }}
          />

          {/* Played Progress */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full h-1.5 group-hover/progress:h-2 transition-all pointer-events-none"
            style={{ width: `${playedPercent}%` }}
          />

          {/* Scrubber Handle */}
          <div
            className="absolute w-3.5 h-3.5 rounded-full bg-white shadow-lg pointer-events-none transform -translate-x-1/2 scale-0 group-hover/progress:scale-100 transition-transform"
            style={{ left: `${playedPercent}%` }}
          />

          {/* Hover Time Tooltip */}
          {hoverTime !== null && (
            <div
              className="absolute -top-7 px-2 py-0.5 rounded bg-black/90 border border-white/10 text-[10px] font-semibold text-white pointer-events-none transform -translate-x-1/2 shadow-lg"
              style={{ left: `${hoverPosition}%` }}
            >
              {formatDuration(hoverTime)}
            </div>
          )}
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between text-white text-xs">
          {/* Left Controls (Play, Volume, Time) */}
          <div className="flex items-center space-x-1 sm:space-x-2">
            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
              className="p-2 sm:p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-white/15 active:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current" />
              )}
            </button>

            {/* Volume & Mute */}
            <div className="flex items-center space-x-1 sm:space-x-1.5 group/vol">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
                className="p-2 sm:p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-white/15 active:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-rose-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              {/* Volume Slider: Hidden on mobile (< sm) where hardware buttons are preferred */}
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(e.target.value)}
                aria-label="Volume slider"
                className="hidden sm:inline-block w-14 sm:w-20 h-1 accent-indigo-500 cursor-pointer opacity-80 group-hover/vol:opacity-100 transition-opacity"
              />
            </div>

            {/* Current / Duration Time */}
            <div className="text-[10px] sm:text-[11px] font-medium tracking-wide text-slate-300 pl-0.5 sm:pl-1 whitespace-nowrap">
              <span>{formatDuration(currentTime)}</span>
              <span className="mx-0.5 sm:mx-1 text-slate-500">/</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          {/* Right Controls (Speed Badge, Settings, PiP, Fullscreen) */}
          <div className="flex items-center space-x-0.5 sm:space-x-1.5">
            {/* Speed Badge Button */}
            {playbackRate !== 1 && (
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-indigo-600/60 text-[10px] font-bold text-cyan-300">
                {playbackRate}x
              </span>
            )}

            {/* Settings Gear Button */}
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              aria-label="Playback settings"
              className={`p-2 sm:p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-white/15 active:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                showSettings ? 'text-indigo-400 bg-white/10' : ''
              }`}
            >
              <SettingsIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Captions / Subtitles Button */}
            <button
              type="button"
              onClick={() => setShowCaptions(!showCaptions)}
              aria-label={showCaptions ? 'Disable captions (c)' : 'Enable captions (c)'}
              title="Captions (c)"
              className={`p-2 sm:p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-white/15 active:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                showCaptions ? 'text-indigo-400 bg-white/10' : ''
              }`}
            >
              <Subtitles className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Theater Mode Button */}
            {onToggleTheaterMode && (
              <button
                type="button"
                onClick={onToggleTheaterMode}
                aria-label={isTheaterMode ? 'Default view (t)' : 'Theater mode (t)'}
                title="Theater mode (t)"
                className={`p-2 sm:p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-white/15 active:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                  isTheaterMode ? 'text-indigo-400 bg-white/10' : ''
                }`}
              >
                <Tv className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}

            {/* Picture-in-Picture Button */}
            {isPiPSupported && (
              <button
                type="button"
                onClick={togglePiP}
                aria-label="Picture in picture"
                className={`p-2 sm:p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-white/15 active:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                  isPiP ? 'text-cyan-400' : ''
                }`}
              >
                <PictureInPicture2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              className="p-2 sm:p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-white/15 active:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
