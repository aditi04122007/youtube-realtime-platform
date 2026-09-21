import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Check,
  ChevronRight,
  ChevronLeft,
  Gauge,
  Sliders,
  Subtitles,
  X,
} from 'lucide-react';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const VideoPlayerSettings = ({
  isOpen = false,
  onClose,
  playbackRate = 1,
  onPlaybackRateChange,
  currentQuality = 'Auto',
  qualities = ['Auto'],
  onQualityChange,
  currentCaption = 'Off',
  captions = ['Off'],
  onCaptionChange,
}) => {
  const [currentMenu, setCurrentMenu] = useState('main'); // 'main' | 'speed' | 'quality' | 'captions'
  const menuRef = useRef(null);

  // Reset menu on close
  useEffect(() => {
    if (!isOpen) {
      setCurrentMenu('main');
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      role="dialog"
      aria-label="Video player settings"
      className="absolute bottom-14 right-3 sm:right-4 z-40 w-60 sm:w-64 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-white/10 text-white shadow-2xl p-2 text-xs select-none animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      {/* 1. Main Settings Menu */}
      {currentMenu === 'main' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 mb-1 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
            <span>Playback Settings</span>
            <button
              onClick={onClose}
              className="hover:text-white p-0.5 rounded transition-colors"
              aria-label="Close settings"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Speed Item */}
          <button
            type="button"
            onClick={() => setCurrentMenu('speed')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-left"
          >
            <div className="flex items-center space-x-2.5">
              <Gauge className="w-4 h-4 text-indigo-400" />
              <span className="font-medium">Playback Speed</span>
            </div>
            <div className="flex items-center space-x-1 text-slate-400">
              <span>{playbackRate === 1 ? 'Normal' : `${playbackRate}x`}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          {/* Quality Item */}
          <button
            type="button"
            onClick={() => setCurrentMenu('quality')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-left"
          >
            <div className="flex items-center space-x-2.5">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span className="font-medium">Quality</span>
            </div>
            <div className="flex items-center space-x-1 text-slate-400">
              <span>{currentQuality}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          {/* Captions Item */}
          <button
            type="button"
            onClick={() => setCurrentMenu('captions')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-left"
          >
            <div className="flex items-center space-x-2.5">
              <Subtitles className="w-4 h-4 text-indigo-400" />
              <span className="font-medium">Captions</span>
            </div>
            <div className="flex items-center space-x-1 text-slate-400">
              <span>{currentCaption}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* 2. Playback Speed Submenu */}
      {currentMenu === 'speed' && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setCurrentMenu('main')}
            className="w-full flex items-center space-x-2 px-2 py-1.5 text-slate-300 hover:text-white border-b border-white/10 mb-1 font-semibold"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Playback Speed</span>
          </button>

          <div className="max-h-52 overflow-y-auto space-y-0.5">
            {SPEEDS.map((rate) => {
              const isSelected = playbackRate === rate;
              return (
                <button
                  key={rate}
                  type="button"
                  onClick={() => {
                    onPlaybackRateChange(rate);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors text-left font-medium ${
                    isSelected
                      ? 'bg-indigo-600/30 text-cyan-400 font-bold'
                      : 'hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <span>{rate === 1 ? '1x (Normal)' : `${rate}x`}</span>
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Quality Submenu */}
      {currentMenu === 'quality' && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setCurrentMenu('main')}
            className="w-full flex items-center space-x-2 px-2 py-1.5 text-slate-300 hover:text-white border-b border-white/10 mb-1 font-semibold"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Quality</span>
          </button>

          <div className="space-y-0.5">
            {qualities.map((q) => {
              const isSelected = currentQuality === q;
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    if (onQualityChange) onQualityChange(q);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors text-left font-medium ${
                    isSelected
                      ? 'bg-indigo-600/30 text-cyan-400 font-bold'
                      : 'hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <span>{q}</span>
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>
          <div className="text-[10px] text-slate-400 px-3 py-1 italic border-t border-white/10 mt-1">
            Original source stream (transcoding coming in future phase)
          </div>
        </div>
      )}

      {/* 4. Captions Submenu */}
      {currentMenu === 'captions' && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setCurrentMenu('main')}
            className="w-full flex items-center space-x-2 px-2 py-1.5 text-slate-300 hover:text-white border-b border-white/10 mb-1 font-semibold"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Captions</span>
          </button>

          <div className="space-y-0.5">
            {captions.map((cap) => {
              const isSelected = currentCaption === cap;
              return (
                <button
                  key={cap}
                  type="button"
                  onClick={() => {
                    if (onCaptionChange) onCaptionChange(cap);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors text-left font-medium ${
                    isSelected
                      ? 'bg-indigo-600/30 text-cyan-400 font-bold'
                      : 'hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <span>{cap}</span>
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>
          <div className="text-[10px] text-slate-400 px-3 py-1 italic border-t border-white/10 mt-1">
            Multi-language tracks and live translation coming in future phase
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayerSettings;
