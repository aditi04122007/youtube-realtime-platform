const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config');

// Safe allowed extensions for in-call sharing
const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.doc',
  '.xlsx',
  '.xls',
  '.pptx',
  '.ppt',
  '.txt',
  '.csv',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.zip',
  '.rar',
  '.7z',
]);

// Explicitly blocked dangerous extensions
const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.scr',
  '.ps1',
  '.sh',
  '.vbs',
  '.msi',
  '.jar',
  '.com',
  '.pif',
  '.dll',
  '.bin',
  '.php',
  '.py',
  '.rb',
  '.pl',
]);

const MAX_FILE_SIZE = (config.callChat?.maxFileSizeMb || 25) * 1024 * 1024; // 25 MB

/**
 * Ensures call-files directory exists
 */
const getCallFilesDirectory = () => {
  const targetDir = path.join(__dirname, '..', 'uploads', 'call-files');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  return targetDir;
};

/**
 * Multer disk storage for in-call shared files
 */
const callFileDiskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const targetDir = getCallFilesDirectory();
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomHex = crypto.randomBytes(16).toString('hex');
    const safeName = `${randomHex}-${Date.now()}${ext}`;
    cb(null, safeName);
  },
});

/**
 * File filter to validate safe file extensions and prevent executable uploads
 */
const callFileFilter = (req, file, cb) => {
  const originalLower = (file.originalname || '').toLowerCase();
  const ext = path.extname(originalLower);

  // Check for dangerous extensions (including disguised files like report.pdf.exe)
  const segments = originalLower.split('.');
  for (let i = 1; i < segments.length; i++) {
    const partExt = `.${segments[i]}`;
    if (BLOCKED_EXTENSIONS.has(partExt)) {
      const error = new Error('Executable and script files are strictly prohibited.');
      error.code = 'BLOCKED_FILE_TYPE';
      return cb(error, false);
    }
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    const error = new Error(`File type '${ext || 'unknown'}' is not allowed. Supported formats: PDF, DOCX, XLSX, PPTX, TXT, CSV, PNG, JPG, WEBP, GIF, ZIP.`);
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }

  // Reject executable or shell MIME types
  const blockedMimeTypes = [
    'application/x-msdownload',
    'application/x-sh',
    'application/x-csh',
    'application/x-bat',
    'application/x-msdos-program',
    'application/javascript',
    'application/x-executable',
  ];
  if (blockedMimeTypes.includes(file.mimetype)) {
    const error = new Error('Executable MIME type is prohibited.');
    error.code = 'BLOCKED_MIME_TYPE';
    return cb(error, false);
  }

  cb(null, true);
};

const upload = multer({
  storage: callFileDiskStorage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: callFileFilter,
}).single('file');

/**
 * Express middleware for in-call file upload
 */
const uploadCallFile = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxMb = config.callChat?.maxFileSizeMb || 25;
        return res.status(413).json({
          success: false,
          message: `File is too large. Maximum size is ${maxMb} MB.`,
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Error processing uploaded file.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file was uploaded. Please attach a file under the 'file' field.",
      });
    }

    next();
  });
};

module.exports = {
  uploadCallFile,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
};
