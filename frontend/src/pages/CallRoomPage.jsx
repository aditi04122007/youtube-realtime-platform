import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';
import {
  fetchRoomDetails,
  joinCallRoom,
  leaveCallRoom,
  endCallRoom,
  fetchRoomParticipants,
} from '../services/callRoomService';
import {
  muteParticipant,
  unmuteParticipant,
  disableCamera,
  enableCamera,
  removeParticipant,
  blockParticipant,
  reportParticipant,
} from '../services/callModerationService';
import { RoomWebRTCManager } from '../services/roomWebRTC';
import ParticipantGrid from '../components/callRooms/ParticipantGrid';
import ParticipantDrawer from '../components/callRooms/ParticipantDrawer';
import InviteModal from '../components/callRooms/InviteModal';
import ModerationActionModal from '../components/callRooms/ModerationActionModal';
import ReportModal from '../components/callRooms/ReportModal';
import ModerationHistoryModal from '../components/callRooms/ModerationHistoryModal';
import RoomRulesModal from '../components/callRooms/RoomRulesModal';
import InCallChatPanel from '../components/callRooms/InCallChatPanel';
import DeviceSettingsModal from '../components/callRooms/DeviceSettingsModal';
import Button from '../components/common/Button';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Users,
  UserPlus,
  Copy,
  Check,
  Crown,
  Clock,
  AlertCircle,
  Loader2,
  ShieldAlert,
  BookOpen,
  MessageSquare,
  MonitorUp,
  Settings,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

