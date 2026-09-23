const fs = require('fs');
const { pool } = require('../config/db');
const storageService = require('./storageService');
const videoAccessService = require('./videoAccessService');

/**
 * Service to handle secure, chunked HTTP Range video streaming
 * Follows RFC 7233 for 206 Partial Content and 416 Range Not Satisfiable
 */
class VideoStreamService {
  /**
   * Stream a video with HTTP Range request support
   *
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Function} next - Express next handler
   */
  async streamVideo(req, res, next) {
    try {
      const videoId = parseInt(req.params.id, 10);
      if (isNaN(videoId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid video ID',
        });
      }

      // 1. Authoritative access check (privacy, processing, premium tier gating)
      // Executed strictly BEFORE reading disk stats, setting headers, or streaming chunks
      const access = await videoAccessService.canUserAccessVideo(req.user, videoId);
      if (!access.canWatch) {
        return res.status(access.status || 403).json({
          success: false,
          message: access.message,
          code: access.code,
          requiresAuth: Boolean(access.requiresAuth),
          requiresSubscription: Boolean(access.requiresSubscription),
          minimumPlanCode: access.minimumPlanCode || null,
        });
      }

      // 2. Fetch video record from database for file streaming details
      const [rows] = await pool.query(
        `SELECT id, user_id, video_url, mime_type, file_size, visibility, status
         FROM videos
         WHERE id = ? AND status != 'DELETED'
         LIMIT 1`,
        [videoId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Video not found',
        });
      }

      // 3. Handle external/hosted video URLs (e.g. CDN, Cloud Storage)
      if (video.video_url && (video.video_url.startsWith('http://') || video.video_url.startsWith('https://'))) {
        return res.redirect(video.video_url);
      }

      // 4. Resolve file path safely and verify existence for local uploads
      const filePath = storageService.getAbsolutePath(video.video_url);
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'Video media file not found',
        });
      }

      // 4. Inspect file stats
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch (statErr) {
        return res.status(500).json({
          success: false,
          message: 'Unable to access video media file',
        });
      }

      const fileSize = stat.size;
      const mimeType = video.mime_type || 'video/mp4';
      const rangeHeader = req.headers.range;

      // 5. Determine Cache-Control based on visibility
      const cacheControl =
        video.visibility === 'PUBLIC'
          ? 'public, max-age=86400, stale-while-revalidate=604800'
          : 'private, no-cache, no-store, must-revalidate';

      // 6. Handle Range Request (HTTP 206 / 416)
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const rawStart = parts[0].trim();
        const rawEnd = parts[1] ? parts[1].trim() : '';

        let start;
        let end;

        // Case A: Suffix byte range (e.g. bytes=-500)
        if (rawStart === '' && rawEnd !== '') {
          const suffixLength = parseInt(rawEnd, 10);
          if (isNaN(suffixLength) || suffixLength <= 0) {
            return res.status(416).set({
              'Content-Range': `bytes */${fileSize}`,
            }).send('Requested Range Not Satisfiable');
          }
          start = Math.max(0, fileSize - suffixLength);
          end = fileSize - 1;
        }
        // Case B: Standard range (e.g. bytes=0-1024 or bytes=1024-)
        else {
          start = parseInt(rawStart, 10);
          end = rawEnd !== '' ? parseInt(rawEnd, 10) : fileSize - 1;
        }

        // Validate range bounds
        if (
          isNaN(start) ||
          isNaN(end) ||
          start < 0 ||
          start >= fileSize ||
          end >= fileSize ||
          start > end
        ) {
          return res.status(416).set({
            'Content-Range': `bytes */${fileSize}`,
          }).send('Requested Range Not Satisfiable');
        }

        const chunkSize = end - start + 1;

        res.status(206).set({
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mimeType,
          'Cache-Control': cacheControl,
        });

        // Memory-safe stream chunk
        const stream = fs.createReadStream(filePath, { start, end });
        stream.on('error', (streamErr) => {
          console.error('[VideoStreamService] Stream error:', streamErr.message);
          if (!res.headersSent) {
            res.status(500).end();
          }
        });
        return stream.pipe(res);
      }

      // 7. Handle Full Video Request (HTTP 200)
      res.status(200).set({
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': cacheControl,
      });

      const fullStream = fs.createReadStream(filePath);
      fullStream.on('error', (streamErr) => {
        console.error('[VideoStreamService] Full stream error:', streamErr.message);
        if (!res.headersSent) {
          res.status(500).end();
        }
      });
      return fullStream.pipe(res);
    } catch (error) {
      console.error('[VideoStreamService] Unexpected streaming error:', error);
      next(error);
    }
  }
}

module.exports = new VideoStreamService();
