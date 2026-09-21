const { pool } = require('../config/db');
const { deleteOldUpload } = require('../middleware/uploadMiddleware');
const { sanitizeText, sanitizeUrl } = require('../utils/sanitizer');

const URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;

/**
 * Get Public User Profile by ID
 * GET /api/users/:id
 */
const getPublicProfile = async (req, res, next) => {
  try {
    const userId = Number(req.params.id);

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.created_at,
              p.display_name, p.bio, p.avatar_url, p.banner_url, p.location, p.website,
              c.id AS channel_id, c.channel_name, c.handle AS channel_handle,
              c.subscriber_count, c.video_count, c.avatar_url AS channel_avatar_url
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       LEFT JOIN channels c ON u.id = c.user_id
       WHERE u.id = ? AND u.status = 'ACTIVE' LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const row = rows[0];

    return res.status(200).json({
      success: true,
      user: {
        id: row.id,
        username: row.username,
        display_name: row.display_name || row.username,
        bio: row.bio || '',
        avatar_url: row.avatar_url || null,
        banner_url: row.banner_url || null,
        location: row.location || '',
        website: row.website || '',
        created_at: row.created_at,
        channel: row.channel_id
          ? {
              id: row.channel_id,
              channel_name: row.channel_name,
              handle: row.channel_handle,
              subscriber_count: row.subscriber_count,
              video_count: row.video_count,
              avatar_url: row.channel_avatar_url || null,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Authenticated User's Profile
 * GET /api/users/me (Protected)
 */
const getCurrentUserProfile = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.email, u.role, u.status, u.created_at, u.updated_at,
              p.display_name, p.bio, p.avatar_url, p.banner_url, p.location, p.website,
              c.id AS channel_id, c.channel_name, c.handle AS channel_handle,
              c.subscriber_count, c.video_count
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       LEFT JOIN channels c ON u.id = c.user_id
       WHERE u.id = ? LIMIT 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const row = rows[0];

    return res.status(200).json({
      success: true,
      user: {
        id: row.id,
        username: row.username,
        email: row.email,
        role: row.role,
        status: row.status,
        display_name: row.display_name || row.username,
        bio: row.bio || '',
        avatar_url: row.avatar_url || null,
        banner_url: row.banner_url || null,
        location: row.location || '',
        website: row.website || '',
        created_at: row.created_at,
        updated_at: row.updated_at,
        channel: row.channel_id
          ? {
              id: row.channel_id,
              channel_name: row.channel_name,
              handle: row.channel_handle,
              subscriber_count: row.subscriber_count,
              video_count: row.video_count,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Current User's Profile Details
 * PUT /api/users/me (Protected)
 */
const updateProfile = async (req, res, next) => {
  try {
    const { display_name, bio, location, website } = req.body;

    // 1. Validation & Sanitization (Phase 30)
    let cleanDisplayName = null;
    if (display_name !== undefined) {
      cleanDisplayName = sanitizeText(display_name, 100);
      if (cleanDisplayName.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Display name must not exceed 100 characters',
        });
      }
    }

    let cleanBio = null;
    if (bio !== undefined) {
      cleanBio = sanitizeText(bio, 500);
      if (cleanBio.length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Bio must not exceed 500 characters',
        });
      }
    }

    let cleanLocation = null;
    if (location !== undefined) {
      cleanLocation = sanitizeText(location, 100);
      if (cleanLocation.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Location must not exceed 100 characters',
        });
      }
    }

    let cleanWebsite = null;
    if (website !== undefined) {
      const trimmedWebsite = String(website).trim();
      if (trimmedWebsite !== '') {
        if (trimmedWebsite.length > 255) {
          return res.status(400).json({
            success: false,
            message: 'Website URL must not exceed 255 characters',
          });
        }
        const safeUrl = sanitizeUrl(trimmedWebsite);
        if (!safeUrl || !URL_REGEX.test(safeUrl)) {
          return res.status(400).json({
            success: false,
            message: 'Please provide a valid website URL (e.g. https://example.com)',
          });
        }
        cleanWebsite = safeUrl;
      }
    }

    // 2. Fetch existing profile to retain unchanged values
    const [existing] = await pool.execute(
      'SELECT display_name, bio, location, website FROM user_profiles WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );

    if (existing.length === 0) {
      // If user profile record is missing, create it
      await pool.execute(
        `INSERT INTO user_profiles (user_id, display_name, bio, location, website)
         VALUES (?, ?, ?, ?, ?)`,
        [
          req.user.id,
          cleanDisplayName || req.user.username,
          cleanBio || null,
          cleanLocation || null,
          cleanWebsite || null,
        ]
      );
    } else {
      const current = existing[0];
      const updatedDisplayName = cleanDisplayName !== null ? cleanDisplayName : current.display_name;
      const updatedBio = cleanBio !== null ? cleanBio : current.bio;
      const updatedLocation = cleanLocation !== null ? cleanLocation : current.location;
      const updatedWebsite = cleanWebsite !== null ? cleanWebsite : current.website;

      await pool.execute(
        `UPDATE user_profiles
         SET display_name = ?, bio = ?, location = ?, website = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [updatedDisplayName, updatedBio, updatedLocation, updatedWebsite, req.user.id]
      );
    }

    // 3. Return updated full profile
    const [updatedRows] = await pool.execute(
      `SELECT u.id, u.username, u.email, u.role,
              p.display_name, p.bio, p.avatar_url, p.banner_url, p.location, p.website,
              p.updated_at
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE u.id = ? LIMIT 1`,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedRows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload User Avatar
 * POST /api/users/me/avatar (Protected)
 */
const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No avatar image was uploaded',
      });
    }

    const newAvatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Get old avatar to delete local file safely
    const [rows] = await pool.execute(
      'SELECT avatar_url FROM user_profiles WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );

    if (rows.length > 0 && rows[0].avatar_url) {
      deleteOldUpload(rows[0].avatar_url, 'avatars');
    }

    await pool.execute(
      `UPDATE user_profiles
       SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [newAvatarUrl, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatar_url: newAvatarUrl,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload User Profile Banner
 * POST /api/users/me/banner (Protected)
 */
const uploadBanner = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No banner image was uploaded',
      });
    }

    const newBannerUrl = `/uploads/banners/${req.file.filename}`;

    // Get old banner to delete local file safely
    const [rows] = await pool.execute(
      'SELECT banner_url FROM user_profiles WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );

    if (rows.length > 0 && rows[0].banner_url) {
      deleteOldUpload(rows[0].banner_url, 'banners');
    }

    await pool.execute(
      `UPDATE user_profiles
       SET banner_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [newBannerUrl, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Banner uploaded successfully',
      banner_url: newBannerUrl,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicProfile,
  getCurrentUserProfile,
  updateProfile,
  uploadAvatar,
  uploadBanner,
};