const CallRoomPage = () => {
  const { roomCode: paramCode } = useParams();
  const roomCode = (paramCode || '').trim().toUpperCase();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Room state
  const [roomData, setRoomData] = useState(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);

  // Media states
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [audioOnlyFallback, setAudioOnlyFallback] = useState(false);

  // Moderation state for local user
  const [localServerMuted, setLocalServerMuted] = useState(false);
  const [localServerCameraDisabled, setLocalServerCameraDisabled] = useState(false);
  const [moderationToast, setModerationToast] = useState(null);

  // Participants & Mesh Peers
  const [remotePeers, setRemotePeers] = useState([]); // [{ userId, name, avatarUrl, stream, isHost, audioEnabled, videoEnabled, serverMuted, serverCameraDisabled, connectionState }]
  const [participantList, setParticipantList] = useState([]);

  // Phase 27: Screen Sharing & Device Selection
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeScreenSharer, setActiveScreenSharer] = useState(null); // { userId, userName, hasAudio }
  const [isDeviceSettingsOpen, setIsDeviceSettingsOpen] = useState(false);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [selectedAudioOutputDevice, setSelectedAudioOutputDevice] = useState('');

  // UI Modals & Drawers
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  // Moderation Modals
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [activeActionType, setActiveActionType] = useState(null); // 'MUTE' | 'CAMERA_DISABLE' | 'REMOVE' | 'BLOCK'
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);

  // References
  const localVideoPreviewRef = useRef(null);
  const localStreamRef = useRef(null);
  const rtcManagerRef = useRef(null);
  const durationTimerRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const screenStreamRef = useRef(null);
  const previousCameraTrackRef = useRef(null);
  const cameraEnabledBeforeShareRef = useRef(true);
  const handleStopScreenShareRef = useRef(null);

  // Phase 28: Connection States, Network Recovery & Low Bandwidth
  const [callConnectionState, setCallConnectionState] = useState('CONNECTING'); // 'CONNECTED' | 'CONNECTING' | 'RECONNECTING' | 'DEGRADED' | 'DISCONNECTED' | 'FAILED' | 'ENDED'
  const [connectionQuality, setConnectionQuality] = useState('GOOD'); // 'GOOD' | 'FAIR' | 'POOR'
  const [reconnectCountdown, setReconnectCountdown] = useState(30);
  const [showRestoredToast, setShowRestoredToast] = useState(false);
  const [isLowBandwidthVideoReduced, setIsLowBandwidthVideoReduced] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState(false);

  const reconnectTimeoutRef = useRef(null);
  const reconnectCountdownIntervalRef = useRef(null);
  const isRecoveringRef = useRef(false);
  const restoredToastTimerRef = useRef(null);
  const qualityRef = useRef('GOOD');

  const showToast = (msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setModerationToast(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setModerationToast(null);
    }, 4500);
  };

  /**
   * Acquire local camera & microphone stream with graceful audio-only fallback
   */
  const acquireMediaStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = stream;
      if (localVideoPreviewRef.current) {
        localVideoPreviewRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.warn('[CallRoom] Full media access failed, attempting audio-only:', err.name, err.message);

      // Graceful fallback to audio-only if camera is unavailable or denied
      if (
        err.name === 'NotFoundError' ||
        err.name === 'NotReadableError' ||
        err.name === 'OverconstrainedError' ||
        err.name === 'NotAllowedError'
      ) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: false,
          });
          localStreamRef.current = audioStream;
          setCameraEnabled(false);
          setAudioOnlyFallback(true);
          return audioStream;
        } catch (audioErr) {
          throw audioErr;
        }
      }
      throw err;
    }
  };

  /**
   * Initial Load: Fetch room details
   */
  useEffect(() => {
    let isMounted = true;

    const loadRoom = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetchRoomDetails(roomCode);
        if (!isMounted) return;

        if (res?.success && res.room) {
          setRoomData(res.room);
          setIsHost(Boolean(res.room.isHost));

          // Start camera preview for lobby
          acquireMediaStream().catch((e) => {
            console.warn('[CallRoom] Lobby media preview warning:', e.message);
          });
        } else {
          setErrorMessage(res?.message || 'Room not found.');
        }
      } catch (err) {
        if (!isMounted) return;
        setErrorMessage(
          err.response?.data?.message || err.message || 'Failed to load room details.'
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadRoom();

    return () => {
      isMounted = false;
    };
  }, [roomCode]);

  /**
   * Join Room Action from Lobby
   */
  const handleJoinRoom = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Join room via REST API
      const joinRes = await joinCallRoom(roomCode);
      if (!joinRes?.success) {
        throw new Error(joinRes?.message || 'Could not join room.');
      }

      setRoomData(joinRes.room);
      if (joinRes.userRole === 'HOST') setIsHost(true);

      // 2. Connect Socket.IO
      const socket = getSocket();
      if (!socket) {
        throw new Error('Real-time socket connection is unavailable.');
      }

      // 3. Acquire local stream if not already active
      let localStream = localStreamRef.current;
      if (!localStream) {
        localStream = await acquireMediaStream();
      }

      // 4. Initialize Mesh WebRTC Manager
      const rtcManager = new RoomWebRTCManager({
        roomCode,
        currentUserId: user.id,
        socket,
        onRemoteStream: (peerId, stream) => {
          setRemotePeers((prev) => {
            const exists = prev.some((p) => Number(p.userId) === Number(peerId));
            if (exists) {
              return prev.map((p) =>
                Number(p.userId) === Number(peerId) ? { ...p, stream, connectionState: 'connected' } : p
              );
            }
            return [
              ...prev,
              {
                userId: peerId,
                name: `User ${peerId}`,
                avatarUrl: null,
                stream,
                isHost: false,
                audioEnabled: true,
                videoEnabled: true,
                serverMuted: false,
                serverCameraDisabled: false,
                connectionState: 'connected',
              },
            ];
          });
        },
        onPeerLeft: (peerId) => {
          setRemotePeers((prev) => prev.filter((p) => Number(p.userId) !== Number(peerId)));
          setParticipantList((prev) => prev.filter((p) => Number(p.userId) !== Number(peerId)));
        },
        onConnectionStateChange: (peerId, state) => {
          setRemotePeers((prev) =>
            prev.map((p) =>
              Number(p.userId) === Number(peerId) ? { ...p, connectionState: state } : p
            )
          );
        },
      });

      rtcManager.setLocalStream(localStream);
      rtcManagerRef.current = rtcManager;

      // Start periodic WebRTC stats monitoring & adaptive bandwidth profile (Phase 28)
      rtcManager.startStatsMonitoring(({ quality, stats }) => {
        setConnectionQuality(quality);
        qualityRef.current = quality;
        rtcManager.applyBandwidthProfile(quality, isScreenSharing);
        if (quality === 'POOR') {
          setIsLowBandwidthVideoReduced(true);
        } else {
          setIsLowBandwidthVideoReduced(false);
        }
      });
      setCallConnectionState('CONNECTED');

      // 5. Join socket room & register listeners
      socket.emit('room:join', { roomCode }, async (ack) => {
        if (!ack?.success) {
          console.warn('[CallRoom] Socket join acknowledgement warning:', ack?.message);
        } else if (ack.activeScreenSharer) {
          setActiveScreenSharer(ack.activeScreenSharer);
        }
      });

      // 6. Fetch existing room participants to initiate mesh connections
      const partsRes = await fetchRoomParticipants(roomCode).catch(() => ({ participants: [] }));
      const allParts = partsRes.participants || [];

      // Check local user moderation state if already set
      const selfRecord = allParts.find((p) => Number(p.userId) === Number(user.id));
      if (selfRecord) {
        if (selfRecord.serverMuted) {
          setLocalServerMuted(true);
          setMicEnabled(false);
          rtcManager.setAudioEnabled(false);
        }
        if (selfRecord.serverCameraDisabled) {
          setLocalServerCameraDisabled(true);
          setCameraEnabled(false);
          rtcManager.setVideoEnabled(false);
        }
      }

      const existing = allParts.filter((p) => Number(p.userId) !== Number(user.id));

      // Existing participants receive offers
      for (const p of existing) {
        await rtcManager.addPeer(p.userId);
      }

      setRemotePeers(
        existing.map((p) => ({
          userId: p.userId,
          name: p.name,
          avatarUrl: p.avatarUrl,
          stream: null,
          isHost: p.role === 'HOST',
          audioEnabled: !p.serverMuted,
          videoEnabled: !p.serverCameraDisabled,
          serverMuted: Boolean(p.serverMuted),
          serverCameraDisabled: Boolean(p.serverCameraDisabled),
          connectionState: 'connecting',
          isReconnecting: false,
        }))
      );

      // Start duration timer
      if (!durationTimerRef.current) {
        durationTimerRef.current = setInterval(() => {
          setDurationSeconds((s) => s + 1);
        }, 1000);
      }

      setHasJoined(true);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Error joining room.'
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Leave / Exit Cleanup
   */
  const handleCleanupAndExit = useCallback(async () => {
    if (reconnectCountdownIntervalRef.current) {
      clearInterval(reconnectCountdownIntervalRef.current);
      reconnectCountdownIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (restoredToastTimerRef.current) {
      clearTimeout(restoredToastTimerRef.current);
      restoredToastTimerRef.current = null;
    }

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    if (rtcManagerRef.current) {
      rtcManagerRef.current.closeAllConnections();
      rtcManagerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    setCallConnectionState('ENDED');

    const socket = getSocket();
    if (socket && hasJoined) {
      socket.emit('room:leave', { roomCode });
    }

    try {
      await leaveCallRoom(roomCode);
    } catch (e) {}

    navigate('/');
  }, [roomCode, hasJoined, navigate]);

  /**
   * Authoritative Room State Synchronization (Phase 28 Reconnection)
   */
  const syncRoomState = useCallback(async () => {
    const socket = getSocket();
    if (!socket || !roomCode) return false;

    return new Promise((resolve) => {
      socket.emit('room:sync', { roomCode }, async (ack) => {
        if (!ack?.success) {
          console.warn('[CallRoom] room:sync unsuccessful:', ack?.message);
          resolve(false);
          return;
        }

        console.log('[CallRoom] Authoritative room sync received:', ack);

        if (ack.roomStatus === 'ENDED') {
          alert('This call room has ended.');
          handleCleanupAndExit();
          resolve(false);
          return;
        }

        // Update role & host status
        if (ack.role === 'HOST' || ack.isHost) {
          setIsHost(true);
        }

        // Update screen share presenter
        if (ack.activeScreenSharer !== undefined) {
          setActiveScreenSharer(ack.activeScreenSharer);
        }

        const serverParticipants = ack.participants || [];

        // Check self moderation status
        const selfInfo = serverParticipants.find((p) => Number(p.userId) === Number(user?.id));
        if (selfInfo) {
          if (selfInfo.serverMuted) {
            setLocalServerMuted(true);
            setMicEnabled(false);
            if (rtcManagerRef.current) rtcManagerRef.current.setAudioEnabled(false);
          } else {
            setLocalServerMuted(false);
          }

          if (selfInfo.serverCameraDisabled) {
            setLocalServerCameraDisabled(true);
            setCameraEnabled(false);
            if (rtcManagerRef.current) rtcManagerRef.current.setVideoEnabled(false);
          } else {
            setLocalServerCameraDisabled(false);
          }
        }

        const remoteList = serverParticipants.filter((p) => Number(p.userId) !== Number(user?.id));
        setParticipantList(serverParticipants);

        // Reconcile remotePeers using userId as stable keys
        setRemotePeers((prevPeers) => {
          const prevMap = new Map(prevPeers.map((p) => [Number(p.userId), p]));
          return remoteList.map((sp) => {
            const existing = prevMap.get(Number(sp.userId));
            return {
              userId: sp.userId,
              name: sp.name,
              avatarUrl: sp.avatarUrl,
              stream: existing?.stream || null,
              isHost: sp.role === 'HOST',
              audioEnabled: !sp.serverMuted,
              videoEnabled: !sp.serverCameraDisabled,
              serverMuted: Boolean(sp.serverMuted),
              serverCameraDisabled: Boolean(sp.serverCameraDisabled),
              connectionState: existing?.connectionState || 'connecting',
              isReconnecting: false,
            };
          });
        });

        // Re-verify WebRTC connections to active peers
        if (rtcManagerRef.current) {
          for (const sp of remoteList) {
            if (!rtcManagerRef.current.peerConnections.has(sp.userId)) {
              await rtcManagerRef.current.addPeer(sp.userId);
            }
          }
        }

        resolve(true);
      });
    });
  }, [roomCode, user?.id, handleCleanupAndExit]);

  /**
   * Reconnection & Network Recovery Coordinator (Phase 28)
   */
  const attemptReconnection = useCallback(async (isManual = false) => {
    if (isRecoveringRef.current && !isManual) return;
    isRecoveringRef.current = true;

    console.log('[CallRoom] Initiating reconnection recovery sequence...');
    setCallConnectionState('RECONNECTING');

    try {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        if (socket) {
          socket.connect();
          await new Promise((resolve) => {
            if (socket.connected) {
              resolve(true);
              return;
            }
            const onConn = () => {
              socket.off('connect', onConn);
              resolve(true);
            };
            socket.once('connect', onConn);
            setTimeout(() => {
              socket.off('connect', onConn);
              resolve(socket.connected);
            }, 5000);
          });
        }
      }

      const synced = await syncRoomState();
      if (synced) {
        // Clear countdown timers
        if (reconnectCountdownIntervalRef.current) {
          clearInterval(reconnectCountdownIntervalRef.current);
          reconnectCountdownIntervalRef.current = null;
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        setReconnectCountdown(30);
        setOfflineNotice(false);
        setCallConnectionState('CONNECTED');

        // Transient restored notification
        setShowRestoredToast(true);
        if (restoredToastTimerRef.current) clearTimeout(restoredToastTimerRef.current);
        restoredToastTimerRef.current = setTimeout(() => {
          setShowRestoredToast(false);
        }, 3000);

        if (rtcManagerRef.current) {
          rtcManagerRef.current.applyBandwidthProfile(qualityRef.current, isScreenSharing);
        }
      } else {
        throw new Error('Room state synchronization failed');
      }
    } catch (err) {
      console.warn('[CallRoom] Reconnection attempt failed:', err.message);
    } finally {
      isRecoveringRef.current = false;
    }
  }, [syncRoomState, isScreenSharing]);

  /**
   * Browser Network Online / Offline Listeners (Phase 28)
   */
  useEffect(() => {
    if (!hasJoined) return;

    const handleOffline = () => {
      console.warn('[CallRoom] Browser offline event detected.');
      setOfflineNotice(true);
      setCallConnectionState('RECONNECTING');
      setReconnectCountdown(30);

      if (reconnectCountdownIntervalRef.current) clearInterval(reconnectCountdownIntervalRef.current);
      reconnectCountdownIntervalRef.current = setInterval(() => {
        setReconnectCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(reconnectCountdownIntervalRef.current);
            reconnectCountdownIntervalRef.current = null;
            setCallConnectionState('FAILED');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        setCallConnectionState('FAILED');
      }, 30000);
    };

    const handleOnline = () => {
      console.log('[CallRoom] Browser online event detected. Starting recovery...');
      setOfflineNotice(false);
      attemptReconnection();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (reconnectCountdownIntervalRef.current) clearInterval(reconnectCountdownIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (restoredToastTimerRef.current) clearTimeout(restoredToastTimerRef.current);
    };
  }, [hasJoined, attemptReconnection]);

  /**
   * Socket Event Listeners inside Active Room
   */
  useEffect(() => {
    if (!hasJoined) return;

    const socket = getSocket();
    if (!socket) return;

    const rtcManager = rtcManagerRef.current;

    // Participant joined
    const handleParticipantJoined = (data) => {
      console.log('[CallRoom] Participant joined event:', data);
      const participant = data?.participant;
      if (!participant || Number(participant.userId) === Number(user?.id)) return;

      setRemotePeers((prev) => {
        const exists = prev.some((p) => Number(p.userId) === Number(participant.userId));
        if (exists) return prev;
        return [
          ...prev,
          {
            userId: participant.userId,
            name: participant.name,
            avatarUrl: participant.avatarUrl,
            stream: null,
            isHost: participant.role === 'HOST',
            audioEnabled: !participant.serverMuted,
            videoEnabled: !participant.serverCameraDisabled,
            serverMuted: Boolean(participant.serverMuted),
            serverCameraDisabled: Boolean(participant.serverCameraDisabled),
            connectionState: 'connecting',
          },
        ];
      });

      // Existing peers initiate WebRTC connection to the newly joined peer
      if (rtcManager) {
        rtcManager.addPeer(participant.userId);
      }
    };

    // Participant left
    const handleParticipantLeft = (data) => {
      const leftId = data?.userId;
      if (!leftId) return;

      if (rtcManager) {
        rtcManager.removePeer(leftId);
      }
      setRemotePeers((prev) => prev.filter((p) => Number(p.userId) !== Number(leftId)));
      setActiveScreenSharer((prev) => (Number(prev?.userId) === Number(leftId) ? null : prev));
    };

    // Host changed
    const handleHostChanged = (data) => {
      const newHostId = data?.newHostId;
      if (!newHostId) return;

      const isCurrentHost = Number(newHostId) === Number(user?.id);
      setIsHost(isCurrentHost);

      setRemotePeers((prev) =>
        prev.map((p) => ({
          ...p,
          isHost: Number(p.userId) === Number(newHostId),
        }))
      );

      if (isCurrentHost) {
        showToast('You are now the host of this call room.');
      }
    };

    // Room ended by host or system
    const handleRoomEnded = (data) => {
      alert(data?.message || 'This call room has been ended by the host.');
      handleCleanupAndExit();
    };

    // Media states
    const handleAudioState = (data) => {
      setRemotePeers((prev) =>
        prev.map((p) =>
          Number(p.userId) === Number(data.userId) ? { ...p, audioEnabled: data.enabled } : p
        )
      );
    };

    const handleVideoState = (data) => {
      setRemotePeers((prev) =>
        prev.map((p) =>
          Number(p.userId) === Number(data.userId) ? { ...p, videoEnabled: data.enabled } : p
        )
      );
    };

    // ========================================================
    // MODERATION REAL-TIME SIGNALS (Phase 25)
    // ========================================================

    // 1. Participant Muted by Host
    const handleModerationMute = (data) => {
      const targetId = Number(data?.targetUserId);
      if (targetId === Number(user?.id)) {
        setLocalServerMuted(true);
        setMicEnabled(false);
        if (rtcManagerRef.current) {
          rtcManagerRef.current.setAudioEnabled(false);
        }
        showToast(`You have been muted by the host${data?.reason ? `: ${data.reason}` : ''}.`);
      } else {
        setRemotePeers((prev) =>
          prev.map((p) =>
            Number(p.userId) === targetId ? { ...p, serverMuted: true, audioEnabled: false } : p
          )
        );
      }
    };

    // 2. Participant Unmuted by Host
    const handleModerationUnmute = (data) => {
      const targetId = Number(data?.targetUserId);
      if (targetId === Number(user?.id)) {
        setLocalServerMuted(false);
        showToast('The host has unmuted your microphone. You may turn on your mic when ready.');
      } else {
        setRemotePeers((prev) =>
          prev.map((p) =>
            Number(p.userId) === targetId ? { ...p, serverMuted: false } : p
          )
        );
      }
    };

    // 3. Participant Camera Disabled by Host
    const handleModerationCameraDisable = (data) => {
      const targetId = Number(data?.targetUserId);
      if (targetId === Number(user?.id)) {
        setLocalServerCameraDisabled(true);
        setCameraEnabled(false);
        if (isScreenSharing && handleStopScreenShareRef.current) {
          handleStopScreenShareRef.current();
        }
        if (rtcManagerRef.current) {
          rtcManagerRef.current.setVideoEnabled(false);
        }
        showToast(`Your video feed was disabled by the host${data?.reason ? `: ${data.reason}` : ''}.`);
      } else {
        setRemotePeers((prev) =>
          prev.map((p) =>
            Number(p.userId) === targetId ? { ...p, serverCameraDisabled: true, videoEnabled: false } : p
          )
        );
      }
    };

    // 4. Participant Camera Allowed by Host
    const handleModerationCameraEnable = (data) => {
      const targetId = Number(data?.targetUserId);
      if (targetId === Number(user?.id)) {
        setLocalServerCameraDisabled(false);
        showToast('The host has enabled camera usage. You may turn on your camera when ready.');
      } else {
        setRemotePeers((prev) =>
          prev.map((p) =>
            Number(p.userId) === targetId ? { ...p, serverCameraDisabled: false } : p
          )
        );
      }
    };

    // 5. Participant Removed by Host
    const handleParticipantRemoved = (data) => {
      const targetId = Number(data?.targetUserId);
      if (targetId === Number(user?.id)) {
        alert(data?.reason ? `You were removed from this call room: ${data.reason}` : 'You have been removed from this call room by the host.');
        handleCleanupAndExit();
      } else {
        if (rtcManagerRef.current) {
          rtcManagerRef.current.removePeer(targetId);
        }
        setRemotePeers((prev) => prev.filter((p) => Number(p.userId) !== targetId));
        setActiveScreenSharer((prev) => (Number(prev?.userId) === targetId ? null : prev));
      }
    };

    // 6. Participant Blocked by Host
    const handleParticipantBlocked = (data) => {
      const targetId = Number(data?.targetUserId);
      if (targetId === Number(user?.id)) {
        alert(data?.reason ? `You have been blocked from this call room: ${data.reason}` : 'You have been blocked from this call room by the host.');
        handleCleanupAndExit();
      } else {
        if (rtcManagerRef.current) {
          rtcManagerRef.current.removePeer(targetId);
        }
        setRemotePeers((prev) => prev.filter((p) => Number(p.userId) !== targetId));
        setActiveScreenSharer((prev) => (Number(prev?.userId) === targetId ? null : prev));
      }
    };

    // Screen Sharing Signaling (Phase 27)
    const handleScreenShareStarted = (data) => {
      console.log('[CallRoom] Screen share started by peer:', data);
      setActiveScreenSharer(data);
    };

    const handleScreenShareStopped = (data) => {
      console.log('[CallRoom] Screen share stopped by peer:', data);
      setActiveScreenSharer(null);
    };

    // Mesh WebRTC Signaling
    const handleOffer = (data) => {
      if (rtcManager && data.senderId) {
        rtcManager.handleOffer(data.senderId, data.sdp);
      }
    };

    const handleAnswer = (data) => {
      if (rtcManager && data.senderId) {
        rtcManager.handleAnswer(data.senderId, data.sdp);
      }
    };

    const handleIceCandidate = (data) => {
      if (rtcManager && data.senderId) {
        rtcManager.handleIceCandidate(data.senderId, data.candidate);
      }
    };

    socket.on('room:participant-joined', handleParticipantJoined);
    socket.on('room:participant-left', handleParticipantLeft);
    socket.on('room:host-changed', handleHostChanged);
    socket.on('room:ended', handleRoomEnded);
    socket.on('room:audio-state', handleAudioState);
    socket.on('room:video-state', handleVideoState);
    // Phase 28: Participant Reconnecting Presence
    const handleParticipantReconnecting = (data) => {
      const targetUserId = Number(data?.userId);
      if (!targetUserId || targetUserId === Number(user?.id)) return;
      setRemotePeers((prev) =>
        prev.map((p) => (Number(p.userId) === targetUserId ? { ...p, isReconnecting: true } : p))
      );
    };

    const handleParticipantReconnected = (data) => {
      const targetUserId = Number(data?.userId);
      if (!targetUserId || targetUserId === Number(user?.id)) return;
      setRemotePeers((prev) =>
        prev.map((p) => (Number(p.userId) === targetUserId ? { ...p, isReconnecting: false } : p))
      );
    };

    const handleSocketDisconnect = (reason) => {
      console.warn('[CallRoom] Socket disconnected event:', reason);
      if (reason === 'io server disconnect') {
        setCallConnectionState('DISCONNECTED');
        return;
      }
      setCallConnectionState('RECONNECTING');
      if (!reconnectCountdownIntervalRef.current) {
        setReconnectCountdown(30);
        reconnectCountdownIntervalRef.current = setInterval(() => {
          setReconnectCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(reconnectCountdownIntervalRef.current);
              reconnectCountdownIntervalRef.current = null;
              setCallConnectionState('FAILED');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    };

    const handleSocketConnect = () => {
      console.log('[CallRoom] Socket reconnected, triggering room sync...');
      attemptReconnection();
    };

    socket.on('room:moderation-mute', handleModerationMute);
    socket.on('room:moderation-unmute', handleModerationUnmute);
    socket.on('room:moderation-camera-disable', handleModerationCameraDisable);
    socket.on('room:moderation-camera-enable', handleModerationCameraEnable);
    socket.on('room:participant-removed', handleParticipantRemoved);
    socket.on('room:participant-blocked', handleParticipantBlocked);
    socket.on('room:screen-share-started', handleScreenShareStarted);
    socket.on('room:screen-share-stopped', handleScreenShareStopped);
    socket.on('room:offer', handleOffer);
    socket.on('room:answer', handleAnswer);
    socket.on('room:ice-candidate', handleIceCandidate);
    socket.on('room:participant-reconnecting', handleParticipantReconnecting);
    socket.on('room:participant-reconnected', handleParticipantReconnected);
    socket.on('disconnect', handleSocketDisconnect);
    socket.on('connect', handleSocketConnect);

    return () => {
      socket.off('room:participant-joined', handleParticipantJoined);
      socket.off('room:participant-left', handleParticipantLeft);
      socket.off('room:host-changed', handleHostChanged);
      socket.off('room:ended', handleRoomEnded);
      socket.off('room:audio-state', handleAudioState);
      socket.off('room:video-state', handleVideoState);
      socket.off('room:moderation-mute', handleModerationMute);
      socket.off('room:moderation-unmute', handleModerationUnmute);
      socket.off('room:moderation-camera-disable', handleModerationCameraDisable);
      socket.off('room:moderation-camera-enable', handleModerationCameraEnable);
      socket.off('room:participant-removed', handleParticipantRemoved);
      socket.off('room:participant-blocked', handleParticipantBlocked);
      socket.off('room:screen-share-started', handleScreenShareStarted);
      socket.off('room:screen-share-stopped', handleScreenShareStopped);
      socket.off('room:offer', handleOffer);
      socket.off('room:answer', handleAnswer);
      socket.off('room:ice-candidate', handleIceCandidate);
      socket.off('room:participant-reconnecting', handleParticipantReconnecting);
      socket.off('room:participant-reconnected', handleParticipantReconnected);
      socket.off('disconnect', handleSocketDisconnect);
      socket.off('connect', handleSocketConnect);
    };
  }, [hasJoined, user?.id, handleCleanupAndExit, attemptReconnection]);

  // Handle End Room (Host Only)
  const handleEndRoom = async () => {
    if (!window.confirm('Are you sure you want to end this room for all participants?')) {
      return;
    }

    try {
      await endCallRoom(roomCode);
      const socket = getSocket();
      if (socket) {
        socket.emit('room:end', { roomCode });
      }
    } catch (err) {
      console.error('Failed to end room:', err);
    } finally {
      handleCleanupAndExit();
    }
  };

  // Toggle local microphone
  const handleToggleMic = () => {
    if (localServerMuted) {
      showToast('Your microphone has been muted by the host.');
      return;
    }
    const nextState = !micEnabled;
    setMicEnabled(nextState);
    if (rtcManagerRef.current) {
      rtcManagerRef.current.setAudioEnabled(nextState);
    }
  };

  // Toggle local camera
  const handleToggleCamera = () => {
    if (localServerCameraDisabled) {
      showToast('Your camera feed has been disabled by the host.');
      return;
    }
    if (isScreenSharing) {
      showToast('Camera is currently replaced by your active screen share.');
      return;
    }
    const nextState = !cameraEnabled;
    setCameraEnabled(nextState);
    if (rtcManagerRef.current) {
      rtcManagerRef.current.setVideoEnabled(nextState);
    }
  };

  // ========================================================
  // PHASE 27: SCREEN SHARING & DEVICE SWITCHING HANDLERS
  // ========================================================

  const handleStopScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    setIsScreenSharing(false);

    // Restore camera track based on previous preference
    const wasCameraEnabled = cameraEnabledBeforeShareRef.current && !localServerCameraDisabled;

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

      if (rtcManagerRef.current && restoredTrack) {
        await rtcManagerRef.current.replaceVideoTrack(restoredTrack);
        rtcManagerRef.current.setVideoEnabled(wasCameraEnabled);
      }

      setCameraEnabled(wasCameraEnabled);
    } catch (err) {
      console.warn('[CallRoom] Error restoring camera track after screen share:', err);
    } finally {
      previousCameraTrackRef.current = null;
    }

    // Inform server
    const socket = getSocket();
    if (socket) {
      socket.emit('room:screen-share-stopped', { roomCode });
    }
  }, [roomCode, localServerCameraDisabled, selectedVideoDevice]);

  // Keep ref up-to-date for async / socket calls
  handleStopScreenShareRef.current = handleStopScreenShare;

  const handleStartScreenShare = async () => {
    if (localServerCameraDisabled) {
      showToast('Screen sharing is not permitted while video is disabled by host.');
      return;
    }
    if (activeScreenSharer && Number(activeScreenSharer.userId) !== Number(user?.id)) {
      showToast(`${activeScreenSharer.userName || 'Another user'} is already sharing their screen.`);
      return;
    }

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

      const hasScreenAudio = screenStream.getAudioTracks().length > 0;

      // Preserve previous camera state and track
      cameraEnabledBeforeShareRef.current = cameraEnabled;
      if (localStreamRef.current) {
        const camTracks = localStreamRef.current.getVideoTracks();
        if (camTracks.length > 0) {
          previousCameraTrackRef.current = camTracks[0];
        }
      }

      // Replace outgoing video track
      if (rtcManagerRef.current) {
        await rtcManagerRef.current.replaceVideoTrack(screenVideoTrack);
      }

      setIsScreenSharing(true);

      // Handle browser's native stop sharing pill
      screenVideoTrack.onended = () => {
        handleStopScreenShare();
      };

      const socket = getSocket();
      if (socket) {
        socket.emit(
          'room:screen-share-started',
          { roomCode, hasAudio: hasScreenAudio },
          (ack) => {
            if (!ack?.success) {
              showToast(ack?.message || 'Could not start screen share.');
              handleStopScreenShare();
            }
          }
        );
      }
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        console.log('[CallRoom] Screen share prompt dismissed by user.');
      } else {
        console.error('[CallRoom] getDisplayMedia error:', err);
        showToast(err.message || 'Unable to share screen.');
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
      if (newTrack) {
        newTrack.enabled = micEnabled && !localServerMuted;
        if (rtcManagerRef.current) {
          await rtcManagerRef.current.replaceAudioTrack(newTrack);
        }
        showToast('Microphone switched successfully.');
      }
    } catch (err) {
      console.error('[CallRoom] Microphone switch error:', err);
      showToast('Failed to switch microphone.');
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
        newTrack.enabled = cameraEnabled && !localServerCameraDisabled;

        if (isScreenSharing) {
          if (previousCameraTrackRef.current && previousCameraTrackRef.current !== newTrack) {
            previousCameraTrackRef.current.stop();
          }
          previousCameraTrackRef.current = newTrack;
          showToast('Camera changed. Will resume when screen share ends.');
        } else {
          if (rtcManagerRef.current) {
            await rtcManagerRef.current.replaceVideoTrack(newTrack);
          }
          if (localVideoPreviewRef.current) {
            localVideoPreviewRef.current.srcObject = localStreamRef.current;
          }
          showToast('Camera switched successfully.');
        }
      }
    } catch (err) {
      console.error('[CallRoom] Camera switch error:', err);
      showToast('Failed to switch camera.');
    }
  };

  const handleSelectAudioOutputDevice = (deviceId) => {
    setSelectedAudioOutputDevice(deviceId);
    showToast('Speaker output device updated.');
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
          showToast('Selected microphone was disconnected. Reverting to default.');
          handleSelectAudioDevice('');
        }
        if (selectedVideoDevice && !hasVideo) {
          showToast('Selected camera was disconnected. Reverting to default.');
          handleSelectVideoDevice('');
        }
        if (selectedAudioOutputDevice && !hasOutput) {
          setSelectedAudioOutputDevice('');
        }
      } catch (err) {
        console.warn('[CallRoom] devicechange check error:', err);
      }
    };

    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [selectedAudioDevice, selectedVideoDevice, selectedAudioOutputDevice]);

  // Dispatcher for moderation actions from Tile or Drawer
  const handleModerationAction = async (actionType, targetParticipant) => {
    if (!targetParticipant) return;

    // Fast-path actions without modal:
    if (actionType === 'UNMUTE') {
      try {
        await unmuteParticipant(roomCode, targetParticipant.userId);
        showToast(`Allowed microphone for ${targetParticipant.name}`);
      } catch (err) {
        alert(err.response?.data?.message || err.message || 'Failed to unmute participant');
      }
      return;
    }

    if (actionType === 'CAMERA_ENABLE') {
      try {
        await enableCamera(roomCode, targetParticipant.userId);
        showToast(`Allowed camera for ${targetParticipant.name}`);
      } catch (err) {
        alert(err.response?.data?.message || err.message || 'Failed to enable camera');
      }
      return;
    }

    if (actionType === 'REPORT') {
      setSelectedParticipant(targetParticipant);
      setReportModalOpen(true);
      return;
    }

    // Modal-confirmed actions: 'MUTE', 'CAMERA_DISABLE', 'REMOVE', 'BLOCK'
    setSelectedParticipant(targetParticipant);
    setActiveActionType(actionType);
    setActionModalOpen(true);
  };

  // Confirm moderation action from ModerationActionModal
  const handleConfirmModerationAction = async (reason) => {
    if (!selectedParticipant || !activeActionType) return;
    const targetUserId = selectedParticipant.userId;

    switch (activeActionType) {
      case 'MUTE':
        await muteParticipant(roomCode, targetUserId, reason);
        showToast(`Muted microphone for ${selectedParticipant.name}`);
        break;
      case 'CAMERA_DISABLE':
        await disableCamera(roomCode, targetUserId, reason);
        showToast(`Disabled camera for ${selectedParticipant.name}`);
        break;
      case 'REMOVE':
        await removeParticipant(roomCode, targetUserId, reason);
        showToast(`Removed ${selectedParticipant.name} from the room`);
        break;
      case 'BLOCK':
        await blockParticipant(roomCode, targetUserId, reason);
        showToast(`Blocked ${selectedParticipant.name} from rejoining`);
        break;
      default:
        break;
    }
  };

  // Submit report from ReportModal
  const handleConfirmReport = async (payload) => {
    await reportParticipant(roomCode, payload);
    showToast('Report submitted confidentially. Thank you.');
  };

  // Copy room link / code
  const handleCopyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    }
  };

  // Format call duration string MM:SS
  const formatDuration = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      if (rtcManagerRef.current) {
        rtcManagerRef.current.closeAllConnections();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Update participant list for drawer
  useEffect(() => {
    const localEntry = {
      userId: user?.id,
      name: user?.displayName || user?.name || user?.username || 'You',
      avatarUrl: user?.avatarUrl || user?.avatar_url,
      role: isHost ? 'HOST' : 'PARTICIPANT',
      audioEnabled: micEnabled,
      videoEnabled: cameraEnabled,
      serverMuted: localServerMuted,
      serverCameraDisabled: localServerCameraDisabled,
      isLocal: true,
    };
    setParticipantList([localEntry, ...remotePeers]);
  }, [user, isHost, micEnabled, cameraEnabled, localServerMuted, localServerCameraDisabled, remotePeers]);

  // Loading state
  if (loading && !roomData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-600 dark:text-cyan-400 animate-spin" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading call room...</p>
      </div>
    );
  }

  // Error state / Room Not Found / Room Ended / Blocked from Room
  if (errorMessage && !hasJoined) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-6 shadow-xl">
        <div className="w-14 h-14 mx-auto rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Unable to Enter Room</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{errorMessage}</p>
        </div>
        <Button variant="primary" size="md" className="w-full" onClick={() => navigate('/')}>
          Return to Home
        </Button>
      </div>
    );
  }

  // ==========================================
  // VIEW 1: LOBBY (Pre-Join Check)
  // ==========================================
  if (!hasJoined) {
    return (
      <div className="max-w-2xl mx-auto my-6 sm:my-10 p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 dark:bg-cyan-950/40 text-indigo-600 dark:text-cyan-400 border border-indigo-200 dark:border-cyan-800/50">
            {roomData?.roomType === 'GROUP' ? 'Group Call Room' : 'One-to-One Room'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Ready to Join Room?
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Room Code: <span className="font-mono font-bold text-slate-900 dark:text-slate-200">{roomCode}</span>{' '}
            • {roomData?.participantCount || 0} / {roomData?.maxParticipants || 6} Participants
          </p>
        </div>

        {/* Camera Preview Tile */}
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex items-center justify-center">
          <video
            ref={localVideoPreviewRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover -scale-x-100 ${
              !cameraEnabled ? 'hidden' : 'block'
            }`}
          />
          {!cameraEnabled && (
            <div className="flex flex-col items-center justify-center space-y-2 text-slate-400">
              <VideoOff className="w-10 h-10" />
              <span className="text-xs font-medium">Camera is off</span>
            </div>
          )}

          {/* Quick preview media controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
            <button
              onClick={handleToggleMic}
              className={`p-3 rounded-xl transition-all ${
                micEnabled
                  ? 'bg-slate-700/80 text-white hover:bg-slate-600'
                  : 'bg-rose-600 text-white hover:bg-rose-500'
              }`}
              title={micEnabled ? 'Mute Mic' : 'Unmute Mic'}
            >
              {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
            <button
              onClick={handleToggleCamera}
              className={`p-3 rounded-xl transition-all ${
                cameraEnabled
                  ? 'bg-slate-700/80 text-white hover:bg-slate-600'
                  : 'bg-rose-600 text-white hover:bg-rose-500'
              }`}
              title={cameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {cameraEnabled ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Audio only warning */}
        {audioOnlyFallback && (
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 rounded-2xl flex items-center space-x-3 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              Camera was unavailable or permissions were restricted. You are entering with audio only.
            </span>
          </div>
        )}

        {/* Join CTA */}
        <div className="flex items-center space-x-4 pt-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={() => navigate('/')}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            onClick={handleJoinRoom}
            disabled={loading}
            leftIcon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <VideoIcon className="w-4 h-4" />}
          >
            {loading ? 'Entering...' : 'Join Room'}
          </Button>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: ACTIVE CALL ROOM (Mesh Grid + Controls)
  // ==========================================
  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] w-full bg-slate-950 text-white rounded-3xl overflow-hidden relative border border-slate-800/80">
      {/* 1. Header Bar */}
      <div className="p-3 sm:p-4 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex items-center justify-between z-20">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={handleCopyCode}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-slate-200 border border-slate-700 transition-colors"
            title="Click to copy room code"
          >
            <span>{roomCode}</span>
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          <span className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-indigo-950/60 text-cyan-400 border border-cyan-800/40 text-[11px] font-bold">
            {roomData?.roomType === 'GROUP' ? 'Group Mesh' : 'One-to-One'}
          </span>

          {isHost && (
            <span className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-extrabold uppercase">
              <Crown className="w-3 h-3 fill-current" />
              <span>Host</span>
            </span>
          )}
        </div>

        {/* Live Duration Timer & Participant Counter */}
        <div className="flex items-center space-x-2 sm:space-x-4 text-xs font-semibold text-slate-300">
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-black/40 border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono">{formatDuration(durationSeconds)}</span>
          </div>

          {/* Connection Quality & State Indicator (Phase 28) */}
          <div
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-black/40 border border-slate-800 text-xs font-semibold"
            role="status"
            aria-live="polite"
            aria-label={`Connection quality: ${callConnectionState === 'RECONNECTING' ? 'Reconnecting' : connectionQuality}`}
            title={`Connection: ${callConnectionState} (${connectionQuality} quality)`}
          >
            {callConnectionState === 'RECONNECTING' ? (
              <div className="flex items-center space-x-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span className="hidden md:inline text-[11px]">Reconnecting...</span>
              </div>
            ) : callConnectionState === 'FAILED' ? (
              <div className="flex items-center space-x-1.5 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="hidden md:inline text-[11px]">Failed</span>
              </div>
            ) : connectionQuality === 'POOR' ? (
              <div className="flex items-center space-x-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="hidden md:inline text-[11px]">Poor</span>
              </div>
            ) : connectionQuality === 'FAIR' ? (
              <div className="flex items-center space-x-1.5 text-yellow-400">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="hidden md:inline text-[11px]">Fair</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="hidden md:inline text-[11px]">Good</span>
              </div>
            )}
          </div>

          <button
            onClick={() => setRulesModalOpen(true)}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors text-slate-300"
            title="View room safety rules"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Rules</span>
          </button>

          <button
            onClick={() => {
              setIsChatOpen((prev) => !prev);
              if (!isChatOpen) setUnreadMessagesCount(0);
            }}
            className="relative flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors text-slate-300"
            title="Toggle In-Call Chat"
          >
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Chat</span>
            {!isChatOpen && unreadMessagesCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>{1 + remotePeers.length} / {roomData?.maxParticipants || 6}</span>
          </button>
        </div>
      </div>

      {/* Moderation Toast Notification */}
      {moderationToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-indigo-600/90 text-white text-xs font-semibold px-4 py-2 rounded-2xl shadow-xl backdrop-blur-md border border-indigo-400/30 animate-in fade-in slide-in-from-top-2 duration-200">
          {moderationToast}
        </div>
      )}

      {/* Reconnecting Alert Banner (Phase 28) */}
      {callConnectionState === 'RECONNECTING' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-600/95 text-white text-xs font-semibold px-4 py-2 rounded-2xl shadow-xl backdrop-blur-md border border-amber-400/40 flex items-center space-x-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
          <span>
            {offlineNotice
              ? `Your internet connection was interrupted. Trying to reconnect... (${reconnectCountdown}s)`
              : `Connection lost. Reconnecting... (${reconnectCountdown}s)`}
          </span>
        </div>
      )}

      {/* Transient Connection Restored Toast (Phase 28) */}
      {showRestoredToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600/95 text-white text-xs font-semibold px-4 py-2 rounded-2xl shadow-xl backdrop-blur-md border border-emerald-400/40 flex items-center space-x-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="w-2.5 h-2.5 rounded-full bg-white" />
          <span>Connection restored</span>
        </div>
      )}

      {/* Low Bandwidth Video Reduced Notice (Phase 28) */}
      {isLowBandwidthVideoReduced && callConnectionState === 'CONNECTED' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-amber-300 text-[11px] font-medium px-3.5 py-1.5 rounded-xl border border-amber-500/40 shadow-md backdrop-blur-xs flex items-center space-x-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Poor network — video quality temporarily reduced to preserve audio</span>
        </div>
      )}

      {/* Connection Failed Dialog / Modal (Phase 28) */}
      {callConnectionState === 'FAILED' && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-xl">
            <WifiOff className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-white">Connection Interrupted</h3>
            <p className="text-sm text-slate-300 max-w-sm">
              We couldn't restore connection to the call room after multiple attempts.
            </p>
          </div>
          <div className="flex items-center space-x-3 pt-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => attemptReconnection(true)}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Try Again
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleCleanupAndExit}
              leftIcon={<PhoneOff className="w-4 h-4" />}
            >
              Leave Call
            </Button>
          </div>
        </div>
      )}

      {/* 2. Main Content Area: Video Grid + Chat Panel */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
        {/* Video Grid Area */}
        <div className="flex-1 overflow-y-auto relative flex items-center justify-center min-w-0">
          <ParticipantGrid
            localStream={localStreamRef.current}
            localUser={user}
            localAudioEnabled={micEnabled}
            localVideoEnabled={cameraEnabled}
            localServerMuted={localServerMuted}
            localServerCameraDisabled={localServerCameraDisabled}
            isHost={isHost}
            peers={remotePeers}
            onModerationAction={handleModerationAction}
            activeScreenSharer={activeScreenSharer}
            isLocalScreenSharing={isScreenSharing}
            audioOutputDeviceId={selectedAudioOutputDevice}
          />
        </div>

        {/* Chat Panel Container: Side-by-side on desktop (lg+), overlay drawer on mobile */}
        <div
          className={`
            ${isChatOpen ? 'flex' : 'hidden'}
            fixed inset-y-0 right-0 z-50 lg:static lg:z-auto
            w-full sm:w-96 lg:w-80 xl:w-96 h-full flex-shrink-0
            bg-slate-900 shadow-2xl lg:shadow-none
          `}
        >
          <InCallChatPanel
            roomCode={roomCode}
            currentUser={user}
            isHost={isHost}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            socket={getSocket()}
            onUnreadCountChange={setUnreadMessagesCount}
          />
        </div>
      </div>

      {/* 3. Bottom Control Bar */}
      <div className="px-2 py-2.5 sm:p-4 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex flex-wrap items-center justify-center gap-1.5 sm:gap-3 z-20">
        {/* Toggle Mic */}
        <div className="relative group">
          <button
            onClick={handleToggleMic}
            className={`p-2.5 sm:p-3.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-2xl transition-all shadow-md ${
              localServerMuted
                ? 'bg-rose-950/80 text-rose-400 border border-rose-700 cursor-not-allowed opacity-80'
                : micEnabled
                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                : 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-400'
            }`}
            title={
              localServerMuted
                ? 'Muted by host (Disabled)'
                : micEnabled
                ? 'Mute Microphone'
                : 'Unmute Microphone'
            }
          >
            {localServerMuted || !micEnabled ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          {localServerMuted && (
            <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-black/80 text-[10px] text-rose-300 font-bold px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap">
              Muted by Host
            </span>
          )}
        </div>

        {/* Toggle Camera */}
        <div className="relative group">
          <button
            onClick={handleToggleCamera}
            className={`p-2.5 sm:p-3.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-2xl transition-all shadow-md ${
              localServerCameraDisabled
                ? 'bg-rose-950/80 text-rose-400 border border-rose-700 cursor-not-allowed opacity-80'
                : cameraEnabled
                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                : 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-400'
            }`}
            title={
              localServerCameraDisabled
                ? 'Camera disabled by host (Disabled)'
                : cameraEnabled
                ? 'Turn Off Camera'
                : 'Turn On Camera'
            }
          >
            {localServerCameraDisabled || !cameraEnabled ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
          </button>
          {localServerCameraDisabled && (
            <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-black/80 text-[10px] text-amber-300 font-bold px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap">
              Disabled by Host
            </span>
          )}
        </div>

        {/* Screen Share Button */}
        <button
          onClick={isScreenSharing ? handleStopScreenShare : handleStartScreenShare}
          className={`p-2.5 sm:p-3.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-2xl transition-all shadow-md ${
            isScreenSharing
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white ring-4 ring-indigo-500/30'
              : activeScreenSharer && Number(activeScreenSharer.userId) !== Number(user?.id)
              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
              : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
          }`}
          title={
            isScreenSharing
              ? 'Stop Sharing Screen'
              : activeScreenSharer
              ? `${activeScreenSharer.userName || 'Another user'} is sharing screen`
              : 'Share Screen'
          }
          disabled={Boolean(activeScreenSharer && Number(activeScreenSharer.userId) !== Number(user?.id))}
          aria-label={isScreenSharing ? 'Stop Sharing Screen' : 'Share Screen'}
        >
          <MonitorUp className="w-5 h-5 text-indigo-400" />
        </button>

        {/* Device Settings Button */}
        <button
          onClick={() => setIsDeviceSettingsOpen(true)}
          className="p-2.5 sm:p-3.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-2xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all shadow-md"
          title="Audio & Video Device Settings"
          aria-label="Device Settings"
        >
          <Settings className="w-5 h-5 text-slate-300 hover:text-white transition-colors" />
        </button>

        {/* Invite Users Button */}
        <button
          onClick={() => setIsInviteOpen(true)}
          className="p-2.5 sm:p-3.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-2xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all shadow-md"
          title="Invite Participant"
        >
          <UserPlus className="w-5 h-5 text-cyan-400" />
        </button>

        {/* Host Moderation Button (Host only) */}
        {isHost && (
          <button
            onClick={() => setHistoryModalOpen(true)}
            className="p-2.5 sm:p-3.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-2xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all shadow-md"
            title="Room Moderation History & Bans"
          >
            <ShieldAlert className="w-5 h-5 text-amber-400" />
          </button>
        )}

        {/* In-Call Chat Toggle Button */}
        <div className="relative">
          <button
            onClick={() => {
              setIsChatOpen((prev) => !prev);
              if (!isChatOpen) setUnreadMessagesCount(0);
            }}
            className={`p-2.5 sm:p-3.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-2xl transition-all shadow-md ${
              isChatOpen
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400'
                : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
            }`}
            title={isChatOpen ? 'Close In-Call Chat' : 'Open In-Call Chat'}
          >
            <MessageSquare className="w-5 h-5 text-cyan-400" />
          </button>
          {!isChatOpen && unreadMessagesCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border-2 border-slate-900 animate-pulse">
              {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
            </span>
          )}
        </div>

        {/* Participants Drawer Toggle */}
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="p-2.5 sm:p-3.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-2xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all shadow-md"
          title="View Participants"
        >
          <Users className="w-5 h-5 text-indigo-400" />
        </button>

        {/* Leave Room Button */}
        <button
          onClick={handleCleanupAndExit}
          className="px-3.5 py-2.5 sm:px-5 sm:py-3.5 min-h-[40px] flex items-center justify-center rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm font-semibold transition-all"
        >
          Leave
        </button>

        {/* End Room Button (Host Only) */}
        {isHost && (
          <button
            onClick={handleEndRoom}
            className="p-2.5 sm:p-3.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-2xl bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 shadow-md transition-all"
            title="End Room for All"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Participants Drawer */}
      <ParticipantDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        participants={participantList}
        isCurrentHost={isHost}
        onModerationAction={handleModerationAction}
        onOpenHistory={() => setHistoryModalOpen(true)}
        onOpenRules={() => setRulesModalOpen(true)}
      />

      {/* Invite Modal */}
      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        roomCode={roomCode}
      />

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

      {/* Moderation Action Modal (Host actions) */}
      <ModerationActionModal
        isOpen={actionModalOpen}
        onClose={() => {
          setActionModalOpen(false);
          setActiveActionType(null);
          setSelectedParticipant(null);
        }}
        actionType={activeActionType}
        participant={selectedParticipant}
        onConfirm={handleConfirmModerationAction}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => {
          setReportModalOpen(false);
          setSelectedParticipant(null);
        }}
        participant={selectedParticipant}
        onSubmit={handleConfirmReport}
      />

      {/* Moderation History Modal (Host only) */}
      <ModerationHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        roomCode={roomCode}
      />

      {/* Room Rules Modal */}
      <RoomRulesModal
        isOpen={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
      />
    </div>
  );
};

export default CallRoomPage;
