import api from './api';

/**
 * Create a new one-to-one or group call room
 * @param {object} params
 * @param {string} [params.roomType='ONE_TO_ONE'] - 'ONE_TO_ONE' | 'GROUP'
 * @param {number} [params.maxParticipants] - Participant limit
 * @returns {Promise<object>}
 */
export const createCallRoom = async ({ roomType = 'ONE_TO_ONE', maxParticipants } = {}) => {
  const res = await api.post('/call-rooms', { roomType, maxParticipants });
  return res.data;
};

/**
 * Fetch details and metadata of a call room
 * @param {string} roomCode
 * @returns {Promise<object>}
 */
export const fetchRoomDetails = async (roomCode) => {
  const res = await api.get(`/call-rooms/${encodeURIComponent(roomCode)}`);
  return res.data;
};

/**
 * Join an active or waiting call room
 * @param {string} roomCode
 * @returns {Promise<object>}
 */
export const joinCallRoom = async (roomCode) => {
  const res = await api.post(`/call-rooms/${encodeURIComponent(roomCode)}/join`);
  return res.data;
};

/**
 * Leave a call room
 * @param {string} roomCode
 * @returns {Promise<object>}
 */
export const leaveCallRoom = async (roomCode) => {
  const res = await api.post(`/call-rooms/${encodeURIComponent(roomCode)}/leave`);
  return res.data;
};

/**
 * Host ends a call room for everyone
 * @param {string} roomCode
 * @returns {Promise<object>}
 */
export const endCallRoom = async (roomCode) => {
  const res = await api.post(`/call-rooms/${encodeURIComponent(roomCode)}/end`);
  return res.data;
};

/**
 * Fetch active joined participants for a call room
 * @param {string} roomCode
 * @returns {Promise<object>}
 */
export const fetchRoomParticipants = async (roomCode) => {
  const res = await api.get(`/call-rooms/${encodeURIComponent(roomCode)}/participants`);
  return res.data;
};

/**
 * Host invites another user to join the call room
 * @param {string} roomCode
 * @param {number|string} userId
 * @returns {Promise<object>}
 */
export const inviteToCallRoom = async (roomCode, userId) => {
  const res = await api.post(`/call-rooms/${encodeURIComponent(roomCode)}/invite`, { userId });
  return res.data;
};
