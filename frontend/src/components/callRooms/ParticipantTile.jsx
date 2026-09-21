import React, { useRef, useEffect } from 'react';
import { getMediaUrl } from '../../services/api';
import { MicOff, Crown, VideoOff, ShieldAlert, MonitorUp, Volume2 } from 'lucide-react';
import ParticipantMenu from './ParticipantMenu';

const ParticipantTile = ({
  userId,
  stream,
  name,
  avatarUrl,
  isLocal = false,
  isHost = false,
  isCurrentHost = false,
  audioEnabled = true,
  videoEnabled = true,
  serverMuted = false,
  serverCameraDisabled = false,
  connectionState,
  onModerationAction,
  isScreenSharing = false,
  hasScreenAudio = false,
  audioOutputDeviceId = '',
  isReconnecting = false,
}) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Apply audio output device routing via setSinkId if supported and provided
  useEffect(() => {
    if (videoRef.current && typeof videoRef.current.setSinkId === 'function' && audioOutputDeviceId) {
      videoRef.current.setSinkId(audioOutputDeviceId).catch((err) => {
        console.warn('[ParticipantTile] setSinkId error:', err);
      });
    }
  }, [audioOutputDeviceId]);

  const avatarSrc = avatarUrl ? getMediaUrl(avatarUrl) : null;
  const initial = (name || 'U').charAt(0).toUpperCase();

  const isVideoOff = !videoEnabled || serverCameraDisabled || !stream || stream.getVideoTracks().length === 0;

  return (
    <div className="relative w-full h-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-lg flex items-center justify-center group">
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Always mute local preview to prevent echo feedback
        className={`w-full h-full transition-opacity duration-300 ${
          isScreenSharing ? 'object-contain bg-black' : 'object-cover'
        } ${
          isLocal && !isScreenSharing ? '-scale-x-100' : ''
        } ${isVideoOff && !isScreenSharing ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* Camera Off / Avatar Placeholder */}
      {isVideoOff && (
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 p-4">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden shadow-xl ring-4 ring-slate-750 bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white text-3xl font-extrabold">
            {avatarSrc ? (
              <img src={avatarSrc} alt={name} className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-black/40 text-[11px] text-slate-300 border border-slate-700/50">
            <VideoOff className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {serverCameraDisabled ? 'Camera Disabled by Host' : 'Camera Off'}
            </span>
          </div>
        </div>
      )}

      {/* Reconnecting Overlay (Phase 28) */}
      {isReconnecting && (
        <div className="absolute inset-0 z-15 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-3 text-center space-y-2">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold shadow-md">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Reconnecting...</span>
          </div>
          <p className="text-[11px] text-slate-300">Temporary network interruption</p>
        </div>
      )}

      {/* Top Indicators: Host badge, Server Mute/Cam Badges, Screen Share badge, Connection state */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 z-10">
        {isScreenSharing && (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-600/90 text-white shadow-sm" title="Screen sharing active">
            <MonitorUp className="w-3 h-3" />
            <span>Screen</span>
          </span>
        )}
        {isHost && (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/90 text-slate-950 shadow-sm">
            <Crown className="w-3 h-3 fill-current" />
            <span>Host</span>
          </span>
        )}
        {serverMuted && (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600/90 text-white shadow-sm" title="Microphone muted by host">
            <MicOff className="w-3 h-3" />
            <span>Host Muted</span>
          </span>
        )}
        {serverCameraDisabled && (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600/90 text-white shadow-sm" title="Camera disabled by host">
            <VideoOff className="w-3 h-3" />
            <span>Cam Disabled</span>
          </span>
        )}
        {connectionState && connectionState !== 'connected' && !isLocal && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/60 text-slate-300 backdrop-blur-xs">
            {connectionState}
          </span>
        )}
      </div>

      {/* Top Right: Participant Menu Button (for remote participants) */}
      {!isLocal && onModerationAction && (
        <div className="absolute top-3 right-3 z-20">
          <ParticipantMenu
            participant={{
              userId,
              name,
              isHost,
              serverMuted,
              serverCameraDisabled,
            }}
            isCurrentHost={isCurrentHost}
            isLocal={isLocal}
            onAction={onModerationAction}
          />
        </div>
      )}

      {/* Bottom Overlay: Participant Name, Screen status & Mute status */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-2xl bg-black/60 backdrop-blur-md text-white text-xs font-semibold shadow-md max-w-[80%] truncate border border-white/10">
          <span className="truncate">{isScreenSharing ? `Screen: ${name || 'Participant'}` : (name || 'Participant')}</span>
          {isLocal && <span className="text-cyan-400 text-[11px] font-bold">(You)</span>}
          {isScreenSharing && (
            hasScreenAudio ? (
              <span className="flex items-center space-x-1 text-[10px] text-emerald-400 font-semibold pl-1 border-l border-white/20">
                <Volume2 className="w-3 h-3" />
                <span>Audio</span>
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-normal pl-1 border-l border-white/20">
                No sys audio
              </span>
            )
          )}
        </div>

        {/* Audio Mute Icon */}
        {(!audioEnabled || serverMuted) && (
          <div className="p-2 rounded-xl bg-rose-600/90 text-white shadow-md border border-rose-400/30" title={serverMuted ? "Muted by host" : "Muted"}>
            <MicOff className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipantTile;
