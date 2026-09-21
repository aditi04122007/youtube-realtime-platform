import api from './api';

/**
 * Start a new video call
 * @param {number|string} receiverId
 * @returns {Promise<object>}
 */
export const startCall = async (receiverId) => {
  const res = await api.post('/calls', { receiverId });
  return res.data;
};

/**
 * Accept an incoming call
 * @param {number|string} callId
 * @returns {Promise<object>}
 */
export const acceptCall = async (callId) => {
  const res = await api.put(`/calls/${callId}/accept`);
  return res.data;
};

/**
 * Reject an incoming call
 * @param {number|string} callId
 * @returns {Promise<object>}
 */
export const rejectCall = async (callId) => {
  const res = await api.put(`/calls/${callId}/reject`);
  return res.data;
};

/**
 * End an active call
 * @param {number|string} callId
 * @param {string} [reason='ended']
 * @returns {Promise<object>}
 */
export const endCall = async (callId, reason = 'ended') => {
  const res = await api.put(`/calls/${callId}/end`, { reason });
  return res.data;
};

/**
 * Fetch authenticated user's call history
 * @param {object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @returns {Promise<object>}
 */
export const fetchCallHistory = async ({ page = 1, limit = 20 } = {}) => {
  const res = await api.get('/calls/history', {
    params: { page, limit },
  });
  return res.data;
};

/**
 * Fetch details of a single call session
 * @param {number|string} callId
 * @returns {Promise<object>}
 */
export const fetchCallDetails = async (callId) => {
  const res = await api.get(`/calls/${callId}`);
  return res.data;
};

/**
 * Fetch dynamic STUN/TURN ICE server configuration
 * @returns {Promise<object>}
 */
export const fetchIceServers = async () => {
  const res = await api.get('/calls/config/ice-servers');
  return res.data;
};
