const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const storageService = require('./storageService');
const downloadQuotaService = require('./downloadQuotaService');

class DownloadService {
  /**
   * Generates a safe, sanitized filename from video title.
   * Strips all path separators, quotes, carriage returns, line feeds,
   * control characters, and reserved filesystem symbols.
   *
   * @param {string} title - Video title
   * @param {number|string} videoId - Fallback ID
   * @param {string} mimeType - Video MIME type
   * @returns {string} Safe attachment filename
   */
  sanitizeFilename(title, videoId = 'video', mimeType = 'video/mp4') {
    let extension = '.mp4';
    if (mimeType === 'video/webm') extension = '.webm';
    else if (mimeType === 'video/ogg') extension = '.ogg';
    else if (mimeType === 'video/quicktime') extension = '.mov';

    if (!title || typeof title !== 'string') {
      return `video-${videoId}${extension}`;
    }

    // 1. Remove CR, LF, null bytes, and path traversal characters
    let safeName = title
      .replace(/[\r\n\0]/g, '')
      .replace(/[/\\:*?"<>|]/g, '-') // Replace path and filesystem illegal chars
      .replace(/[^\x20-\x7E]/g, '') // Keep standard printable ASCII
      .trim();

    // 2. Normalize whitespace and hyphens
    safeName = safeName
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '');

    // 3. Fallback if empty after sanitization
    if (!safeName || safeName.length === 0) {
      safeName = `video-${videoId}`;
    }

    // 4. Truncate length (max 100 chars)
    if (safeName.length > 100) {
      safeName = safeName.substring(0, 100).replace(/-+$/, '');
    }

    // Ensure extension is not duplicated
    if (safeName.toLowerCase().endsWith(extension)) {
      return safeName;
    }

    return `${safeName}${extension}`;
  }

  /**
   * Safely stream a video file as an attachment download with database lifecycle logging
   * and authoritative monthly quota enforcement.
   *
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Object} video - Video record from database
   * @param {Object} downloadAccess - Authorization result from canUserDownloadVideo
   */
  async streamDownload(req, res, video, downloadAccess) {
    // Handle external video URLs (e.g. CDN or cloud storage)
    if (video.video_url && (video.video_url.startsWith('http://') || video.video_url.startsWith('https://'))) {
      return res.redirect(video.video_url);
    }

    // 1. Resolve physical file path safely
    const filePath = storageService.getAbsolutePath(video.video_url);
    if (!filePath || !fs.existsSync(filePath)) {
      const fallbackUrl = 'https://vjs.zencdn.net/v/oceans.mp4';
      console.warn(`[DownloadService] Media file ${video.video_url} not found on server. Redirecting to: ${fallbackUrl}`);
      return res.redirect(fallbackUrl);
    }

    // 2. Inspect file stats before reserving quota
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (statErr) {
      console.error('[DownloadService] fs.statSync error:', statErr.message);
      return res.status(500).json({
        success: false,
        message: 'Unable to access media file',
      });
    }

    const fileSize = stat.size;
    const mimeType = video.mime_type || 'video/mp4';
    const filename = this.sanitizeFilename(video.title, video.id, mimeType);
    const userId = req.user.id;

    // 3. Inspect HTTP Range header
    const rangeHeader = req.headers.range;
    let isRangeContinuation = false;
    let rangeStart = 0;
    let rangeEnd = fileSize - 1;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const rawStart = parts[0].trim();
      const rawEnd = parts[1] ? parts[1].trim() : '';

      if (rawStart === '' && rawEnd !== '') {
        const suffixLength = parseInt(rawEnd, 10);
        if (!isNaN(suffixLength) && suffixLength > 0) {
          rangeStart = Math.max(0, fileSize - suffixLength);
          rangeEnd = fileSize - 1;
        }
      } else {
        rangeStart = parseInt(rawStart, 10);
        rangeEnd = rawEnd !== '' ? parseInt(rawEnd, 10) : fileSize - 1;
      }

      if (!isNaN(rangeStart) && rangeStart > 0) {
        isRangeContinuation = true;
      }
    }

    // 4. Reserve Quota / Deduplicate Range chunks
    let downloadId = null;
    let historyId = null;

    if (isRangeContinuation) {
      // Chunk continuation: do NOT consume quota again
      const recentSession = await downloadQuotaService.findRecentDownloadSession(userId, video.id, 60);
      if (recentSession) {
        downloadId = recentSession.download_id;
        historyId = recentSession.id;
      }
    } else {
      // Check for rapid duplicate request within 5s to avoid double charging
      const recentDuplicate = await downloadQuotaService.findRecentDownloadSession(userId, video.id, 5);
      if (recentDuplicate) {
        downloadId = recentDuplicate.download_id;
        historyId = recentDuplicate.id;
      } else if (downloadAccess?.isOwner) {
        // Creator management bypass: log record without consuming viewer quota
        try {
          const [dRes] = await pool.query(
            `INSERT INTO downloads 
               (user_id, video_id, status, file_name, file_size, mime_type, created_at, updated_at)
             VALUES 
               (?, ?, 'STARTED', ?, ?, ?, NOW(), NOW())`,
            [userId, video.id, filename, fileSize, mimeType]
          );
          downloadId = dRes.insertId;

          const [hRes] = await pool.query(
            `INSERT INTO download_history
               (user_id, video_id, download_id, status, file_name, file_size, mime_type, downloaded_at, created_at, updated_at)
             VALUES
               (?, ?, ?, 'STARTED', ?, ?, ?, NOW(), NOW(), NOW())`,
            [userId, video.id, downloadId, filename, fileSize, mimeType]
          );
          historyId = hRes.insertId;
        } catch (dbErr) {
          console.error('[DownloadService] Owner download log error:', dbErr.message);
        }
      } else {
        // Standard user: transaction-safe quota reservation
        const reservation = await downloadQuotaService.reserveDownloadQuota(
          userId,
          video.id,
          filename,
          fileSize,
          mimeType
        );

        if (!reservation.allowed) {
          return res.status(reservation.status || 403).json({
            success: false,
            message: reservation.message,
            code: reservation.code || 'QUOTA_EXHAUSTED',
            reason: reservation.code || 'QUOTA_EXHAUSTED',
            quota: reservation.quota,
          });
        }

        downloadId = reservation.downloadId;
        historyId = reservation.historyId;
      }
    }

    // Helper to safely update lifecycle status
    const updateStatus = async (newStatus, reason = null) => {
      if (newStatus === 'COMPLETED') {
        await downloadQuotaService.recordDownloadCompletion(historyId, downloadId, fileSize, mimeType);
      } else if (newStatus === 'FAILED') {
        await downloadQuotaService.recordDownloadFailure(historyId, downloadId, reason);
      } else if (newStatus === 'CANCELLED') {
        try {
          if (downloadId) {
            await pool.query(`UPDATE downloads SET status = 'CANCELLED', updated_at = NOW() WHERE id = ?`, [downloadId]);
          }
          if (historyId) {
            await pool.query(`UPDATE download_history SET status = 'CANCELLED', updated_at = NOW() WHERE id = ?`, [historyId]);
          }
        } catch (err) {
          console.error('[DownloadService] Status update error:', err.message);
        }
      }
    };

    // 5. Secure attachment headers
    const headerSafeFilename = filename.replace(/["\r\n\\]/g, '');

    // 6. Handle HTTP Range Requests (STEP 12)
    if (rangeHeader) {
      if (
        isNaN(rangeStart) ||
        isNaN(rangeEnd) ||
        rangeStart < 0 ||
        rangeStart >= fileSize ||
        rangeEnd >= fileSize ||
        rangeStart > rangeEnd
      ) {
        return res.status(416).set({ 'Content-Range': `bytes */${fileSize}` }).send('Range Not Satisfiable');
      }

      const chunkSize = rangeEnd - rangeStart + 1;

      res.status(206).set({
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${headerSafeFilename}"`,
        'Content-Range': `bytes ${rangeStart}-${rangeEnd}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      });

      const chunkStream = fs.createReadStream(filePath, { start: rangeStart, end: rangeEnd });

      chunkStream.on('error', (err) => {
        console.error('[DownloadService] Stream chunk error:', err.message);
        updateStatus('FAILED', err.message);
        if (!res.headersSent) {
          res.status(500).end();
        }
      });

      res.on('finish', () => {
        updateStatus('COMPLETED');
      });

      res.on('close', () => {
        if (!res.writableEnded) {
          updateStatus('CANCELLED');
        }
      });

      return chunkStream.pipe(res);
    }

    // 7. Full File Download (HTTP 200)
    res.status(200).set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${headerSafeFilename}"`,
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    });

    const fullStream = fs.createReadStream(filePath);

    fullStream.on('error', (err) => {
      console.error('[DownloadService] Full stream error:', err.message);
      updateStatus('FAILED', err.message);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    res.on('finish', () => {
      updateStatus('COMPLETED');
    });

    res.on('close', () => {
      if (!res.writableEnded) {
        updateStatus('CANCELLED');
      }
    });

    return fullStream.pipe(res);
  }
}

module.exports = new DownloadService();
