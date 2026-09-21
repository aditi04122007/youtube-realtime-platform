import React from 'react';
import { getMediaUrl } from '../../services/api';
import { Users, Crown, MicOff, VideoOff, X, ShieldAlert, BookOpen } from 'lucide-react';
import ParticipantMenu from './ParticipantMenu';

const ParticipantDrawer = ({
  isOpen,
  onClose,
  participants = [], // [{ userId, name, avatarUrl, role, audioEnabled, videoEnabled, serverMuted, serverCameraDisabled, isLocal }]
  isCurrentHost = false,
  onModerationAction,
  onOpenHistory,
  onOpenRules,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xs sm:max-w-sm bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-indigo-600 dark:text-cyan-400" />
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Participants ({participants.length})
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Participant List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-slate-100 dark:divide-slate-800/60">
        {participants.map((p) => {
          const avatarSrc = p.avatarUrl ? getMediaUrl(p.avatarUrl) : null;
          const initial = (p.name || 'U').charAt(0).toUpperCase();
          const isHost = p.role === 'HOST';

          return (
            <div key={p.userId} className="pt-2.5 flex items-center justify-between">
              <div className="flex items-center space-x-3 truncate">
                <div className="relative w-9 h-9 rounded-full overflow-hidden bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    initial
                  )}
                </div>
                <div className="truncate">
                  <div className="flex items-center space-x-1.5 truncate">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {p.name}
                    </span>
                    {p.isLocal && <span className="text-xs text-cyan-500 font-bold">(You)</span>}
                  </div>
                  <div className="flex items-center space-x-1 flex-wrap">
                    {isHost && (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-extrabold uppercase text-amber-500">
                        <Crown className="w-2.5 h-2.5 fill-current" />
                        <span>Host</span>
                      </span>
                    )}
                    {p.serverMuted && (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400">
                        Host Muted
                      </span>
                    )}
                    {p.serverCameraDisabled && (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400">
                        Cam Disabled
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Icons & Action Menu */}
              <div className="flex items-center space-x-1 flex-shrink-0 text-slate-400">
                {(p.audioEnabled === false || p.serverMuted) && (
                  <span className="p-1 text-rose-500" title={p.serverMuted ? 'Muted by host' : 'Muted'}>
                    <MicOff className="w-4 h-4" />
                  </span>
                )}
                {(p.videoEnabled === false || p.serverCameraDisabled) && (
                  <span className="p-1 text-slate-400" title={p.serverCameraDisabled ? 'Camera disabled by host' : 'Camera Off'}>
                    <VideoOff className="w-4 h-4" />
                  </span>
                )}

                {/* Participant Action Menu */}
                {!p.isLocal && onModerationAction && (
                  <ParticipantMenu
                    participant={p}
                    isCurrentHost={isCurrentHost}
                    isLocal={p.isLocal}
                    onAction={onModerationAction}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Controls: Rules and Moderation Logs */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50 dark:bg-slate-900/50">
        {isCurrentHost && (
          <button
            onClick={onOpenHistory}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-cyan-400 bg-indigo-50 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-750 rounded-xl transition-colors"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Room Moderation & Bans</span>
          </button>
        )}

        <button
          onClick={onOpenRules}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          <span>Room Rules & Safety</span>
        </button>
      </div>
    </div>
  );
};

export default ParticipantDrawer;
