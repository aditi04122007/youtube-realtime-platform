# Phase 27: Screen Sharing and Device Switching

## Overview
Phase 27 equips StreamWave's real-time video call rooms (`ONE_TO_ONE` and `GROUP`) with full screen-sharing capabilities and granular audio/video device management:
* **Screen Sharing via `getDisplayMedia`**: Capture entire screens, specific application windows, or browser tabs with high-definition presentation.
* **WebRTC Connection Reuse**: Dynamic video track replacement using `RTCRtpSender.replaceTrack()` without tearing down peer connections, avoiding renegotiation overhead or call drops.
* **Single Active Screen Sharer Rule**: Enforced server-side per room to prevent visual collisions and bandwidth saturation in peer-to-peer mesh calling.
* **Screen Share Spotlight Layout**: Responsive UI automatically promotes the active presenter to a dominant central viewport while arranging participant camera streams into a responsive strip.
* **Seamless Camera & Mic Preservation**:
  * Microphone stream remains active throughout screen sharing.
  * System/tab audio captured from screen share is optionally mixed into call audio.
  * When screen sharing ends (via UI button or native browser "Stop sharing" bar), the user's camera is automatically restored if it was previously enabled.
* **Granular Device Switching**:
  * Live selection of Camera (`videoinput`), Microphone (`audioinput`), and Speakers (`audiooutput`).
  * Direct audio output routing via `HTMLMediaElement.setSinkId()` where supported by the browser.
  * Live video preview and synthetic dual-tone speaker test in `DeviceSettingsModal`.
  * Hot-plug device change detection via `navigator.mediaDevices.ondevicechange`.
* **Moderation & Disconnect Synchronization**:
  * If a presenter is removed or blocked by the host (Phase 25), their screen share is instantly terminated server-side.
  * Leaving, socket disconnect, or room termination immediately frees the room's screen-sharing slot.

---

## 1. WebRTC Track Replacement Architecture

In StreamWave's full-mesh WebRTC architecture, creating a separate peer connection for screen sharing would double connection overhead. Instead, Phase 27 leverages in-place track replacement via `RTCRtpSender`:

```text
[Local Media Source]
  Camera Track  ──────┐
                      ├─► [replaceTrack(newTrack)] ──► [RTCRtpSender] ──► [Existing RTCPeerConnection]
  Screen Track  ──────┘
```

### Video Track Replacement (`roomWebRTC.js`)
```javascript
replaceVideoTrack(newTrack) {
  this.localStream?.getVideoTracks().forEach((t) => {
    if (t !== newTrack) t.stop();
  });
  
  for (const [peerId, pc] of this.peers.entries()) {
    const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (sender) {
      sender.replaceTrack(newTrack);
    }
  }
}
```

### Audio Track Replacement (`roomWebRTC.js`)
```javascript
replaceAudioTrack(newTrack) {
  this.localStream?.getAudioTracks().forEach((t) => {
    if (t !== newTrack) t.stop();
  });

  for (const [peerId, pc] of this.peers.entries()) {
    const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'audio');
    if (sender) {
      sender.replaceTrack(newTrack);
    }
  }
}
```

---

## 2. Real-Time Signaling & State Synchronization

Backend signaling in `backend/socket/roomSignaling.js` coordinates room-wide screen-sharing state using an in-memory registry:

### In-Memory State Registry
```javascript
const activeScreenSharersByRoom = new Map(); // roomCode -> { userId, socketId, username, displayName, hasAudio, startedAt }
```

### Socket Events

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `room:join` | Client -> Server | `{ roomCode }` | Response ack and broadcast include `activeScreenSharer` info. |
| `room:screen-share-started` | Client -> Server | `{ roomCode, hasAudio }` | Requests screen sharing slot. Enforces single active sharer rule. |
| `room:screen-share-started` | Server -> Room | `{ roomCode, userId, username, displayName, hasAudio, startedAt }` | Broadcast to all peers when a user starts sharing. |
| `room:screen-share-stopped` | Client -> Server | `{ roomCode }` | Presenter stops sharing; slot is freed immediately. |
| `room:screen-share-stopped` | Server -> Room | `{ roomCode, userId }` | Broadcast to all peers when screen share ends. |

### Single Active Sharer Enforcement
When a client requests `room:screen-share-started`:
1. Server verifies room exists and user is an active, unblocked participant.
2. If another participant is already sharing, the request is rejected with `{ success: false, error: "Another participant is already sharing their screen" }`.
3. If the user was already sharing, metadata is updated and acknowledged without duplicate broadcasts.
4. On success, the room slot is assigned and `room:screen-share-started` is broadcast to all participants in `room:<roomCode>`.

