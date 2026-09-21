import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Video as VideoIcon,
  Volume2,
  X,
  Check,
  RefreshCw,
  AlertCircle,
  Play,
  Monitor,
} from 'lucide-react';
import Button from '../common/Button';

const DeviceSettingsModal = ({
  isOpen,
  onClose,
  currentAudioDeviceId,
  currentVideoDeviceId,
  currentAudioOutputDeviceId,
  onSelectAudioDevice,
  onSelectVideoDevice,
  onSelectAudioOutputDevice,
  localStream,
  isScreenSharing = false,
}) => {
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [videoInputDevices, setVideoInputDevices] = useState([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);
  const [sinkIdSupported, setSinkIdSupported] = useState(false);
  const [isPlayingTestTone, setIsPlayingTestTone] = useState(false);
  const [previewStream, setPreviewStream] = useState(null);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const previewVideoRef = useRef(null);

  // 1. Detect setSinkId support on mount
  useEffect(() => {
    const isSupported =
      typeof HTMLMediaElement !== 'undefined' &&
      typeof HTMLMediaElement.prototype.setSinkId === 'function';
    setSinkIdSupported(isSupported);
  }, []);

  // 2. Enumerate available media devices
  const enumerateAllDevices = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return;
    }

    try {
      setLoadingDevices(true);
      const devices = await navigator.mediaDevices.enumerateDevices();

      const audioIns = devices.filter((d) => d.kind === 'audioinput');
      const videoIns = devices.filter((d) => d.kind === 'videoinput');
      const audioOuts = devices.filter((d) => d.kind === 'audiooutput');

      setAudioInputDevices(audioIns);
      setVideoInputDevices(videoIns);
      setAudioOutputDevices(audioOuts);
    } catch (err) {
      console.warn('[DeviceSettings] Error enumerating devices:', err.message);
    } finally {
      setLoadingDevices(false);
    }
  };

  // 3. Initial load & device change listener
  useEffect(() => {
    if (!isOpen) return;

    enumerateAllDevices();

    const handleDeviceChange = () => {
      console.log('[DeviceSettings] devicechange event detected, refreshing...');
      enumerateAllDevices();
    };

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }

    return () => {
      if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
    };
  }, [isOpen]);

  // 4. Handle live video preview in modal
  useEffect(() => {
    if (!isOpen) {
      if (previewStream && previewStream !== localStream) {
        previewStream.getTracks().forEach((t) => t.stop());
        setPreviewStream(null);
      }
      return;
    }

    // If localStream is active and not screen sharing, preview it directly
    if (localStream && !isScreenSharing) {
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = localStream;
      }
    } else if (currentVideoDeviceId && !isScreenSharing) {
      // Create lightweight camera preview if current local stream is screen share or unattached
      let isMounted = true;
      navigator.mediaDevices
        ?.getUserMedia({
          video: { deviceId: { exact: currentVideoDeviceId } },
          audio: false,
        })
        .then((stream) => {
          if (isMounted) {
            setPreviewStream(stream);
            if (previewVideoRef.current) {
              previewVideoRef.current.srcObject = stream;
            }
          } else {
            stream.getTracks().forEach((t) => t.stop());
          }
        })
        .catch(() => {});

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, localStream, currentVideoDeviceId, isScreenSharing]);

  // 5. ESC key handler to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 6. Test Speaker Audio Output
  const handlePlayTestTone = async () => {
    if (isPlayingTestTone) return;

    try {
      setIsPlayingTestTone(true);
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880.0, audioCtx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      // If output device selection is supported and a specific sink is selected
      if (audioCtx.setSinkId && currentAudioOutputDeviceId && currentAudioOutputDeviceId !== 'default') {
        await audioCtx.setSinkId(currentAudioOutputDeviceId).catch(() => {});
      }

      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);

      setTimeout(() => {
        setIsPlayingTestTone(false);
        try {
          audioCtx.close();
        } catch (e) {}
      }, 700);
    } catch (err) {
      console.warn('[DeviceSettings] Test tone error:', err.message);
      setIsPlayingTestTone(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="device-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <RefreshCw className={`w-4 h-4 ${loadingDevices ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h2 id="device-settings-title" className="text-base sm:text-lg font-bold text-white">
                Audio & Video Settings
              </h2>
              <p className="text-xs text-slate-400">Switch devices without leaving the call</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close Device Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Camera Preview Tile */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Camera Preview</span>
              {isScreenSharing && (
                <span className="text-[11px] text-cyan-400 font-normal flex items-center space-x-1">
                  <Monitor className="w-3 h-3" />
                  <span>Screen sharing is currently active</span>
                </span>
              )}
            </label>
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center shadow-inner">
              <video
                ref={previewVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${!isScreenSharing ? '-scale-x-100' : ''}`}
              />
              {(!localStream || isScreenSharing) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs text-slate-400 space-y-2">
                  <VideoIcon className="w-8 h-8 opacity-60 text-slate-500" />
                  <span className="text-xs font-medium">
                    {isScreenSharing
                      ? 'Preview shows camera to be restored after screen share'
                      : 'Camera preview is ready'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 1. Microphone Selector */}
          <div className="space-y-1.5">
            <label
              htmlFor="select-mic-device"
              className="text-xs font-semibold text-slate-300 flex items-center space-x-2"
            >
              <Mic className="w-4 h-4 text-indigo-400" />
              <span>Microphone</span>
            </label>
            <select
              id="select-mic-device"
              value={currentAudioDeviceId || 'default'}
              onChange={(e) => onSelectAudioDevice(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
            >
              {audioInputDevices.length === 0 ? (
                <option value="default">Default Microphone</option>
              ) : (
                audioInputDevices.map((d, index) => (
                  <option key={d.deviceId || index} value={d.deviceId}>
                    {d.label || `Microphone ${index + 1}`}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 2. Camera Selector */}
          <div className="space-y-1.5">
            <label
              htmlFor="select-camera-device"
              className="text-xs font-semibold text-slate-300 flex items-center space-x-2"
            >
              <VideoIcon className="w-4 h-4 text-cyan-400" />
              <span>Camera</span>
            </label>
            <select
              id="select-camera-device"
              value={currentVideoDeviceId || 'default'}
              onChange={(e) => onSelectVideoDevice(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors cursor-pointer"
            >
              {videoInputDevices.length === 0 ? (
                <option value="default">Default Camera</option>
              ) : (
                videoInputDevices.map((d, index) => (
                  <option key={d.deviceId || index} value={d.deviceId}>
                    {d.label || `Camera ${index + 1}`}
                  </option>
                ))
              )}
            </select>
            {isScreenSharing && (
              <p className="text-[11px] text-amber-400/90 italic pt-0.5">
                * Switching cameras while screen sharing saves your choice. The new camera will be
                activated when screen sharing ends.
              </p>
            )}
          </div>

          {/* 3. Speaker / Audio Output Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="select-speaker-device"
                className="text-xs font-semibold text-slate-300 flex items-center space-x-2"
              >
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>Speakers / Audio Output</span>
              </label>

              {/* Test Tone Button */}
              <button
                type="button"
                onClick={handlePlayTestTone}
                disabled={isPlayingTestTone}
                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all disabled:opacity-50"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{isPlayingTestTone ? 'Testing...' : 'Test Speaker'}</span>
              </button>
            </div>

            {sinkIdSupported ? (
              <select
                id="select-speaker-device"
                value={currentAudioOutputDeviceId || 'default'}
                onChange={(e) => onSelectAudioOutputDevice(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors cursor-pointer"
              >
                {audioOutputDevices.length === 0 ? (
                  <option value="default">Default Speaker</option>
                ) : (
                  audioOutputDevices.map((d, index) => (
                    <option key={d.deviceId || index} value={d.deviceId}>
                      {d.label || `Speaker ${index + 1}`}
                    </option>
                  ))
                )}
              </select>
            ) : (
              <div className="p-3 bg-slate-800/50 border border-slate-700/60 rounded-xl flex items-center space-x-2.5 text-xs text-slate-400">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>
                  Speaker selection is not supported by this browser. The system default speaker
                  is used.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 flex items-center justify-end space-x-3 bg-slate-900/60">
          <Button variant="primary" size="md" onClick={onClose} leftIcon={<Check className="w-4 h-4" />}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DeviceSettingsModal;
