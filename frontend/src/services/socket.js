import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = API_BASE.replace(/\/api\/?$/, '');

let socket = null;
let currentToken = null;

/**
 * Initialize and connect Socket.IO client
 * @param {string} token - Optional JWT token from auth context or storage
 * @returns {import('socket.io-client').Socket}
 */
export const connectSocket = (token = null) => {
  // If already connected with the same token, return existing socket
  if (socket && socket.connected && currentToken === token) {
    return socket;
  }

  // Disconnect existing if token changed
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;

  // Retrieve token from localStorage fallback if not explicitly passed
  const authToken = token || localStorage.getItem('token') || '';

  socket = io(SOCKET_URL, {
    auth: {
      token: authToken,
    },
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected to real-time notification service:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected from notification service:', reason);
    if (reason === 'io server disconnect') {
      // Server manually closed connection; do not auto-reconnect without user intervention
      console.warn('[Socket] Disconnected by server. Automatic reconnection paused.');
    }
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection warning:', err.message);
  });

  return socket;
};

/**
 * Get the active socket instance
 * @returns {import('socket.io-client').Socket|null}
 */
export const getSocket = () => socket;

/**
 * Disconnect socket on user logout
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
};
