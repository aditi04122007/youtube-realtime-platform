import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '../../context/CallContext';
import { Video, PhoneOff, AlertCircle } from 'lucide-react';
import { getMediaUrl } from '../../services/api';

const IncomingCallModal = () => {
  const { incomingCall, acceptIncomingCall, rejectIncomingCall, callNotice } = useCall();
  const navigate = useNavigate();

  const handleAccept = async () => {
    const callId = await acceptIncomingCall();
    if (callId) {
      navigate(`/call/${callId}`);
    }
  };

  const handleDecline = async () => {
    await rejectIncomingCall();
  };

  const caller = incomingCall?.caller;
  const avatarSrc = caller?.avatarUrl ? getMediaUrl(caller.avatarUrl) : null;
  const initial = (caller?.name || caller?.username || 'C').charAt(0).toUpperCase();

  return (
    <>
      {/* Floating Call Feedback Banner (e.g. busy / declined notices) */}
      {callNotice && (
        <div className="fixed top-20 right-4 z-50 max-w-sm w-full animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`p-4 rounded-2xl shadow-xl backdrop-blur border flex items-center space-x-3 text-sm font-medium ${
              callNotice.type === 'warning'
                ? 'bg-amber-500/90 text-white border-amber-400/40'
                : callNotice.type === 'error'
                ? 'bg-rose-600/90 text-white border-rose-500/40'
                : 'bg-indigo-600/90 text-white border-indigo-500/40'
            }`}
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1">{callNotice.message}</div>
          </div>
        </div>
      )}

      {/* Incoming Call Dialog */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl space-y-6 relative overflow-hidden">
            {/* Animated ringing waves */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 animate-pulse" />

            <div className="relative mx-auto w-24 h-24">
              <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
              <span className="absolute -inset-2 rounded-full bg-cyan-500/20 animate-pulse" />
              <div className="relative w-24 h-24 rounded-full overflow-hidden shadow-lg ring-4 ring-white dark:ring-slate-800 bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white text-3xl font-extrabold">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={caller?.name} className="w-full h-full object-cover" />
                ) : (
                  initial
                )}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {caller?.name || 'Unknown Caller'}
              </h3>
              {caller?.username && (
                <p className="text-xs text-slate-500 dark:text-slate-400">@{caller.username}</p>
              )}
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 pt-1 animate-pulse">
                Incoming Video Call...
              </p>
            </div>

            {/* Accept / Decline Buttons */}
            <div className="flex items-center justify-center space-x-6 pt-2">
              {/* Decline Button */}
              <button
                onClick={handleDecline}
                className="group flex flex-col items-center space-y-1.5 focus:outline-none"
                aria-label="Decline Call"
              >
                <div className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 active:scale-95">
                  <PhoneOff className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Decline</span>
              </button>

              {/* Accept Button */}
              <button
                onClick={handleAccept}
                className="group flex flex-col items-center space-y-1.5 focus:outline-none"
                aria-label="Accept Call"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 active:scale-95 animate-bounce">
                  <Video className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 font-semibold">Accept</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default IncomingCallModal;
