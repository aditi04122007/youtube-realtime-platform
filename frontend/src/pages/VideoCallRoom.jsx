import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';
import { fetchCallDetails, endCall, fetchIceServers } from '../services/callService';
import Button from '../components/common/Button';
import { getMediaUrl } from '../services/api';
import DeviceSettingsModal from '../components/callRooms/DeviceSettingsModal';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  AlertCircle,
  Clock,
  User,
  ShieldAlert,
  MonitorUp,
  Settings,
} from 'lucide-react';

const VideoCallRoom = () => {
  const { callId: paramCallId, roomId } = useParams();
  const callId = paramCallId || roomId;
  const { user } = useAuth();
  const navigate = useNavigate();

  // Call metadata
  const [callData, setCallData] = useState(null);
  const [isCaller, setIsCaller] = useState(false);
  const [callStatus, setCallStatus] = useState('RINGING');
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [errorMessage, setErrorMessage] = useState(null);
  const [audioOnlyWarning, setAudioOnlyWarning] = useState(false);

  // Media states
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [durationSeconds, setDurationSeconds] = useState(0);

  // Phase 28: Network Resilience, Reconnection & Connection Quality
  const [peerReconnecting, setPeerReconnecting] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [connectionQuality, setConnectionQuality] = useState('GOOD');

  // Phase 27: Screen Sharing & Device Selection
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isDeviceSettingsOpen, setIsDeviceSettingsOpen] = useState(false);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [selectedAudioOutputDevice, setSelectedAudioOutputDevice] = useState('');

  // WebRTC and stream references
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const durationTimerRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const screenStreamRef = useRef(null);
  const previousCameraTrackRef = useRef(null);
  const cameraEnabledBeforeShareRef = useRef(true);

  // Phase 28 recovery refs
  const isCallerRef = useRef(false);
  const restartIceAttemptsRef = useRef(0);
  const iceRestartTimerRef = useRef(null);
  const statsIntervalRef = useRef(null);

  // Format call duration MM:SS
  const formatDuration = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Acquire local camera and microphone stream with graceful audio-only fallback
   */
  const acquireMediaStream = async () => {
    try {
      // First attempt: video + audio
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.warn('[WebRTC] Full media access failed, attempting audio-only:', err.name, err.message);

      // Fallback: audio only if camera is unavailable or denied
      if (err.name === 'NotFoundError' || err.name === 'NotReadableError' || err.name === 'OverconstrainedError') {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: false,
          });
          localStreamRef.current = audioStream;
          setCameraEnabled(false);
          setAudioOnlyWarning(true);
          return audioStream;
        } catch (audioErr) {
          throw audioErr;
        }
      }

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error(
          'Camera and microphone permissions were denied. Please allow camera and microphone access in your browser settings and refresh.'
        );
      }

      throw err;
    }
  };

  /**
   * Build RTCPeerConnection with STUN/TURN servers
   */
  const createPeerConnection = async (iceConfig) => {
    let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

    try {
      if (import.meta.env.VITE_WEBRTC_ICE_SERVERS) {
        const parsed = JSON.parse(import.meta.env.VITE_WEBRTC_ICE_SERVERS);
        if (Array.isArray(parsed) && parsed.length > 0) iceServers = parsed;
      } else if (iceConfig && Array.isArray(iceConfig.iceServers)) {
        iceServers = iceConfig.iceServers;
      }
    } catch (e) {
      console.warn('[WebRTC] Error parsing ICE servers from env:', e);
    }

    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
    });

    // Handle remote stream tracks
    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      }
    };

    // Handle local ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        if (socket) {
          socket.emit('call:ice-candidate', {
            callId,
            candidate: event.candidate,
          });
        }
      }
    };

    // ICE connection state changes with automated recovery
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log('[WebRTC 1:1] ICE connection state changed:', state);
      if (state === 'disconnected') {
        setConnectionStatus('Reconnecting...');
        if (!iceRestartTimerRef.current && isCallerRef.current) {
          iceRestartTimerRef.current = setTimeout(() => {
            iceRestartTimerRef.current = null;
            restartIce();
          }, 2500);
        }
      } else if (state === 'failed') {
        setConnectionStatus('Connection Interrupted');
        if (isCallerRef.current) {
          restartIce();
        }
      } else if (state === 'connected' || state === 'completed') {
        restartIceAttemptsRef.current = 0;
        if (iceRestartTimerRef.current) {
          clearTimeout(iceRestartTimerRef.current);
          iceRestartTimerRef.current = null;
        }
        setPeerReconnecting(false);
        setConnectionStatus('Connected');
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[WebRTC] Connection state changed:', state);
      if (state === 'connecting') {
        setConnectionStatus('Connecting...');
      } else if (state === 'connected') {
        setConnectionStatus('Connected');
        setCallStatus('ACCEPTED');
        setPeerReconnecting(false);
        // Start duration timer
        if (!durationTimerRef.current) {
          durationTimerRef.current = setInterval(() => {
            setDurationSeconds((s) => s + 1);
          }, 1000);
        }
      } else if (state === 'disconnected') {
        setConnectionStatus('Reconnecting...');
      } else if (state === 'failed') {
        setConnectionStatus('Connection Failed');
        if (isCallerRef.current && restartIceAttemptsRef.current < 3) {
          restartIce();
        } else {
          setErrorMessage('Direct peer connection failed. Please check network or firewall settings.');
        }
      } else if (state === 'closed') {
        setConnectionStatus('Call Ended');
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  /**
   * Phase 28: Trigger WebRTC ICE Restart on interrupted peer connection
   */
  const restartIce = async () => {
    const pc = peerConnectionRef.current;
    if (!pc || pc.signalingState === 'closed') return;
    if (restartIceAttemptsRef.current >= 3) {
      console.warn('[WebRTC 1:1] Max ICE restart attempts reached');
      setErrorMessage('Direct peer connection lost. Reconnection timed out.');
      return;
    }
    restartIceAttemptsRef.current += 1;
    console.log(`[WebRTC 1:1] Triggering ICE restart (attempt ${restartIceAttemptsRef.current}/3)`);
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      const socket = getSocket();
      if (socket) {
        socket.emit('call:offer', {
          callId,
          sdp: offer,
          iceRestart: true,
        });
      }
    } catch (err) {
      console.error('[WebRTC 1:1] ICE restart offer failed:', err);
    }
  };

  /**
   * Complete Call Flow & Socket Listeners
   */
  useEffect(() => {
    let isMounted = true;

    const setupCall = async () => {
      try {
        setConnectionStatus('Connecting to call room...');
        // 1. Fetch Call Details & ICE configuration
        const [detailsRes, iceRes] = await Promise.all([
          fetchCallDetails(callId),
          fetchIceServers().catch(() => ({ iceServers: [] })),
        ]);

        if (!isMounted) return;

        if (!detailsRes.success || !detailsRes.call) {
          throw new Error('Call session not found or access denied.');
        }

        const call = detailsRes.call;
        setCallData(call);
        setIsCaller(call.isCaller);
        isCallerRef.current = call.isCaller;
        setCallStatus(call.status);

        if (call.status === 'ENDED' || call.status === 'REJECTED' || call.status === 'MISSED') {
          setConnectionStatus(`Call is ${call.status.toLowerCase()}`);
          return;
        }

        // 2. Acquire media stream (microphone + optional camera)
        const localStream = await acquireMediaStream();
        if (!isMounted) return;

        // 3. Create WebRTC Peer Connection
        const pc = await createPeerConnection(iceRes);

        // 4. Attach local tracks to PeerConnection
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });

        // 5. Connect and join call room on Socket.IO
        const socket = getSocket();
        if (!socket) {
          throw new Error('Real-time notification socket is not connected.');
        }

        socket.emit('call:join', { callId }, (res) => {
          if (!res?.success) {
            console.warn('[WebRTC] Call join rejected by server:', res?.message);
          }
        });

        // 6. Listen for incoming WebRTC Offer
        const handleOffer = async (data) => {
          if (data.callId !== Number(callId)) return;
          console.log('[WebRTC] Received SDP Offer from peer');
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

            // Process any ICE candidates that arrived before offer
            while (pendingIceCandidatesRef.current.length > 0) {
              const cand = pendingIceCandidatesRef.current.shift();
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch((e) => {});
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.emit('call:answer', {
              callId,
              sdp: answer,
            });
          } catch (offerErr) {
            console.error('[WebRTC] Failed to handle offer:', offerErr);
          }
        };

        // 7. Listen for incoming WebRTC Answer
        const handleAnswer = async (data) => {
          if (data.callId !== Number(callId)) return;
          console.log('[WebRTC] Received SDP Answer from peer');
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

            // Process queued candidates
            while (pendingIceCandidatesRef.current.length > 0) {
              const cand = pendingIceCandidatesRef.current.shift();
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch((e) => {});
            }
          } catch (ansErr) {
            console.error('[WebRTC] Failed to handle answer:', ansErr);
          }
        };

        // 8. Listen for incoming ICE candidate
        const handleCandidate = async (data) => {
          if (data.callId !== Number(callId)) return;
          try {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } else {
              // Queue candidate if remote description not set yet
              pendingIceCandidatesRef.current.push(data.candidate);
            }
          } catch (iceErr) {
            console.warn('[WebRTC] Error adding ICE candidate:', iceErr);
          }
        };

        // 9. When peer accepts call or joins, caller initiates Offer
        const sendOffer = async () => {
          if (pc.signalingState === 'stable' && pc.localDescription === null) {
            console.log('[WebRTC] Creating and sending SDP offer to peer...');
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socket.emit('call:offer', {
                callId,
                sdp: offer,
              });
            } catch (offerCreateErr) {
              console.error('[WebRTC] Create offer failed:', offerCreateErr);
            }
          }
        };

        const handlePeerJoined = () => {
          console.log('[WebRTC] Peer joined room');
          if (call.isCaller) {
            sendOffer();
          }
        };

        const handleAccepted = () => {
          console.log('[WebRTC] Call accepted event received');
          setCallStatus('ACCEPTED');
          if (call.isCaller) {
            sendOffer();
          }
        };

        const handleRejected = () => {
          setCallStatus('REJECTED');
          setConnectionStatus('Call was declined');
          setTimeout(() => navigate('/call-history'), 2500);
        };

        const handleEnded = () => {
          setCallStatus('ENDED');
          setConnectionStatus('Call ended by peer');
          setTimeout(() => navigate('/call-history'), 2000);
        };

        const handleTimeout = () => {
          setCallStatus('MISSED');
          setConnectionStatus('Call timed out (no answer)');
          setTimeout(() => navigate('/call-history'), 2500);
        };

        const handlePeerReconnecting = (data) => {
          if (Number(data?.callId) === Number(callId)) {
            console.log('[WebRTC 1:1] Peer reconnecting event received');
            setPeerReconnecting(true);
          }
        };

        const handlePeerReconnected = (data) => {
          if (Number(data?.callId) === Number(callId)) {
            console.log('[WebRTC 1:1] Peer reconnected event received');
            setPeerReconnecting(false);
          }
        };

        socket.on('call:offer', handleOffer);
        socket.on('call:answer', handleAnswer);
        socket.on('call:ice-candidate', handleCandidate);
        socket.on('call:peer-joined', handlePeerJoined);
        socket.on('call:accepted', handleAccepted);
        socket.on('call:rejected', handleRejected);
        socket.on('call:ended', handleEnded);
        socket.on('call:timeout', handleTimeout);
        socket.on('call:peer-reconnecting', handlePeerReconnecting);
        socket.on('call:peer-reconnected', handlePeerReconnected);

        // If call is already ACCEPTED when caller opens page, create offer immediately
        if (call.status === 'ACCEPTED' && call.isCaller) {
          sendOffer();
        }

        return () => {
          socket.off('call:offer', handleOffer);
          socket.off('call:answer', handleAnswer);
          socket.off('call:ice-candidate', handleCandidate);
          socket.off('call:peer-joined', handlePeerJoined);
          socket.off('call:accepted', handleAccepted);
          socket.off('call:rejected', handleRejected);
          socket.off('call:ended', handleEnded);
          socket.off('call:timeout', handleTimeout);
          socket.off('call:peer-reconnecting', handlePeerReconnecting);
          socket.off('call:peer-reconnected', handlePeerReconnected);
        };
      } catch (err) {
        if (isMounted) {
          console.error('[WebRTC Setup Error]:', err);
          setErrorMessage(err.message || 'Failed to initialize call.');
          setConnectionStatus('Failed');
        }
      }
    };

    const cleanupPromise = setupCall();

    // Comprehensive unmount cleanup
    return () => {
      isMounted = false;
      cleanupPromise.then((cleanupSocket) => {
        if (typeof cleanupSocket === 'function') cleanupSocket();
      });

      // Stop duration timer
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }

      if (iceRestartTimerRef.current) {
        clearTimeout(iceRestartTimerRef.current);
        iceRestartTimerRef.current = null;
      }

      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }

      // Stop all local tracks (camera and microphone hardware releases)
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        localStreamRef.current = null;
      }

      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }

      // Close RTCPeerConnection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Clear video element references
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };
  }, [callId, navigate]);

  // Phase 28: Browser Online/Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const socket = getSocket();
      if (socket && !socket.connected) {
        socket.connect();
      }
      if (isCallerRef.current && peerConnectionRef.current && peerConnectionRef.current.connectionState !== 'connected') {
        restartIce();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [callId]);

  // Phase 28: WebRTC Connection Quality & Adaptive Bitrate Monitor
  useEffect(() => {
    if (callStatus !== 'ACCEPTED') return;

    let prevPacketsLost = 0;
    let prevPacketsReceived = 0;

    statsIntervalRef.current = setInterval(async () => {
      const pc = peerConnectionRef.current;
      if (!pc || pc.connectionState === 'closed') return;

      try {
        const stats = await pc.getStats();
        let currentLost = 0;
        let currentReceived = 0;
        let currentRtt = 0;

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            currentLost = report.packetsLost || 0;
            currentReceived = report.packetsReceived || 0;
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            currentRtt = (report.currentRoundTripTime || 0) * 1000;
          }
        });

        const deltaLost = Math.max(0, currentLost - prevPacketsLost);
        const deltaRecv = Math.max(0, currentReceived - prevPacketsReceived);
        const total = deltaLost + deltaRecv;
        const lossRate = total > 0 ? (deltaLost / total) * 100 : 0;

        prevPacketsLost = currentLost;
        prevPacketsReceived = currentReceived;

        let quality = 'GOOD';
        if (lossRate > 10 || currentRtt > 400) {
          quality = 'POOR';
        } else if (lossRate > 3 || currentRtt > 200) {
          quality = 'FAIR';
        }

        setConnectionQuality(quality);

        // Adaptive bitrate adjustment on video sender
        if (pc.getSenders) {
          const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (videoSender && typeof videoSender.getParameters === 'function') {
            const params = videoSender.getParameters();
            if (params && params.encodings && params.encodings.length > 0) {
              const enc = params.encodings[0];
              const maxBitrate = quality === 'POOR' ? 150000 : quality === 'FAIR' ? 400000 : 1200000;
              const maxFramerate = quality === 'POOR' ? 15 : quality === 'FAIR' ? 24 : 30;
              if (enc.maxBitrate !== maxBitrate || enc.maxFramerate !== maxFramerate) {
                enc.maxBitrate = maxBitrate;
                enc.maxFramerate = maxFramerate;
                enc.scaleResolutionDownBy = quality === 'POOR' ? 2.0 : 1.0;
                videoSender.setParameters(params).catch(() => {});
              }
            }
          }
        }
      } catch (e) {
        // ignore stats errors
      }
    }, 3000);

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
    };
  }, [callStatus]);

  // Apply audio output device routing via setSinkId if supported and provided
  useEffect(() => {
    if (remoteVideoRef.current && typeof remoteVideoRef.current.setSinkId === 'function' && selectedAudioOutputDevice) {
      remoteVideoRef.current.setSinkId(selectedAudioOutputDevice).catch((err) => {
        console.warn('[VideoCallRoom] setSinkId error:', err);
      });
    }
  }, [selectedAudioOutputDevice]);

  // Screen sharing stop handler
  const handleStopScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);

    const wasCameraEnabled = cameraEnabledBeforeShareRef.current;
    try {
      let restoredTrack = previousCameraTrackRef.current;
      if (wasCameraEnabled) {
        if (!restoredTrack || restoredTrack.readyState === 'ended') {
          const freshCamStream = await navigator.mediaDevices.getUserMedia({
            video: selectedVideoDevice
              ? { deviceId: { exact: selectedVideoDevice }, width: { ideal: 1280 }, height: { ideal: 720 } }
              : { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
          restoredTrack = freshCamStream.getVideoTracks()[0];
        }
      }

      if (peerConnectionRef.current && restoredTrack) {
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(restoredTrack);
        }
        restoredTrack.enabled = wasCameraEnabled;
      }

      if (localStreamRef.current && restoredTrack) {
        const oldTracks = localStreamRef.current.getVideoTracks();
        oldTracks.forEach((t) => localStreamRef.current.removeTrack(t));
        localStreamRef.current.addTrack(restoredTrack);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      }

      setCameraEnabled(wasCameraEnabled);
    } catch (err) {
      console.warn('[VideoCallRoom] Error restoring camera track:', err);
    } finally {
      previousCameraTrackRef.current = null;
    }
  }, [selectedVideoDevice]);

  // Screen sharing start handler
  const handleStartScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: true,
      });

      screenStreamRef.current = screenStream;
      const screenVideoTrack = screenStream.getVideoTracks()[0];
      if (!screenVideoTrack) {
        throw new Error('No video track found in screen share stream.');
      }

      cameraEnabledBeforeShareRef.current = cameraEnabled;
      if (localStreamRef.current) {
        const camTracks = localStreamRef.current.getVideoTracks();
        if (camTracks.length > 0) {
          previousCameraTrackRef.current = camTracks[0];
        }
      }

      if (peerConnectionRef.current) {
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(screenVideoTrack);
        }
      }

      if (localStreamRef.current) {
        const oldTracks = localStreamRef.current.getVideoTracks();
        oldTracks.forEach((t) => localStreamRef.current.removeTrack(t));
        localStreamRef.current.addTrack(screenVideoTrack);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      }

      setIsScreenSharing(true);

      screenVideoTrack.onended = () => {
        handleStopScreenShare();
      };
    } catch (err) {
      if (err.name !== 'NotAllowedError' && err.name !== 'PermissionDeniedError') {
        console.error('[VideoCallRoom] Screen share error:', err);
      }
    }
  };

  // Device switching handlers
  const handleSelectAudioDevice = async (deviceId) => {
    setSelectedAudioDevice(deviceId);
    try {
      const audioConstraints = deviceId
        ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true }
        : { echoCancellation: true, noiseSuppression: true };

      const newAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      });
      const newTrack = newAudioStream.getAudioTracks()[0];
      if (newTrack && peerConnectionRef.current) {
        newTrack.enabled = micEnabled;
        const senders = peerConnectionRef.current.getSenders();
        const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
        if (audioSender) {
          await audioSender.replaceTrack(newTrack);
        }
        if (localStreamRef.current) {
          const oldAudio = localStreamRef.current.getAudioTracks();
          oldAudio.forEach((t) => {
            localStreamRef.current.removeTrack(t);
            t.stop();
          });
          localStreamRef.current.addTrack(newTrack);
        }
      }
    } catch (err) {
      console.error('[VideoCallRoom] Audio device switch error:', err);
    }
  };

  const handleSelectVideoDevice = async (deviceId) => {
    setSelectedVideoDevice(deviceId);
    try {
      const videoConstraints = deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 } };

      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });
      const newTrack = newVideoStream.getVideoTracks()[0];
      if (newTrack) {
        newTrack.enabled = cameraEnabled;
        if (isScreenSharing) {
          if (previousCameraTrackRef.current && previousCameraTrackRef.current !== newTrack) {
            previousCameraTrackRef.current.stop();
          }
          previousCameraTrackRef.current = newTrack;
        } else {
          if (peerConnectionRef.current) {
            const senders = peerConnectionRef.current.getSenders();
            const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(newTrack);
            }
          }
          if (localStreamRef.current) {
            const oldVideo = localStreamRef.current.getVideoTracks();
            oldVideo.forEach((t) => {
              localStreamRef.current.removeTrack(t);
              t.stop();
            });
            localStreamRef.current.addTrack(newTrack);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = localStreamRef.current;
            }
          }
        }
      }
    } catch (err) {
      console.error('[VideoCallRoom] Video device switch error:', err);
    }
  };

  const handleSelectAudioOutputDevice = (deviceId) => {
    setSelectedAudioOutputDevice(deviceId);
  };

  // Device disconnect handling (devicechange listener)
  useEffect(() => {
    const handleDeviceChange = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasAudio = devices.some(
          (d) => d.kind === 'audioinput' && d.deviceId === selectedAudioDevice
        );
        const hasVideo = devices.some(
          (d) => d.kind === 'videoinput' && d.deviceId === selectedVideoDevice
        );
        const hasOutput = devices.some(
          (d) => d.kind === 'audiooutput' && d.deviceId === selectedAudioOutputDevice
        );

        if (selectedAudioDevice && !hasAudio) {
          handleSelectAudioDevice('');
        }
        if (selectedVideoDevice && !hasVideo) {
          handleSelectVideoDevice('');
        }
        if (selectedAudioOutputDevice && !hasOutput) {
          setSelectedAudioOutputDevice('');
        }
      } catch (err) {
        console.warn('[VideoCallRoom] devicechange check error:', err);
      }
    };

    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [selectedAudioDevice, selectedVideoDevice, selectedAudioOutputDevice]);

  // Toggle Microphone Mute
  const handleToggleMic = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextState = !audioTracks[0].enabled;
        audioTracks.forEach((t) => (t.enabled = nextState));
        setMicEnabled(nextState);
      }
    }
  };

  // Toggle Camera
  const handleToggleCamera = () => {
    if (isScreenSharing) return;
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextState = !videoTracks[0].enabled;
        videoTracks.forEach((t) => (t.enabled = nextState));
        setCameraEnabled(nextState);
      }
    }
  };

  // End Call Button
  const handleHangUp = async () => {
    try {
      await endCall(callId, 'ended');
    } catch (e) {
      console.warn('End call API call failed, continuing cleanup:', e);
    } finally {
      const socket = getSocket();
      if (socket) {
        socket.emit('call:end', { callId, reason: 'ended' });
      }
      navigate('/call-history');
    }
  };

  const otherUser = isCaller ? callData?.receiver : callData?.caller;
  const otherAvatar = otherUser?.avatarUrl ? getMediaUrl(otherUser.avatarUrl) : null;
  const otherName = otherUser?.name || 'Peer';

  return (
    <div className="max-w-6xl mx-auto space-y-4 px-2 sm:px-4 py-2">
      {/* Call Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white font-bold shadow-md flex-shrink-0">
            {otherAvatar ? (
              <img src={otherAvatar} alt={otherName} className="w-full h-full object-cover" />
            ) : (
              otherName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <span>{otherName}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  connectionStatus === 'Connected'
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    : connectionStatus.includes('Failed') || callStatus === 'REJECTED' || callStatus === 'ENDED'
                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                }`}
              >
                {connectionStatus}
              </span>
              {callStatus === 'ACCEPTED' && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center space-x-1 border border-slate-200 dark:border-slate-700">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      connectionQuality === 'GOOD'
                        ? 'bg-emerald-500'
                        : connectionQuality === 'FAIR'
                        ? 'bg-amber-500'
                        : 'bg-rose-500 animate-pulse'
                    }`}
                  />
                  <span className="capitalize">{connectionQuality.toLowerCase()}</span>
                </span>
              )}
            </h1>
            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDuration(durationSeconds)}</span>
              <span>•</span>
              <span>Session #{callId}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="danger" size="sm" onClick={handleHangUp} leftIcon={<PhoneOff className="w-4 h-4" />}>
            Leave Call
          </Button>
        </div>
      </div>

      {/* Phase 28: Network and Reconnection Banners */}
      {!isOnline && (
        <div className="p-3.5 rounded-2xl bg-rose-600 text-white text-xs font-medium flex items-center space-x-2 shadow-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0 animate-bounce" />
          <span>You are currently offline. Checking internet connection and reconnecting...</span>
        </div>
      )}

      {peerReconnecting && isOnline && (
        <div className="p-3.5 rounded-2xl bg-amber-500 text-white text-xs font-medium flex items-center space-x-2 shadow-lg animate-pulse">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span>{otherName} is experiencing network interruptions and reconnecting (waiting up to 25s)...</span>
        </div>
      )}

      {/* Permission / Error Banners */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-sm flex items-start space-x-3">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <div className="space-y-1">
            <p className="font-semibold">Call Notice</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {audioOnlyWarning && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
          <span>Camera is currently unavailable. Audio call is active.</span>
        </div>
      )}

      {/* Video Container Grid */}
      <div className="relative aspect-video w-full rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex items-center justify-center">
        {/* Remote Video Stream (Main) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Remote Video Placeholder (when no remote video received yet) */}
        {connectionStatus !== 'Connected' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white text-3xl font-extrabold shadow-xl ring-4 ring-slate-800">
              {otherAvatar ? (
                <img src={otherAvatar} alt={otherName} className="w-full h-full object-cover rounded-full" />
              ) : (
                otherName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">{otherName}</h3>
              <p className="text-xs text-slate-400">
                {callStatus === 'RINGING' ? (isCaller ? 'Ringing peer...' : 'Connecting...') : connectionStatus}
              </p>
            </div>
          </div>
        )}

        {/* Local Stream Picture-in-Picture Preview (Floating at top-right on mobile, bottom-right on sm+) */}
        <div className="absolute top-4 right-4 sm:top-auto sm:bottom-4 sm:right-4 w-28 sm:w-48 aspect-video rounded-2xl bg-slate-900 border-2 border-white/20 shadow-2xl overflow-hidden z-20">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full ${
              isScreenSharing ? 'object-contain bg-black' : 'object-cover scale-x-[-1]'
            } ${!cameraEnabled && !isScreenSharing ? 'hidden' : ''}`}
          />
          {!cameraEnabled && !isScreenSharing && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white text-xs p-2 text-center space-y-1">
              <User className="w-6 h-6 text-slate-400" />
              <span className="text-[10px] text-slate-400 font-medium">Camera Off</span>
            </div>
          )}
          <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur text-[9px] font-semibold text-white">
            {isScreenSharing ? 'Your Screen' : `You ${!micEnabled ? '(Muted)' : ''}`}
          </span>
        </div>

        {/* Floating Call Controls Bar */}
        <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2 sm:space-x-4 bg-slate-900/90 backdrop-blur-lg border border-slate-700/60 px-3.5 py-2 sm:px-6 sm:py-3 rounded-full shadow-2xl max-w-[calc(100vw-2rem)]">
          {/* Mic Toggle */}
          <button
            onClick={handleToggleMic}
            className={`p-2.5 sm:p-3.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full transition-all focus:outline-none ${
              micEnabled
                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white ring-4 ring-rose-500/30'
            }`}
            title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
            aria-label={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {micEnabled ? <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          {/* Camera Toggle */}
          <button
            onClick={handleToggleCamera}
            className={`p-2.5 sm:p-3.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full transition-all focus:outline-none ${
              cameraEnabled
                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white ring-4 ring-rose-500/30'
            }`}
            title={cameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
            aria-label={cameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {cameraEnabled ? <VideoIcon className="w-4 h-4 sm:w-5 sm:h-5" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          {/* Screen Share Button */}
          <button
            onClick={isScreenSharing ? handleStopScreenShare : handleStartScreenShare}
            className={`p-2.5 sm:p-3.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full transition-all focus:outline-none ${
              isScreenSharing
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-4 ring-indigo-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
            title={isScreenSharing ? 'Stop Sharing Screen' : 'Share Screen'}
            aria-label={isScreenSharing ? 'Stop Sharing Screen' : 'Share Screen'}
          >
            <MonitorUp className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Device Settings Button */}
          <button
            onClick={() => setIsDeviceSettingsOpen(true)}
            className="p-2.5 sm:p-3.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-white transition-all focus:outline-none"
            title="Audio & Video Device Settings"
            aria-label="Device Settings"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* End Call Button */}
          <button
            onClick={handleHangUp}
            className="p-2.5 sm:p-3.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full bg-rose-600 hover:bg-rose-700 text-white ring-4 ring-rose-600/30 transition-all focus:outline-none"
            title="End Video Call"
            aria-label="End Video Call"
          >
            <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Device Settings Modal */}
      <DeviceSettingsModal
        isOpen={isDeviceSettingsOpen}
        onClose={() => setIsDeviceSettingsOpen(false)}
        selectedAudioDevice={selectedAudioDevice}
        selectedVideoDevice={selectedVideoDevice}
        selectedAudioOutputDevice={selectedAudioOutputDevice}
        onSelectAudioDevice={handleSelectAudioDevice}
        onSelectVideoDevice={handleSelectVideoDevice}
        onSelectAudioOutputDevice={handleSelectAudioOutputDevice}
      />
    </div>
  );
};

export default VideoCallRoom;
