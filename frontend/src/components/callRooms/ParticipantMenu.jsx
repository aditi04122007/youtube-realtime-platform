import React, { useState, useRef, useEffect } from 'react';
import {
  MoreVertical,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  UserX,
  ShieldBan,
  Flag,
} from 'lucide-react';

const ParticipantMenu = ({
  participant,
  isCurrentHost,
  isLocal,
  onAction, // (actionType, participant)
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // If this is the local user, they cannot moderate or report themselves
  if (isLocal) {
    return null;
  }

  // The participant is remote
  const isTargetHost = participant?.isHost || participant?.role === 'HOST';

  const handleSelect = (actionType) => {
    setIsOpen(false);
    onAction(actionType, participant);
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white backdrop-blur-md transition-colors border border-white/10"
        title="Participant options"
        aria-label={`Options for ${participant?.name || 'participant'}`}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-8 z-50 w-52 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-1.5 backdrop-blur-xl animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] font-bold text-slate-400 truncate">
            {participant?.name || 'Participant'}
          </div>

          <div className="py-1 space-y-0.5">
            {/* Host Moderation Controls (Only available if current user is Host and target is NOT host) */}
            {isCurrentHost && !isTargetHost && (
              <>
                {/* Mute / Unmute */}
                {participant?.serverMuted ? (
                  <button
                    onClick={() => handleSelect('UNMUTE')}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 rounded-xl transition-colors text-left"
                  >
                    <Mic className="w-4 h-4 text-emerald-400" />
                    <span>Allow Microphone</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSelect('MUTE')}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-medium text-amber-400 hover:bg-slate-800 rounded-xl transition-colors text-left"
                  >
                    <MicOff className="w-4 h-4 text-amber-400" />
                    <span>Mute Microphone</span>
                  </button>
                )}

                {/* Turn Camera Off / Enable */}
                {participant?.serverCameraDisabled ? (
                  <button
                    onClick={() => handleSelect('CAMERA_ENABLE')}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 rounded-xl transition-colors text-left"
                  >
                    <VideoIcon className="w-4 h-4 text-emerald-400" />
                    <span>Allow Camera</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSelect('CAMERA_DISABLE')}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-medium text-amber-400 hover:bg-slate-800 rounded-xl transition-colors text-left"
                  >
                    <VideoOff className="w-4 h-4 text-amber-400" />
                    <span>Disable Camera</span>
                  </button>
                )}

                <div className="my-1 border-t border-slate-800" />

                {/* Remove Participant */}
                <button
                  onClick={() => handleSelect('REMOVE')}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors text-left"
                >
                  <UserX className="w-4 h-4 text-rose-400" />
                  <span>Remove from Call</span>
                </button>

                {/* Block Participant */}
                <button
                  onClick={() => handleSelect('BLOCK')}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-medium text-rose-500 hover:bg-rose-950/50 rounded-xl transition-colors text-left"
                >
                  <ShieldBan className="w-4 h-4 text-rose-500" />
                  <span>Block from Rejoining</span>
                </button>

                <div className="my-1 border-t border-slate-800" />
              </>
            )}

            {/* Report Participant (Available to all users for any other participant) */}
            <button
              onClick={() => handleSelect('REPORT')}
              className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-xl transition-colors text-left"
            >
              <Flag className="w-4 h-4 text-amber-400" />
              <span>Report Participant</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParticipantMenu;
