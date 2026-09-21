import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getSocket } from '../services/socket';
import { startCall as apiStartCall, acceptCall as apiAcceptCall, rejectCall as apiRejectCall, endCall as apiEndCall } from '../services/callService';

const CallContext = createContext(null);

export const CallProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCallId, setActiveCallId] = useState(null);
  const [callNotice, setCallNotice] = useState(null); // Feedback toast/message
  const ringtoneIntervalRef = useRef(null);
  const audioContextRef = useRef(null);

  /**
   * Synthesize a gentle incoming telephone ringtone using Web Audio API
   */
  const playRingtoneBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      // Dual-tone US telephone ring (440Hz + 480Hz)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.value = 440;
      osc2.frequency.value = 480;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
      gain.gain.setValueAtTime(0.08, now + 0.9);
      gain.gain.linearRampToValueAtTime(0, now + 1.0);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.0);
      osc2.stop(now + 1.0);
    } catch (e) {
      // Audio context may be restricted by browser until user gesture
    }
  };

  const startRingtone = useCallback(() => {
    stopRingtone();
    playRingtoneBeep();
    ringtoneIntervalRef.current = setInterval(() => {
      playRingtoneBeep();
    }, 3000);
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
  }, []);

  // Socket event listener for call events
  useEffect(() => {
    if (!isAuthenticated) {
      stopRingtone();
      setIncomingCall(null);
      setActiveCallId(null);
      return;
    }

    const socket = getSocket();
    if (!socket) return;

    // 1. Incoming Call received
    const handleIncoming = (data) => {
      console.log('[CallContext] Received incoming call:', data);
      setIncomingCall({
        callId: data.callId,
        caller: data.caller,
      });
      startRingtone();
    };

    // 2. Call Accepted by peer
    const handleAccepted = (data) => {
      console.log('[CallContext] Peer accepted call:', data);
      stopRingtone();
    };

    // 3. Call Rejected by receiver
    const handleRejected = (data) => {
      console.log('[CallContext] Call rejected:', data);
      stopRingtone();
      setIncomingCall(null);
      setCallNotice({
        type: 'info',
        message: 'Call was declined by receiver.',
      });
      setTimeout(() => setCallNotice(null), 5000);
    };

    // 4. Call Busy (receiver on another call)
    const handleBusy = (data) => {
      console.log('[CallContext] Receiver is busy:', data);
      stopRingtone();
      setCallNotice({
        type: 'warning',
        message: data.message || 'User is currently on another call.',
      });
      setTimeout(() => setCallNotice(null), 5000);
    };

    // 5. Call Ended by peer
    const handleEnded = (data) => {
      console.log('[CallContext] Call ended by peer:', data);
      stopRingtone();
      setIncomingCall(null);
    };

    // 6. Ringing Timeout (Missed Call)
    const handleTimeout = (data) => {
      console.log('[CallContext] Call timed out:', data);
      stopRingtone();
      setIncomingCall((prev) => {
        if (prev && prev.callId === data.callId) {
          setCallNotice({
            type: 'info',
            message: `Missed call from ${prev.caller?.name || 'caller'}.`,
          });
          setTimeout(() => setCallNotice(null), 5000);
        }
        return null;
      });
    };

    socket.on('call:incoming', handleIncoming);
    socket.on('call:accepted', handleAccepted);
    socket.on('call:rejected', handleRejected);
    socket.on('call:busy', handleBusy);
    socket.on('call:ended', handleEnded);
    socket.on('call:timeout', handleTimeout);

    return () => {
      socket.off('call:incoming', handleIncoming);
      socket.off('call:accepted', handleAccepted);
      socket.off('call:rejected', handleRejected);
      socket.off('call:busy', handleBusy);
      socket.off('call:ended', handleEnded);
      socket.off('call:timeout', handleTimeout);
      stopRingtone();
    };
  }, [isAuthenticated, startRingtone, stopRingtone]);

  // Initiate call action
  const initiateCall = async (receiverId) => {
    try {
      const res = await apiStartCall(receiverId);
      if (res.success && res.call?.id) {
        setActiveCallId(res.call.id);
        return { success: true, callId: res.call.id };
      }
      return { success: false, message: 'Failed to initiate call' };
    } catch (err) {
      const msg = err.data?.message || err.message || 'Failed to start call';
      setCallNotice({
        type: err.data?.isBusy ? 'warning' : 'error',
        message: msg,
      });
      setTimeout(() => setCallNotice(null), 5000);
      return { success: false, message: msg, isBusy: err.data?.isBusy };
    }
  };

  // Accept incoming call
  const acceptIncomingCall = async () => {
    if (!incomingCall) return null;
    const callId = incomingCall.callId;
    stopRingtone();
    setIncomingCall(null);

    try {
      await apiAcceptCall(callId);
      setActiveCallId(callId);
      return callId;
    } catch (err) {
      console.error('[CallContext] Accept error:', err);
      setCallNotice({
        type: 'error',
        message: err.data?.message || 'Could not connect call.',
      });
      setTimeout(() => setCallNotice(null), 5000);
      return null;
    }
  };

  // Reject incoming call
  const rejectIncomingCall = async () => {
    if (!incomingCall) return;
    const callId = incomingCall.callId;
    stopRingtone();
    setIncomingCall(null);

    try {
      await apiRejectCall(callId);
    } catch (err) {
      console.error('[CallContext] Reject error:', err);
    }
  };

  return (
    <CallContext.Provider
      value={{
        incomingCall,
        activeCallId,
        setActiveCallId,
        callNotice,
        setCallNotice,
        initiateCall,
        acceptIncomingCall,
        rejectIncomingCall,
        stopRingtone,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