---

## 3. Moderation & Lifecycle Integration

To prevent orphaned screen shares or presentation hijacking:

1. **Host Moderation Ejection / Ban**:
   - When a host removes or blocks a participant via `callModerationService.removeParticipant` or `callModerationService.blockParticipant`, `clearActiveScreenSharer(roomCode, targetUserId)` is executed.
   - If the ejected user was sharing, the server clears the registry and broadcasts `room:screen-share-stopped`.
2. **Participant Leaving / Room End**:
   - Calling `leaveRoom` or `endRoom` in `callRoomService` cleans up active screen shares.
3. **Socket Disconnection**:
   - If a presenter loses connectivity or closes their browser tab, the socket `disconnect` handler detects active screen shares and broadcasts `room:screen-share-stopped` to the remaining peers.

---

## 4. Frontend Components & UI Modes

### Device Settings Modal (`DeviceSettingsModal.jsx`)
* **Device Enumeration**: Lists available cameras, microphones, and speakers using `navigator.mediaDevices.enumerateDevices()`.
* **Live Video Preview**: Mounts a local video preview using the selected camera device ID.
* **Speaker Chime Test**: Uses Web Audio API (`AudioContext`) to play an ascending dual-tone chime (440 Hz -> 880 Hz) routed to the selected speaker via `HTMLMediaElement.setSinkId()`.
* **Hot-Plug Handling**: Listens to `navigator.mediaDevices.ondevicechange` to refresh device lists dynamically when hardware is plugged or unplugged.

### Screen Share Spotlight Mode (`ParticipantGrid.jsx`)
* **Spotlight Presentation**: When any participant (local or remote) is sharing their screen, the grid switches from equal-tile layout to **Spotlight Mode**.
* **Spotlight Tile**: The presenter's screen share occupies a prominent viewport (`min-h-[380px] lg:h-[650px]`) with `object-contain` display and black letterboxing.
* **Participant Strip**: Other call participants are arranged in a horizontal or vertical scrollable strip (`w-48` to `w-64`) so presenters and viewers maintain eye contact with cameras.

### Participant Tile (`ParticipantTile.jsx`)
* **Non-Mirrored Screen Display**: Removes CSS mirror reflection (`scale-x-1`) when `isScreenSharing = true` so text, documents, and code are legible.
* **Status Badges**:
  * Live **"PRESENTING"** badge with screen icon in top-left corner.
  * System audio status pill (**"Screen Audio"**).
* **Audio Routing**: Applies `audioOutputDeviceId` to remote participant `<audio>` / `<video>` tags via `element.setSinkId()`.

### Room Controllers (`CallRoomPage.jsx` & `VideoCallRoom.jsx`)
* **Toggle Controls**:
  * `MonitorUp` button: Starts screen share via `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })`.
  * `Settings` button: Opens `DeviceSettingsModal`.
* **Camera Preference Restoration**: Remembers whether the camera was enabled before starting screen share. If it was active, camera video is automatically re-acquired and replaced when screen share stops.
* **Microphone Preservation**: Screen sharing acquires display tracks without halting or affecting the microphone track.
* **Native Browser "Stop sharing" Listener**: Listens to `screenTrack.onended` to cleanly trigger teardown and signaling if the user stops sharing via browser chrome.

---

## 5. Automated Verification Suite

Run the Phase 27 automated test suite:
```bash
node scratch/test_phase27.js
```

### Test Coverage (28 Checks, 0 Failures):
1. **Join State Synchronization**: Verifies `activeScreenSharer` is initially `null` in ack.
2. **Start Screen Sharing**: Host starts screen share; verifies ack and room broadcast.
3. **Single Active Sharer Enforcement**: Member concurrent share attempt rejected with error.
4. **Late Joiner Synchronization**: Late joining participant receives current screen sharer in join ack.
5. **Stop Screen Sharing**: Sharer stops share; verifies broadcast to room.
6. **Slot Re-acquisition**: Member successfully acquires screen share after host stopped.
7. **Disconnect Cleanup**: Abrupt socket disconnect frees screen-sharing slot automatically.
8. **Moderation Cleanup**: Host ejecting presenter automatically terminates screen share and broadcasts stop event.
9. **Outsider Rejection**: Non-members attempting to share screen are blocked.
10. **Room End Cleanup**: Ending call room clears all active screen-sharing state.
