const fs = require('fs');
const path = require('path');
const config = require('../config');

// Ensure root and subfolder upload destinations exist
const UPLOADS_ROOT = path.resolve(__dirname, '..', config.upload.uploadDir || 'uploads');
const VIDEOS_DIR = path.join(UPLOADS_ROOT, 'videos');
const THUMBNAILS_DIR = path.join(UPLOADS_ROOT, 'thumbnails');

const ensureDirectory = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDirectory(UPLOADS_ROOT);
ensureDirectory(VIDEOS_DIR);
ensureDirectory(THUMBNAILS_DIR);

/**
 * Storage Service Abstraction
 * Local filesystem implementation for Development.
 * Easily swappable for S3 / Cloud Storage in Production.
 */
class StorageService {
  /**
   * Get relative URL for a video file
   * @param {string} filename
   * @returns {string} e.g. "/uploads/videos/filename.mp4"
   */
  getVideoUrl(filename) {
    if (!filename) return null;
    return `/uploads/videos/${filename}`;
  }

  /**
   * Get relative URL for a thumbnail file
   * @param {string} filename
   * @returns {string} e.g. "/uploads/thumbnails/filename.jpg"
   */
  getThumbnailUrl(filename) {
    if (!filename) return null;
    return `/uploads/thumbnails/${filename}`;
  }

  /**
   * Safely deletes a file from the local filesystem.
   * Enforces that the target path strictly resides within the allowed upload directory.
   * @param {string} relativeUrl e.g. "/uploads/videos/abc.mp4"
   * @returns {boolean} whether the file was found and deleted
   */
  deleteFile(relativeUrl) {
    if (!relativeUrl || typeof relativeUrl !== 'string') return false;

    try {
      // Normalize leading slashes
      const cleanUrl = relativeUrl.startsWith('/') ? relativeUrl.slice(1) : relativeUrl;
      const fullPath = path.resolve(__dirname, '..', cleanUrl);

      // Security check: Must reside within UPLOADS_ROOT
      if (!fullPath.startsWith(UPLOADS_ROOT)) {
        console.warn(`[StorageService] Blocked attempt to delete path outside uploads: ${fullPath}`);
        return false;
      }

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return true;
      }
    } catch (err) {
      console.error(`[StorageService] Failed to delete file ${relativeUrl}:`, err.message);
    }
    return false;
  }

  /**
   * Delete a video file by relative URL or filename
   * @param {string} videoUrl
   */
  deleteVideo(videoUrl) {
    return this.deleteFile(videoUrl);
  }

  /**
   * Delete a thumbnail file by relative URL or filename
   * @param {string} thumbnailUrl
   */
  deleteThumbnail(thumbnailUrl) {
    return this.deleteFile(thumbnailUrl);
  }

  /**
   * Get filesystem path for an uploaded file
   * @param {string} relativeUrl
   * @returns {string|null}
   */
  getAbsolutePath(relativeUrl) {
    if (!relativeUrl) return null;
    const cleanUrl = relativeUrl.startsWith('/') ? relativeUrl.slice(1) : relativeUrl;
    const fullPath = path.resolve(__dirname, '..', cleanUrl);
    if (!fullPath.startsWith(UPLOADS_ROOT)) return null;
    return fullPath;
  }
}

module.exports = new StorageService();
