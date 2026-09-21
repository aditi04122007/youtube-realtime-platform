import React from 'react';
import ParticipantTile from './ParticipantTile';

const ParticipantGrid = ({
  localStream,
  localUser,
  localAudioEnabled,
  localVideoEnabled,
  localServerMuted = false,
  localServerCameraDisabled = false,
  isHost,
  peers = [], // [{ userId, name, avatarUrl, stream, isHost, audioEnabled, videoEnabled, serverMuted, serverCameraDisabled, connectionState }]
  onModerationAction,
  activeScreenSharer = null,
  isLocalScreenSharing = false,
  audioOutputDeviceId = '',
}) => {
  const isPeerScreenSharing = Boolean(
    activeScreenSharer && Number(activeScreenSharer.userId) !== Number(localUser?.id)
  );
  const isSpotlightActive = isLocalScreenSharing || isPeerScreenSharing;

  // Render local tile helper
  const renderLocalTile = (inSpotlight = false) => (
    <ParticipantTile
      userId={localUser?.id}
      stream={localStream}
      name={localUser?.name || localUser?.username || 'You'}
      avatarUrl={localUser?.avatarUrl || localUser?.avatar_url}
      isLocal={true}
      isHost={isHost}
      isCurrentHost={isHost}
      audioEnabled={localAudioEnabled}
      videoEnabled={localVideoEnabled}
      serverMuted={localServerMuted}
      serverCameraDisabled={localServerCameraDisabled}
      onModerationAction={onModerationAction}
      isScreenSharing={isLocalScreenSharing}
      hasScreenAudio={activeScreenSharer?.hasAudio}
      audioOutputDeviceId={audioOutputDeviceId}
    />
  );

  // Render remote peer tile helper
  const renderPeerTile = (peer, inSpotlight = false) => {
    const isSharer = Boolean(
      activeScreenSharer && Number(activeScreenSharer.userId) === Number(peer.userId)
    );
    return (
      <ParticipantTile
        key={peer.userId}
        userId={peer.userId}
        stream={peer.stream}
        name={peer.name}
        avatarUrl={peer.avatarUrl}
        isLocal={false}
        isHost={peer.isHost}
        isCurrentHost={isHost}
        audioEnabled={peer.audioEnabled}
        videoEnabled={peer.videoEnabled}
        serverMuted={peer.serverMuted}
        serverCameraDisabled={peer.serverCameraDisabled}
        connectionState={peer.connectionState}
        onModerationAction={onModerationAction}
        isScreenSharing={isSharer}
        hasScreenAudio={isSharer ? activeScreenSharer?.hasAudio : false}
        audioOutputDeviceId={audioOutputDeviceId}
        isReconnecting={Boolean(peer.isReconnecting)}
      />
    );
  };

  // SPOTLIGHT MODE: If someone is sharing screen
  if (isSpotlightActive) {
    let spotlightTile = null;
    let otherTiles = [];

    if (isLocalScreenSharing) {
      spotlightTile = renderLocalTile(true);
      otherTiles = peers.map((p) => (
        <div key={p.userId} className="w-48 sm:w-56 lg:w-full aspect-video shrink-0">
          {renderPeerTile(p, false)}
        </div>
      ));
    } else {
      const sharerPeer = peers.find(
        (p) => Number(p.userId) === Number(activeScreenSharer?.userId)
      );
      if (sharerPeer) {
        spotlightTile = renderPeerTile(sharerPeer, true);
        otherTiles.push(
          <div key="local" className="w-48 sm:w-56 lg:w-full aspect-video shrink-0">
            {renderLocalTile(false)}
          </div>
        );
        peers
          .filter((p) => Number(p.userId) !== Number(activeScreenSharer?.userId))
          .forEach((p) => {
            otherTiles.push(
              <div key={p.userId} className="w-48 sm:w-56 lg:w-full aspect-video shrink-0">
                {renderPeerTile(p, false)}
              </div>
            );
          });
      } else {
        spotlightTile = renderLocalTile(false);
      }
    }

    return (
      <div className="flex flex-col lg:flex-row w-full h-full p-2 sm:p-4 gap-4 overflow-hidden">
        {/* Spotlight Shared Screen Area */}
        <div className="flex-1 w-full h-full min-h-[300px] rounded-3xl overflow-hidden shadow-2xl relative">
          {spotlightTile}
        </div>

        {/* Other participants strip */}
        {otherTiles.length > 0 && (
          <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto lg:w-60 xl:w-72 flex-shrink-0 p-1">
            {otherTiles}
          </div>
        )}
      </div>
    );
  }

  // STANDARD GRID MODE
  const totalCount = 1 + peers.length;
  const getGridClasses = () => {
    switch (totalCount) {
      case 1:
        return 'grid-cols-1 max-w-3xl mx-auto min-h-[400px] sm:min-h-[500px]';
      case 2:
        return 'grid-cols-1 md:grid-cols-2 min-h-[350px]';
      case 3:
      case 4:
        return 'grid-cols-1 sm:grid-cols-2 min-h-[280px]';
      case 5:
      case 6:
      default:
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 min-h-[220px]';
    }
  };

  return (
    <div className={`grid gap-4 w-full h-full p-2 sm:p-4 ${getGridClasses()}`}>
      {/* 1. Local Participant Tile */}
      <div className="aspect-video w-full h-full">
        {renderLocalTile(false)}
      </div>

      {/* 2. Remote Peers Tiles */}
      {peers.map((peer) => (
        <div key={peer.userId} className="aspect-video w-full h-full">
          {renderPeerTile(peer, false)}
        </div>
      ))}
    </div>
  );
};

export default ParticipantGrid;
