const { Server } = require('socket.io');
const config = require('../config');
const { socketAuthMiddleware } = require('./socketAuth');
const { registerCallSignaling } = require('./callSignaling');
const { registerRoomSignaling } = require('./roomSignaling');

let io = null;

/**
 * Initialize Socket.IO server on Node HTTP server
 * @param {import('http').Server} httpServer
 * @returns {Server}
 */
const initSocketServer = (httpServer) => {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // Apply JWT authentication middleware
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const userId = socket.user?.id;
    const userRoom = `user:${userId}`;

    // Join dedicated user room for private real-time delivery
    socket.join(userRoom);
    console.log(`[Socket.IO] User ${socket.user.username} (ID: ${userId}) connected on socket ${socket.id}`);

    // Register WebRTC call signaling handlers
    registerCallSignaling(socket, io);
    registerRoomSignaling(socket, io);

    // Send connection confirmation
    socket.emit('connected', {
      success: true,
      userId,
      username: socket.user.username,
      timestamp: new Date().toISOString(),
    });

    // Client requests to ensure subscription to own room
    socket.on('notifications:subscribe', () => {
      socket.join(userRoom);
      socket.emit('notifications:subscribed', { room: userRoom });
    });

    // Heartbeat ping
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] User ${userId} disconnected (${reason})`);
    });
  });

  console.log('[Socket.IO] Notification socket server initialized');
  return io;
};

/**
 * Get active Socket.IO server instance
 * @returns {Server|null}
 */
const getIO = () => io;

/**
 * Emit an event to a specific authenticated user's private room
 * @param {number|string} userId - Recipient user ID
 * @param {string} event - Event name e.g. 'notification:new'
 * @param {object} payload - Event payload
 * @returns {boolean} True if emitted
 */
const emitToUser = (userId, event, payload) => {
  if (!io) {
    console.warn(`[Socket.IO] emitToUser called before server was initialized for user ${userId}`);
    return false;
  }

  const userRoom = `user:${userId}`;
  io.to(userRoom).emit(event, payload);
  return true;
};

/**
 * Emit an event to all sockets in a specific room
 * @param {string} roomName - e.g. 'room:ROOM-XXXXXX'
 * @param {string} event - Event name
 * @param {object} payload - Event data
 * @returns {boolean}
 */
const emitToRoom = (roomName, event, payload) => {
  if (!io) {
    console.warn(`[Socket.IO] emitToRoom called before server was initialized for room ${roomName}`);
    return false;
  }
  io.to(roomName).emit(event, payload);
  return true;
};

/**
 * Broadcast an event to all connected sockets
 * @param {string} event - Event name
 * @param {object} payload - Event data
 */
const broadcast = (event, payload) => {
  if (!io) return false;
  io.emit(event, payload);
  return true;
};

module.exports = {
  initSocketServer,
  getIO,
  emitToUser,
  emitToRoom,
  broadcast,
};
