/**
 * Mesh WebRTC Room Coordinator for Phase 24
 * Manages peer connections for small group mesh call rooms (up to 6 participants).
 * Reuses a single local MediaStream across all peer connections.
 */
export class RoomWebRTCManager {
  constructor({ roomCode, currentUserId, socket, iceServers, onRemoteStream, onPeerLeft, onConnectionStateChange }) {
    this.roomCode = roomCode;
    this.currentUserId = currentUserId;
    this.socket = socket;
    this.iceServers = iceServers || [{ urls: 'stun:stun.l.google.com:19302' }];
    this.onRemoteStream = onRemoteStream || (() => {});
    this.onPeerLeft = onPeerLeft || (() => {});
    this.onConnectionStateChange = onConnectionStateChange || (() => {});

    this.localStream = null;
    this.peerConnections = new Map(); // targetUserId -> RTCPeerConnection
    this.pendingCandidates = new Map(); // targetUserId -> RTCIceCandidate[]
    this.iceRestartAttempts = new Map(); // targetUserId -> number
    this.isRestartingIce = new Map(); // targetUserId -> boolean
    this.recoveryTimers = new Map(); // targetUserId -> timerId
    this.statsInterval = null;
    this.currentQuality = 'GOOD';
    this.qualityHistory = [];
    this.MAX_ICE_RESTART_ATTEMPTS = 3;
  }

  /**
   * Set the active local media stream (microphone + optional camera)
   * @param {MediaStream} stream
   */
  setLocalStream(stream) {
    this.localStream = stream;

    // Attach local tracks to any existing peer connections
    if (stream) {
      this.peerConnections.forEach((pc) => {
        const senders = pc.getSenders();
        stream.getTracks().forEach((track) => {
          const alreadySending = senders.some((s) => s.track && s.track.kind === track.kind);
          if (!alreadySending) {
            pc.addTrack(track, stream);
          }
        });
      });
    }
  }

