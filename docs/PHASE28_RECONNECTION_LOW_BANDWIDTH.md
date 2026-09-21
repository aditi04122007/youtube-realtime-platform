# Phase 28: Real-Time Reconnection, Network Grace Period & Adaptive Low-Bandwidth Handling

## Overview
Phase 28 implements an enterprise-grade connection and network recovery architecture for StreamWave video calling across both **Group Call Rooms** (`CallRoomPage.jsx`) and **One-to-One Calls** (`VideoCallRoom.jsx`). It ensures calls survive transient network dropouts, fluctuating Wi-Fi, high packet loss, and high round-trip latency without dropping calls or corrupting room state:

* **Automatic Socket.IO Reconnection**: Configured with exponential backoff (`1000ms` initial, `5000ms` max cap, `0.5` jitter randomization) and graceful error suppression.
* **Temporary Disconnection Grace Period (25 seconds)**: Abrupt socket disconnections no longer evict users immediately. A 25s in-memory grace window allows clients to reconnect silently while notifying peers with `room:participant-reconnecting` / `call:peer-reconnecting`.
* **State Reconciliation & Rejoin Sync (`room:sync`)**: Returning clients automatically resynchronize authoritative room state (active participants, host role, user moderation flags, active screen presenter) without creating duplicate socket listeners or ghost participant tiles.
* **Automated WebRTC ICE Restarts**: When peer or ICE connection state transitions to `disconnected` or `failed`, the offerer automatically executes an ICE restart (`createOffer({ iceRestart: true })`) to establish fresh network transport candidates.
* **Continuous WebRTC Stats Monitoring & Quality Evaluation**: Real-time `getStats()` telemetry samples packet loss, packets received, round-trip time (RTT), and jitter every 3 seconds. Quality transitions are debounced across consecutive samples into `GOOD`, `FAIR`, or `POOR`.
* **Adaptive Bandwidth Profiles & Encodings**:
  * Dynamically throttles video encoding parameters via `RTCRtpSender.setParameters()` based on network quality:
    * `GOOD`: 1.2 Mbps, 30 FPS, full 1.0 resolution scale.
    * `FAIR`: 400 kbps, 24 FPS, full 1.0 resolution scale.
    * `POOR`: 150 kbps, 15 FPS, 2.0 resolution downscale.
  * Enforces `degradationPreference: 'maintain-resolution'` for screen sharing (throttles framerate instead of downscaling text/code presentations).
  * Strict **Audio Priority**: Audio tracks are never throttled or bitrate-constrained under poor network conditions, preserving voice clarity.
* **Browser Online/Offline Event Detection**: Tracks native `online` / `offline` events with sticky alert banners and automatic recovery dispatchers upon network restoration.
* **Security & Host Moderation Protection**: Ejected or blocked participants cannot circumvent removal via reconnection; all rejoin attempts are authoritatively verified against `call_room_blocks` and `call_room_participants`.

---

## 1. Socket Disconnection Grace Period Architecture

In a standard WebSocket setup, a dropped TCP socket or momentary Wi-Fi handoff triggers an immediate `leaveRoom` event. In small rooms or 2-person calls, this would prematurely terminate the call or trigger an unintended host transfer.

Phase 28 decouples raw socket drops from membership termination via a **25-second server grace period**:

```text
               Client Socket Drop (e.g. Wi-Fi glitch)
                               │
                               ▼
            ┌─────────────────────────────────────┐
            │   Backend: roomSignaling.js         │
            │   reconnectionGraceTimers.set(...)  │
            │   Broadcast: room:participant-      │
            │              reconnecting (25s)     │
            └──────────────────┬──────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │                                     │
    Client Reconnects                      25s Timer Expires
     within 25 seconds                     Without Reconnect
            │                                     │
            ▼                                     ▼
┌───────────────────────┐            ┌─────────────────────────┐
│ cancelGraceTimer()    │            │ getCallRoomService()    │
│ room:participant-     │            │   .leaveRoom(...)       │
│    reconnected        │            │ room:participant-left   │
│ Full room:sync state  │            │ Host transferred/ended  │
└───────────────────────┘            └─────────────────────────┘
```

### Server Grace Timer Implementation (`backend/socket/roomSignaling.js`)
```javascript
const reconnectionGraceTimers = new Map(); // key: `${roomCode}:${userId}`

const cancelGraceTimer = (roomCode, userId) => {
  if (!roomCode || !userId) return false;
  const key = `${roomCode.trim().toUpperCase()}:${userId}`;
  if (reconnectionGraceTimers.has(key)) {
    clearTimeout(reconnectionGraceTimers.get(key));
    reconnectionGraceTimers.delete(key);
    return true;
  }
  return false;
};
```

---

## 2. Authoritative State Synchronization (`room:sync`)

When a client reconnects, it invokes `room:sync` over Socket.IO to receive current room state and resolve drift:

