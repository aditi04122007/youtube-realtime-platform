const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const config = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'video_platform',
  },
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_key_change_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: process.env.COOKIE_NAME || 'video_platform_token',

  // Email & OTP Configuration (Phase 5)
  emailMode: process.env.EMAIL_MODE || 'development',
  emailFrom: process.env.EMAIL_FROM || 'StreamWave <noreply@streamwave.local>',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
  },
  otp: {
    expiresMinutes: Number(process.env.OTP_EXPIRES_MINUTES) || 10,
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS) || 5,
    resendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 60,
  },
  lockout: {
    maxFailedAttempts: Number(process.env.LOCKOUT_MAX_ATTEMPTS) || 5,
    durationMinutes: Number(process.env.LOCKOUT_DURATION_MINUTES) || 15,
  },

  // Video & Media Upload Configuration (Phase 7)
  upload: {
    maxVideoSizeMb: Number(process.env.MAX_VIDEO_SIZE_MB) || 500,
    maxThumbnailSizeMb: Number(process.env.MAX_THUMBNAIL_SIZE_MB) || 5,
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
  },

  // Translation Configuration (Phase 13)
  translation: {
    provider: process.env.TRANSLATION_PROVIDER || 'development',
    apiUrl: process.env.TRANSLATION_API_URL || '',
    apiKey: process.env.TRANSLATION_API_KEY || '',
    timeoutMs: Number(process.env.TRANSLATION_TIMEOUT_MS) || 10000,
  },

  // Subscription Configuration (Phase 15)
  subscription: {
    demoMode: process.env.SUBSCRIPTION_DEMO_MODE === 'true',
  },

  // Razorpay Test Payment Configuration (Phase 16)
  razorpay: {
    mode: process.env.RAZORPAY_MODE || 'test',
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  // WebRTC & Video Calling Configuration (Phase 23)
  webrtc: {
    stunServer: process.env.WEBRTC_STUN_SERVER || 'stun:stun.l.google.com:19302',
    turnServer: process.env.WEBRTC_TURN_SERVER || '',
    turnUsername: process.env.WEBRTC_TURN_USERNAME || '',
    turnCredential: process.env.WEBRTC_TURN_CREDENTIAL || '',
    ringingTimeoutSeconds: Number(process.env.CALL_RINGING_TIMEOUT_SECONDS) || 30,
  },

  // Group / Call Rooms Configuration (Phase 24)
  callRooms: {
    maxGroupParticipants: Number(process.env.MAX_GROUP_CALL_PARTICIPANTS) || 6,
    maxOneToOneParticipants: Number(process.env.MAX_ONE_TO_ONE_PARTICIPANTS) || 2,
    idleTimeoutMinutes: Number(process.env.ROOM_IDLE_TIMEOUT_MINUTES) || 30,
  },

  // In-Call Chat & File Sharing (Phase 26)
  callChat: {
    maxMessageLength: Number(process.env.MAX_CALL_MESSAGE_LENGTH) || 2000,
    maxFileSizeMb: Number(process.env.MAX_CALL_FILE_SIZE_MB) || 25,
    storagePath: process.env.CALL_FILE_STORAGE_PATH || 'uploads/call-files',
    rateLimitMax: Number(process.env.CALL_CHAT_RATE_LIMIT) || 20,
  },
};

module.exports = config;