  /**
   * Create RTCPeerConnection for a specific target user
   * @param {number|string} targetUserId
   * @param {boolean} isInitiator
   * @returns {RTCPeerConnection}
   */
  createPeerConnection(targetUserId, isInitiator = false) {
    if (this.peerConnections.has(targetUserId)) {
      return this.peerConnections.get(targetUserId);
    }

    console.log(`[MeshWebRTC] Creating RTCPeerConnection to user ${targetUserId} (isInitiator=${isInitiator})`);

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
    });

    this.peerConnections.set(targetUserId, pc);
    this.pendingCandidates.set(targetUserId, []);

    // 1. Add local tracks to new connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // 2. Handle remote track
    pc.ontrack = (event) => {
      console.log(`[MeshWebRTC] Received remote track (${event.track.kind}) from user ${targetUserId}`);
      if (event.streams && event.streams[0]) {
        this.onRemoteStream(targetUserId, event.streams[0]);
      }
    };

    // 3. Handle local ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('room:ice-candidate', {
          roomCode: this.roomCode,
          targetUserId,
          candidate: event.candidate,
        });
      }
    };

    // 4. Handle connection state changes with ICE recovery (Phase 28)
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[MeshWebRTC] User ${targetUserId} connection state: ${state}`);
      this.onConnectionStateChange(targetUserId, state);

      if (state === 'connected') {
        // Reset recovery attempts on successful connection
        this.iceRestartAttempts.set(targetUserId, 0);
        if (this.recoveryTimers.has(targetUserId)) {
          clearTimeout(this.recoveryTimers.get(targetUserId));
          this.recoveryTimers.delete(targetUserId);
        }
      } else if (state === 'disconnected') {
        // Wait brief 2.5s window for potential self-recovery before triggering ICE restart
        if (!this.recoveryTimers.has(targetUserId)) {
          const timer = setTimeout(() => {
            this.recoveryTimers.delete(targetUserId);
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
              console.log(`[MeshWebRTC] Disconnection persisted for user ${targetUserId}. Triggering ICE restart.`);
              this.restartIce(targetUserId);
            }
          }, 2500);
          this.recoveryTimers.set(targetUserId, timer);
        }
      } else if (state === 'failed') {
        // Controlled recovery attempt on ICE failure
        console.warn(`[MeshWebRTC] Connection failed for user ${targetUserId}. Attempting ICE restart.`);
        this.restartIce(targetUserId);
      } else if (state === 'closed') {
        this.removePeer(targetUserId);
      }
    };

    // 5. Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      console.log(`[MeshWebRTC] User ${targetUserId} ICE connection state: ${iceState}`);
      if (iceState === 'failed') {
        this.restartIce(targetUserId);
      } else if (iceState === 'connected' || iceState === 'completed') {
        this.iceRestartAttempts.set(targetUserId, 0);
      }
    };

    return pc;
  }

  /**
   * Initiate offer to a peer (called by existing room participants when a new user joins)
   * @param {number|string} targetUserId
   */
  async addPeer(targetUserId) {
    if (Number(targetUserId) === Number(this.currentUserId)) return;

    try {
      const pc = this.createPeerConnection(targetUserId, true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (this.socket) {
        this.socket.emit('room:offer', {
          roomCode: this.roomCode,
          targetUserId,
          sdp: pc.localDescription,
        });
      }
    } catch (err) {
      console.error(`[MeshWebRTC] Error initiating offer to user ${targetUserId}:`, err);
    }
  }

  /**
   * Handle incoming WebRTC offer from a peer
   * @param {number|string} senderId
   * @param {RTCSessionDescriptionInit} sdp
   */
  async handleOffer(senderId, sdp) {
    if (Number(senderId) === Number(this.currentUserId)) return;

    try {
      console.log(`[MeshWebRTC] Handling offer from user ${senderId}`);
      const pc = this.createPeerConnection(senderId, false);

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      // Process any queued ICE candidates
      const pending = this.pendingCandidates.get(senderId) || [];
      for (const candidate of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      }
      this.pendingCandidates.set(senderId, []);

      // Create and send answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (this.socket) {
        this.socket.emit('room:answer', {
          roomCode: this.roomCode,
          targetUserId: senderId,
          sdp: pc.localDescription,
        });
      }
    } catch (err) {
      console.error(`[MeshWebRTC] Error handling offer from user ${senderId}:`, err);
    }
  }

  /**
   * Handle incoming WebRTC answer from a peer
   * @param {number|string} senderId
   * @param {RTCSessionDescriptionInit} sdp
   */
  async handleAnswer(senderId, sdp) {
    try {
      console.log(`[MeshWebRTC] Handling answer from user ${senderId}`);
      const pc = this.peerConnections.get(senderId);
      if (!pc) {
        console.warn(`[MeshWebRTC] Peer connection for user ${senderId} not found on answer`);
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      // Process any queued ICE candidates
      const pending = this.pendingCandidates.get(senderId) || [];
      for (const candidate of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      }
      this.pendingCandidates.set(senderId, []);
    } catch (err) {
      console.error(`[MeshWebRTC] Error handling answer from user ${senderId}:`, err);
    }
  }

  /**
   * Handle incoming ICE candidate from a peer
   * @param {number|string} senderId
   * @param {RTCIceCandidateInit} candidate
   */
  async handleIceCandidate(senderId, candidate) {
    try {
      const pc = this.peerConnections.get(senderId);
      if (!pc || !pc.remoteDescription) {
        // Queue candidate if remote description is not set yet
        const list = this.pendingCandidates.get(senderId) || [];
        list.push(candidate);
        this.pendingCandidates.set(senderId, list);
        return;
      }

      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn(`[MeshWebRTC] Error adding ICE candidate from user ${senderId}:`, err);
    }
  }

  /**
   * Remove peer connection when a participant leaves
   * @param {number|string} userId
   */
  removePeer(userId) {
    if (this.peerConnections.has(userId)) {
      const pc = this.peerConnections.get(userId);
      try {
        pc.close();
      } catch (e) {}
      this.peerConnections.delete(userId);
      this.pendingCandidates.delete(userId);
      this.iceRestartAttempts.delete(userId);
      this.isRestartingIce.delete(userId);
      if (this.recoveryTimers.has(userId)) {
        clearTimeout(this.recoveryTimers.get(userId));
        this.recoveryTimers.delete(userId);
      }
      this.onPeerLeft(userId);
    }
  }

  /**
   * Controlled ICE restart with exponential backoff (Phase 28)
   * @param {number|string} targetUserId
   */
  async restartIce(targetUserId) {
    const pc = this.peerConnections.get(targetUserId);
    if (!pc || pc.connectionState === 'closed') return;

    if (this.isRestartingIce.get(targetUserId)) {
      console.log(`[MeshWebRTC] ICE restart already in progress for user ${targetUserId}`);
      return;
    }

    const attempts = this.iceRestartAttempts.get(targetUserId) || 0;
    if (attempts >= this.MAX_ICE_RESTART_ATTEMPTS) {
      console.warn(`[MeshWebRTC] Max ICE restart attempts (${this.MAX_ICE_RESTART_ATTEMPTS}) reached for user ${targetUserId}.`);
      this.onConnectionStateChange(targetUserId, 'failed');
      return;
    }

    this.isRestartingIce.set(targetUserId, true);
    this.iceRestartAttempts.set(targetUserId, attempts + 1);

    const backoffDelay = 1000 * Math.pow(2, attempts); // 1s, 2s, 4s
    console.log(`[MeshWebRTC] Scheduling ICE restart attempt ${attempts + 1}/${this.MAX_ICE_RESTART_ATTEMPTS} for user ${targetUserId} in ${backoffDelay}ms`);

    setTimeout(async () => {
      try {
        if (!this.peerConnections.has(targetUserId) || pc.connectionState === 'closed') {
          return;
        }

        console.log(`[MeshWebRTC] Executing ICE restart offer for user ${targetUserId}`);
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);

        if (this.socket) {
          this.socket.emit('room:offer', {
            roomCode: this.roomCode,
            targetUserId,
            sdp: pc.localDescription,
            iceRestart: true,
          });
        }
      } catch (err) {
        console.error(`[MeshWebRTC] Error during ICE restart for user ${targetUserId}:`, err);
      } finally {
        this.isRestartingIce.set(targetUserId, false);
      }
    }, backoffDelay);
  }

  /**
   * Toggle local microphone audio track
   * @param {boolean} enabled
   */
  setAudioEnabled(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => {
        t.enabled = enabled;
      });
    }
    if (this.socket) {
      this.socket.emit('room:audio-state', {
        roomCode: this.roomCode,
        enabled,
      });
    }
  }

  /**
   * Toggle local camera video track
   * @param {boolean} enabled
   */
  setVideoEnabled(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((t) => {
        t.enabled = enabled;
      });
    }
    if (this.socket) {
      this.socket.emit('room:video-state', {
        roomCode: this.roomCode,
        enabled,
      });
    }
  }

  /**
   * Replace the outgoing video track across all active peer connections
   * Used for screen sharing and camera switching without restarting peer connections
   * @param {MediaStreamTrack|null} newTrack
   */
  async replaceVideoTrack(newTrack) {
    const promises = [];
    this.peerConnections.forEach((pc, targetUserId) => {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => (s.track && s.track.kind === 'video') || s.kind === 'video');
      if (videoSender) {
        promises.push(
          videoSender.replaceTrack(newTrack).catch((err) => {
            console.error(`[MeshWebRTC] Error replacing video track for peer ${targetUserId}:`, err);
          })
        );
      } else if (newTrack && this.localStream) {
        try {
          pc.addTrack(newTrack, this.localStream);
        } catch (err) {
          console.error(`[MeshWebRTC] Error adding video track for peer ${targetUserId}:`, err);
        }
      }
    });

    await Promise.all(promises);

    // Update video track in localStream reference
    if (this.localStream) {
      const oldTracks = this.localStream.getVideoTracks();
      if (newTrack) {
        if (!oldTracks.includes(newTrack)) {
          oldTracks.forEach((t) => this.localStream.removeTrack(t));
          this.localStream.addTrack(newTrack);
        }
      } else {
        oldTracks.forEach((t) => this.localStream.removeTrack(t));
      }
    }
  }

  /**
   * Replace the outgoing audio track across all active peer connections
   * Used for microphone switching without restarting peer connections
   * @param {MediaStreamTrack|null} newTrack
   */
  async replaceAudioTrack(newTrack) {
    const promises = [];
    this.peerConnections.forEach((pc, targetUserId) => {
      const senders = pc.getSenders();
      const audioSender = senders.find((s) => (s.track && s.track.kind === 'audio') || s.kind === 'audio');
      if (audioSender) {
        promises.push(
          audioSender.replaceTrack(newTrack).catch((err) => {
            console.error(`[MeshWebRTC] Error replacing audio track for peer ${targetUserId}:`, err);
          })
        );
      } else if (newTrack && this.localStream) {
        try {
          pc.addTrack(newTrack, this.localStream);
        } catch (err) {
          console.error(`[MeshWebRTC] Error adding audio track for peer ${targetUserId}:`, err);
        }
      }
    });

    await Promise.all(promises);

    // Update audio track in localStream reference
    if (this.localStream) {
      const oldTracks = this.localStream.getAudioTracks();
      if (newTrack) {
        if (!oldTracks.includes(newTrack)) {
          oldTracks.forEach((t) => this.localStream.removeTrack(t));
          this.localStream.addTrack(newTrack);
        }
      } else {
        oldTracks.forEach((t) => this.localStream.removeTrack(t));
      }
    }
  }

  /**
   * Start periodic WebRTC stats monitoring and quality classification (Phase 28)
   * @param {function} onQualityChange - ({ quality, stats }) => void
   * @param {number} [intervalMs=3000]
   */
  startStatsMonitoring(onQualityChange, intervalMs = 3000) {
    if (this.statsInterval) clearInterval(this.statsInterval);

    this.statsInterval = setInterval(async () => {
      if (this.peerConnections.size === 0) {
        if (this.currentQuality !== 'GOOD') {
          this.currentQuality = 'GOOD';
          this.qualityHistory = ['GOOD'];
          if (typeof onQualityChange === 'function') {
            onQualityChange({ quality: 'GOOD', stats: { packetLossRatio: 0, rtt: 0, jitter: 0 } });
          }
        }
        return;
      }

      let totalPacketsLost = 0;
      let totalPacketsReceived = 0;
      let sumJitter = 0;
      let jitterCount = 0;
      let sumRtt = 0;
      let rttCount = 0;

      for (const [peerId, pc] of this.peerConnections.entries()) {
        if (pc.connectionState === 'closed') continue;
        try {
          const stats = await pc.getStats();
          stats.forEach((report) => {
            if (report.type === 'inbound-rtp') {
              if (typeof report.packetsLost === 'number') totalPacketsLost += report.packetsLost;
              if (typeof report.packetsReceived === 'number') totalPacketsReceived += report.packetsReceived;
              if (typeof report.jitter === 'number') {
                sumJitter += report.jitter;
                jitterCount++;
              }
            }
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              const rtt = report.currentRoundTripTime || report.roundTripTime;
              if (typeof rtt === 'number') {
                sumRtt += rtt;
                rttCount++;
              }
            }
          });
        } catch (e) {}
      }

      const packetLossRatio =
        totalPacketsReceived + totalPacketsLost > 0
          ? totalPacketsLost / (totalPacketsReceived + totalPacketsLost)
          : 0;
      const avgJitter = jitterCount > 0 ? sumJitter / jitterCount : 0;
      const avgRtt = rttCount > 0 ? sumRtt / rttCount : 0;

      // Classify current sample
      let sample = 'GOOD';
      if (packetLossRatio > 0.08 || avgRtt > 0.400 || avgJitter > 0.100) {
        sample = 'POOR';
      } else if (packetLossRatio > 0.03 || avgRtt > 0.200 || avgJitter > 0.050) {
        sample = 'FAIR';
      }

      // Check navigator.connection hint if available
      if (typeof navigator !== 'undefined' && navigator.connection) {
        if (navigator.connection.saveData || navigator.connection.effectiveType === '2g') {
          sample = 'POOR';
        }
      }

      // Debounce: Maintain rolling window of 3 samples
      this.qualityHistory.push(sample);
      if (this.qualityHistory.length > 3) {
        this.qualityHistory.shift();
      }

      // Only shift quality if 2 consecutive samples agree
      const recent = this.qualityHistory.slice(-2);
      const isConsistent = recent.length >= 2 && recent[0] === recent[1];
      if (isConsistent && this.currentQuality !== recent[0]) {
        this.currentQuality = recent[0];
        console.log(`[MeshWebRTC] Connection quality shifted to ${this.currentQuality}`);
        if (typeof onQualityChange === 'function') {
          onQualityChange({
            quality: this.currentQuality,
            stats: { packetLossRatio, rtt: avgRtt, jitter: avgJitter },
          });
        }
      }
    }, intervalMs);
  }

  stopStatsMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  /**
   * Adjust video encoding parameters and degradation preferences based on connection quality (Phase 28)
   * Preserves audio priority and maintains resolution for screen sharing
   * @param {'GOOD'|'FAIR'|'POOR'} quality
   * @param {boolean} [isScreenSharing=false]
   */
  async applyBandwidthProfile(quality, isScreenSharing = false) {
    const promises = [];

    // Target parameters based on quality tier and media type
    let maxBitrate;
    let maxFramerate;
    let scaleResolutionDownBy;

    if (quality === 'POOR') {
      maxBitrate = isScreenSharing ? 400000 : 200000; // Screen share gets 400kbps, camera gets 200kbps
      maxFramerate = isScreenSharing ? 10 : 15;
      scaleResolutionDownBy = isScreenSharing ? 1.0 : 2.0; // NEVER downscale screen resolution (text legibility)
    } else if (quality === 'FAIR') {
      maxBitrate = isScreenSharing ? 800000 : 600000;
      maxFramerate = isScreenSharing ? 15 : 20;
      scaleResolutionDownBy = isScreenSharing ? 1.0 : 1.5;
    } else {
      // GOOD
      maxBitrate = isScreenSharing ? 2000000 : 1500000;
      maxFramerate = isScreenSharing ? 30 : 30;
      scaleResolutionDownBy = 1.0;
    }

    const degradationPreference = isScreenSharing ? 'maintain-resolution' : 'balanced';

    this.peerConnections.forEach((pc) => {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

      if (videoSender) {
        try {
          const params = videoSender.getParameters();
          if (params && params.encodings && params.encodings.length > 0) {
            params.encodings.forEach((enc) => {
              enc.maxBitrate = maxBitrate;
              enc.maxFramerate = maxFramerate;
              enc.scaleResolutionDownBy = scaleResolutionDownBy;
            });
            if ('degradationPreference' in params) {
              params.degradationPreference = degradationPreference;
            }
            promises.push(
              videoSender.setParameters(params).catch((err) => {
                console.warn('[MeshWebRTC] Failed to set video sender parameters:', err.message);
              })
            );
          }
        } catch (e) {
          console.warn('[MeshWebRTC] Error adjusting sender parameters:', e.message);
        }
      }
    });

    await Promise.all(promises);
  }

  /**
   * Close all active peer connections and release resources
   */
  closeAllConnections() {
    this.stopStatsMonitoring();

    this.recoveryTimers.forEach((timer) => clearTimeout(timer));
    this.recoveryTimers.clear();
    this.iceRestartAttempts.clear();
    this.isRestartingIce.clear();

    this.peerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch (e) {}
    });
    this.peerConnections.clear();
    this.pendingCandidates.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (e) {}
      });
      this.localStream = null;
    }
  }
}
