const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const http = require('http');
const config = require('./config');
const { testDbConnection } = require('./config/db');
const { initSocketServer } = require('./socket/socketServer');

// Import route modules
const healthRoutes = require('./routes/healthRoutes');
const homeRoutes = require('./routes/homeRoutes');
const authRoutes = require('./routes/authRoutes');
const securityRoutes = require('./routes/securityRoutes');
const userRoutes = require('./routes/userRoutes');
const channelRoutes = require('./routes/channelRoutes');
const videoRoutes = require('./routes/videoRoutes');
const commentRoutes = require('./routes/commentRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const playlistRoutes = require('./routes/playlistRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const callRoutes = require('./routes/callRoutes');
const callRoomRoutes = require('./routes/callRoomRoutes');
const adminRoutes = require('./routes/adminRoutes');
const searchHistoryRoutes = require('./routes/searchHistoryRoutes');
const watchHistoryRoutes = require('./routes/watchHistoryRoutes');
const translationRoutes = require('./routes/translationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const downloadHistoryRoutes = require('./routes/downloadHistoryRoutes');
const watchLaterRoutes = require('./routes/watchLaterRoutes');
const { getCategories } = require('./controllers/videoController');

// Import middleware
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Trust reverse proxy for accurate IP address detection (e.g. behind Nginx, Docker, Cloudflare)
app.set('trust proxy', 1);

// 1. Security Headers (Helmet with customized CSP, cross-origin resource policy, and frameguard)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://checkout.razorpay.com'],
        scriptSrcElem: ["'self'", "'unsafe-inline'", 'https://checkout.razorpay.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'http:', 'https:'],
        mediaSrc: ["'self'", 'data:', 'blob:', 'http:', 'https:'],
        connectSrc: ["'self'", 'http:', 'https:', 'ws:', 'wss:', 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
        frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null,
      },
    },
    frameguard: { action: 'sameorigin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// 2. Cross-Origin Resource Sharing (CORS)
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Disposition'],
  })
);

// 3. HTTP Request Logging (Morgan)
if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
}

// 4. Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.nodeEnv === 'production' ? 150 : 3000, // Limit each IP per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});
app.use('/api', apiLimiter);

// 5. Body & Cookie Parsing with Hardened Limits (Phase 30)
app.use(cookieParser());
app.use(
  express.json({
    limit: '2mb', // Restricted from 10mb to 2mb to mitigate large payload DoS attacks
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 6. Serve Static Uploaded Files (Direct access to call-files is strictly blocked)
app.use('/uploads/call-files', (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Direct access to in-call shared files is forbidden. Files must be accessed via authenticated room endpoints.',
  });
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 7. Base Routes
// Root URL: GET /
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Video platform API is running!',
  });
});

// Health check: GET /api/health
app.use('/api/health', healthRoutes);

// 8. Modular API Routes
app.use('/api/home', homeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/users', userRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/call-rooms', callRoomRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/search-history', searchHistoryRoutes);
app.use('/api/watch-history', watchHistoryRoutes);
app.use('/api/translations', translationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/download-history', downloadHistoryRoutes);
app.use('/api/watch-later', watchLaterRoutes);
app.get('/api/categories', getCategories);

// 9. 404 & Centralized Error Handling
app.use(notFound);
app.use(errorHandler);

// Create HTTP server and initialize Socket.IO
const httpServer = http.createServer(app);
initSocketServer(httpServer);

// Security Startup Check (Phase 30, Requirement 97)
function validateSecurityConfig() {
  const isProduction = config.nodeEnv === 'production';
  const warnings = [];

  if (isProduction) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('dev_secret') || process.env.JWT_SECRET.length < 32) {
      warnings.push('JWT_SECRET is using a default or weak secret (<32 chars) in production.');
    }
    if (!process.env.DB_PASSWORD) {
      warnings.push('DB_PASSWORD is empty or unset in production.');
    }
    if (!process.env.RAZORPAY_KEY_SECRET) {
      warnings.push('RAZORPAY_KEY_SECRET is unset in production.');
    }
    if (config.clientUrl && !config.clientUrl.startsWith('https://') && !config.clientUrl.includes('localhost')) {
      warnings.push(`CLIENT_URL (${config.clientUrl}) does not use HTTPS in production.`);
    }
  }

  if (warnings.length > 0) {
    console.warn('\n================ [SECURITY CONFIGURATION WARNINGS] ================');
    warnings.forEach((w) => console.warn(`[Security Alert] ${w}`));
    console.warn('===================================================================\n');
  } else if (isProduction) {
    console.log('[Security] Production environment configuration verified securely.');
  }
}

// Start server
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(config.port, async () => {
    console.log(`[Server] Video Platform backend running on port ${config.port} in ${config.nodeEnv} mode`);
    console.log(`[Server] Root endpoint: http://localhost:${config.port}/`);
    console.log(`[Server] Health check: http://localhost:${config.port}/api/health`);
    await testDbConnection();

    // Run security configuration audit (Phase 30)
    validateSecurityConfig();

    // Razorpay configuration check (Phase 16)
    if (!config.razorpay?.keyId || !config.razorpay?.keySecret) {
      console.warn('[Razorpay] Warning: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured. Live test orders will require valid test credentials.');
    } else {
      console.log(`[Razorpay] Configured in ${config.razorpay.mode.toUpperCase()} mode (Key ID: ${config.razorpay.keyId.substring(0, 8)}...)`);
    }
  });
}

module.exports = app;
module.exports.httpServer = httpServer;
