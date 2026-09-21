import api from './api';

/**
 * Host mutes a participant's microphone
 * @param {string} roomCode
 * @param {number|string} targetUserId
 * @param {string} [reason]
 */
export const muteParticipant = async (roomCode, targetUserId, reason) => {
  const res = await api.post(
    `/call-rooms/${encodeURIComponent(roomCode)}/participants/${targetUserId}/mute`,
    { reason }
  );
  return res.data;
};

/**
 * Host unmutes a participant's microphone
 * @param {string} roomCode
 * @param {number|string} targetUserId
 */
export const unmuteParticipant = async (roomCode, targetUserId) => {
  const res = await api.post(
    `/call-rooms/${encodeURIComponent(roomCode)}/participants/${targetUserId}/unmute`
  );
  return res.data;
};

/**
 * Host disables a participant's camera
 * @param {string} roomCode
 * @param {number|string} targetUserId
 * @param {string} [reason]
 */
export const disableCamera = async (roomCode, targetUserId, reason) => {
  const res = await api.post(
    `/call-rooms/${encodeURIComponent(roomCode)}/participants/${targetUserId}/camera-disable`,
    { reason }
  );
  return res.data;
};

/**
 * Host re-enables a participant's camera
 * @param {string} roomCode
 * @param {number|string} targetUserId
 */
export const enableCamera = async (roomCode, targetUserId) => {
  const res = await api.post(
    `/call-rooms/${encodeURIComponent(roomCode)}/participants/${targetUserId}/camera-enable`
  );
  return res.data;
};

/**
 * Host removes a participant from the room
 * @param {string} roomCode
 * @param {number|string} targetUserId
 * @param {string} [reason]
 */
export const removeParticipant = async (roomCode, targetUserId, reason) => {
  const res = await api.post(
    `/call-rooms/${encodeURIComponent(roomCode)}/participants/${targetUserId}/remove`,
    { reason }
  );
  return res.data;
};

/**
 * Host blocks a participant from rejoining the room
 * @param {string} roomCode
 * @param {number|string} targetUserId
 * @param {string} [reason]
 */
export const blockParticipant = async (roomCode, targetUserId, reason) => {
  const res = await api.post(
    `/call-rooms/${encodeURIComponent(roomCode)}/participants/${targetUserId}/block`,
    { reason }
  );
  return res.data;
};

/**
 * Host unblocks a participant
 * @param {string} roomCode
 * @param {number|string} targetUserId
 */
export const unblockParticipant = async (roomCode, targetUserId) => {
  const res = await api.post(
    `/call-rooms/${encodeURIComponent(roomCode)}/participants/${targetUserId}/unblock`
  );
  return res.data;
};

/**
 * Any room participant reports another participant
 * @param {string} roomCode
 * @param {object} payload
 * @param {number|string} payload.targetUserId
 * @param {string} payload.category - e.g. 'Harassment' | 'Abusive behavior' | etc.
 * @param {string} [payload.reason]
 * @param {string} [payload.details]
 */
export const reportParticipant = async (roomCode, payload) => {
  const res = await api.post(
    `/call-rooms/${encodeURIComponent(roomCode)}/report`,
    payload
  );
  return res.data;
};

/**
 * Host fetches room moderation history and active blocks
 * @param {string} roomCode
 */
export const fetchModerationHistory = async (roomCode) => {
  const res = await api.get(
    `/call-rooms/${encodeURIComponent(roomCode)}/moderation`
  );
  return res.data;
};
