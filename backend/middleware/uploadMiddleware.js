const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Allowed image formats
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Ensures target upload directory exists
 * @param {string} dirPath
 */
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Creates a specialized multer storage engine for a subfolder
 * @param {string} subfolderName
 */
const createDiskStorage = (subfolderName) => {
  const targetDir = path.join(__dirname, '..', 'uploads', subfolderName);
  ensureDirectoryExists(targetDir);

  return multer.diskStorage({
    destination: (req, file, cb) => {
      ensureDirectoryExists(targetDir);
      cb(null, targetDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const randomName = crypto.randomBytes(16).toString('hex');
      cb(null, `${randomName}-${Date.now()}${ext}`);
    },
  });
};

/**
 * File filter to validate MIME type and extension
 */
const imageFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
    const error = new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }

  cb(null, true);
};

/**
 * Wrapper middleware factory for handling multer errors cleanly
 * @param {string} subfolder
 * @param {string} fieldName
 */
const createUploadMiddleware = (subfolder, fieldName) => {
  const upload = multer({
    storage: createDiskStorage(subfolder),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: imageFileFilter,
  }).single(fieldName);

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            message: 'Image file is too large (maximum 5 MB allowed)',
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'Error processing uploaded image',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: `Please select an image file to upload ('${fieldName}')`,
        });
      }

      next();
    });
  };
};

// Allowed video formats (Phase 7)
const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];
const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'];

const MAX_VIDEO_SIZE = (Number(process.env.MAX_VIDEO_SIZE_MB) || 500) * 1024 * 1024;
const MAX_THUMBNAIL_SIZE = (Number(process.env.MAX_THUMBNAIL_SIZE_MB) || 5) * 1024 * 1024;

/**
 * Storage for combined video and thumbnail uploads
 */
const mediaDiskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subfolder = file.fieldname === 'video' ? 'videos' : 'thumbnails';
    const targetDir = path.join(__dirname, '..', 'uploads', subfolder);
    ensureDirectoryExists(targetDir);
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}-${Date.now()}${ext}`);
  },
});

/**
 * Combined file filter for video and thumbnail
 */
const mediaFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (file.fieldname === 'video') {
    if (!ALLOWED_VIDEO_MIME_TYPES.includes(file.mimetype) || !ALLOWED_VIDEO_EXTENSIONS.includes(ext)) {
      const error = new Error('Invalid video format. Only MP4, WebM, MOV, and M4V files are allowed.');
      error.code = 'INVALID_VIDEO_FORMAT';
      return cb(error, false);
    }
  } else if (file.fieldname === 'thumbnail') {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
      const error = new Error('Invalid thumbnail format. Only JPEG, PNG, and WebP images are allowed.');
      error.code = 'INVALID_IMAGE_FORMAT';
      return cb(error, false);
    }
  }

  cb(null, true);
};

const mediaUpload = multer({
  storage: mediaDiskStorage,
  limits: {
    fileSize: MAX_VIDEO_SIZE, // Global max ceiling (video is larger)
  },
  fileFilter: mediaFileFilter,
}).fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

/**
 * Middleware handling video creation upload (video required, thumbnail optional)
 */
const uploadVideoAndThumbnail = (req, res, next) => {
  mediaUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: `Uploaded file exceeds maximum allowed size (Video: 500 MB, Thumbnail: 5 MB)`,
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    } else if (err) {
      const status = err.code === 'INVALID_VIDEO_FORMAT' || err.code === 'INVALID_IMAGE_FORMAT' ? 400 : 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'Error processing uploaded media',
      });
    }

    // Enforce thumbnail file size specifically
    if (req.files?.thumbnail?.[0] && req.files.thumbnail[0].size > MAX_THUMBNAIL_SIZE) {
      // Clean up uploaded files
      try {
        if (req.files.video?.[0]?.path) fs.unlinkSync(req.files.video[0].path);
        if (req.files.thumbnail[0].path) fs.unlinkSync(req.files.thumbnail[0].path);
      } catch (cleanErr) {}
      return res.status(413).json({
        success: false,
        message: 'Thumbnail file is too large (maximum 5 MB allowed)',
      });
    }

    next();
  });
};

/**
 * Safely deletes an old local file inside the uploads directory
 * Prevents directory traversal attacks.
 * @param {string} fileUrl e.g. "/uploads/avatars/random.jpg"
 * @param {string} expectedSubfolder e.g. "avatars"
 */
const deleteOldUpload = (fileUrl, expectedSubfolder) => {
  if (!fileUrl || typeof fileUrl !== 'string') return;

  const expectedPrefix = `/uploads/${expectedSubfolder}/`;
  if (!fileUrl.startsWith(expectedPrefix)) return;

  try {
    const filename = path.basename(fileUrl);
    const targetPath = path.join(__dirname, '..', 'uploads', expectedSubfolder, filename);
    const uploadsDir = path.resolve(path.join(__dirname, '..', 'uploads', expectedSubfolder));

    // Ensure target path is strictly within the expected upload subfolder
    if (path.resolve(targetPath).startsWith(uploadsDir) && fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  } catch (error) {
    console.error(`[Upload] Failed to delete old upload ${fileUrl}:`, error.message);
  }
};

module.exports = {
  uploadUserAvatar: createUploadMiddleware('avatars', 'avatar'),
  uploadUserBanner: createUploadMiddleware('banners', 'banner'),
  uploadChannelAvatar: createUploadMiddleware('channel-avatars', 'avatar'),
  uploadChannelBanner: createUploadMiddleware('channel-banners', 'banner'),
  uploadVideoAndThumbnail,
  uploadThumbnailOnly: createUploadMiddleware('thumbnails', 'thumbnail'),
  uploadOptionalThumbnail: (req, res, next) => {
    const upload = multer({
      storage: createDiskStorage('thumbnails'),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: imageFileFilter,
    }).single('thumbnail');

    upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            message: 'Thumbnail file is too large (maximum 5 MB allowed)',
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'Error processing uploaded image',
        });
      }
      next();
    });
  },
  deleteOldUpload,
};