```javascript
socket.on('room:sync', async (data, callback) => {
  const { authorized, room, participant } = await verifyRoomMembership(roomCode);
  if (!authorized) return callback({ success: false, message: 'Unauthorized' });

  // Cancel pending grace timers
  cancelGraceTimer(room.roomCode, userId);

  // Return authoritative state
  callback({
    success: true,
    roomCode: room.roomCode,
    roomStatus: room.status,
    hostId: room.createdBy,
    isHost: participant.role === 'HOST',
    participants: participantsList,
    activeScreenSharer: getActiveScreenSharer(room.roomCode),
    userModerationState: {
      audioMutedByHost: Boolean(participant.server_muted),
      cameraDisabledByHost: Boolean(participant.server_camera_disabled),
    },
  });
});
```

---

## 3. WebRTC ICE Restart & Adaptive Bandwidth Profiles

### ICE Connection Recovery (`roomWebRTC.js`)
```javascript
async restartIce(targetUserId) {
  const attempts = this.iceRestartAttempts.get(targetUserId) || 0;
  if (attempts >= 3) return false;

  this.iceRestartAttempts.set(targetUserId, attempts + 1);
  const pc = this.peerConnections.get(targetUserId);
  const offer = await pc.createOffer({ iceRestart: true });
  await pc.setLocalDescription(offer);

  this.socket.emit('room:offer', {
    roomCode: this.roomCode,
    targetUserId,
    sdp: offer,
    iceRestart: true,
  });
  return true;
}
```

### Adaptive Bitrate Profiles
```javascript
applyBandwidthProfile(quality, isScreenSharing = false) {
  const profile = {
    GOOD: { maxBitrate: 1200000, maxFramerate: 30, scaleResolutionDownBy: 1.0 },
    FAIR: { maxBitrate: 400000,  maxFramerate: 24, scaleResolutionDownBy: 1.0 },
    POOR: { maxBitrate: 150000,  maxFramerate: 15, scaleResolutionDownBy: 2.0 },
  }[quality];

  for (const pc of this.peerConnections.values()) {
    const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
    if (videoSender) {
      const params = videoSender.getParameters();
      if (params.encodings && params.encodings[0]) {
        params.encodings[0].maxBitrate = profile.maxBitrate;
        params.encodings[0].maxFramerate = profile.maxFramerate;
        
        // Screen sharing preserves resolution for legible presentation
        if (isScreenSharing) {
          params.encodings[0].scaleResolutionDownBy = 1.0;
          if (videoSender.track) {
            videoSender.track.contentHint = 'detail';
          }
        } else {
          params.encodings[0].scaleResolutionDownBy = profile.scaleResolutionDownBy;
        }
        videoSender.setParameters(params);
      }
    }
  }
}
```

---

## 4. Real-Time Telemetry & Debounced Quality Estimation

Connection quality is evaluated every 3,000ms using `RTCPeerConnection.getStats()`:
* **Metric Calculation**:
  * Packet Loss Rate: `deltaLost / (deltaLost + deltaReceived) * 100`
  * Round-Trip Time (RTT): from active candidate-pair `currentRoundTripTime * 1000` ms
* **Thresholds**:
  * **POOR**: `packetLossRate > 10%` OR `rtt > 400ms`
  * **FAIR**: `packetLossRate > 3%` OR `rtt > 200ms`
  * **GOOD**: otherwise
* **Debouncing**: To prevent flapping, quality changes require 2 consecutive matching samples before emitting a profile change.

---

## 5. UI / UX Indicators & Notifications

* **Participant Tile Reconnecting State**: Tiles render a translucent overlay with an animated amber beacon (`🟡 Reconnecting... Temporary network interruption`) whenever a peer is in grace recovery.
* **Network Interruption Banner**: Displays in `CallRoomPage.jsx` and `VideoCallRoom.jsx` with an automatic 30-second countdown and manual `[Try Again]` / `[Leave Call]` controls upon failure.
* **Connection Quality Indicator**: Header displays real-time connection badge with color-coded dot (🟢 Good, 🟡 Fair, 🟠 Poor).
* **Low-Bandwidth Warning Banner**: Notifies users when poor network forces resolution downscaling while highlighting that audio remains prioritized.
* **Restored Toast**: Displays a transient confirmation toast ("Connection restored") when returning to a stable link.

---

## 6. Verification and Test Coverage

The automated test suite (`scratch/test_phase28.js`) validates all Phase 28 capabilities:
* **Test 1**: `room:sync` returns full authoritative room metadata and moderation flags.
* **Test 2**: Socket disconnect triggers `room:participant-reconnecting` with `timeoutSeconds: 25` and preserves participant presence in room.
* **Test 3**: Reconnecting within 25s clears grace timer and broadcasts `room:participant-reconnected`.
* **Test 4**: WebRTC ICE restart relay forwards `iceRestart: true` across mesh peers.
* **Test 5**: Moderation removal and block rules prevent unauthorized reconnect or state sync.
* **Test 6**: In-call chat messages persist and deduplicate correctly across reconnect cycles.
* **Test 7**: 1:1 call signaling resilience with 25s grace period and `call:offer` with `iceRestart: true`.

Full regression suites (`test_phase23.js` through `test_phase27.js`) pass with zero regressions.
