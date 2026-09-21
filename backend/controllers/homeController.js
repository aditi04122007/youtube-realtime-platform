const { pool } = require('../config/db');

/**
 * Format a raw database video row into a clean, safe public video payload.
 * Strictly avoids exposing user passwords, emails, IPs, or device data.
 */
const formatVideo = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description || '',
  thumbnail_url: row.thumbnail_url || null,
  video_url: row.video_url,
  duration_seconds: Number(row.duration_seconds) || 0,
  view_count: Number(row.view_count) || 0,
  like_count: Number(row.like_count) || 0,
  comment_count: Number(row.comment_count) || 0,
  published_at: row.published_at || row.created_at,
  created_at: row.created_at,
  category: row.category_name || 'General',
  access: {
    type: row.access_type || 'FREE',
    is_premium: (row.access_type || 'FREE') === 'PREMIUM',
    minimum_plan_code: row.minimum_plan_code || (row.access_type === 'PREMIUM' ? 'BRONZE' : null),
    minimum_plan_name: row.minimum_plan_name || (row.access_type === 'PREMIUM' ? 'Bronze' : null),
  },
  is_premium: (row.access_type || 'FREE') === 'PREMIUM',
  minimum_plan_code: row.minimum_plan_code || (row.access_type === 'PREMIUM' ? 'BRONZE' : null),
  channel: {
    id: row.channel_id,
    channel_name: row.channel_name,
    handle: row.channel_handle,
    avatar_url: row.channel_avatar_url || null,
    subscriber_count: Number(row.channel_subscribers) || 0,
  },
});

/**
 * GET /api/home
 * GET /api/home/feed
 *
 * Public read-only feed for the YouTube-style homepage.
 * Supports:
 *   - ?category=<name_or_slug>
 *   - ?page=1
 *   - ?limit=12 (max 50)
 */
const getHomeFeed = async (req, res, next) => {
  try {
    const { category } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const offset = (page - 1) * limit;

    // 1. Fetch standard categories for the header chips
    const [categories] = await pool.query(
      'SELECT id, name, slug, description FROM video_categories ORDER BY id ASC'
    );

    // 2. If a specific category filter is applied (and not 'all')
    if (category && category.trim().toLowerCase() !== 'all') {
      const categoryParam = category.trim();

      // Check if category exists
      const [matchedCat] = await pool.query(
        'SELECT id, name, slug FROM video_categories WHERE LOWER(slug) = LOWER(?) OR LOWER(name) = LOWER(?) LIMIT 1',
        [categoryParam, categoryParam]
      );

      if (matchedCat.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            videos: [],
            category: { name: categoryParam, slug: '' },
            categories,
          },
          pagination: {
            page,
            limit,
            total: 0,
            hasMore: false,
          },
        });
      }

      const catId = matchedCat[0].id;

      // Count total matching videos
      const [countResult] = await pool.query(
        `SELECT COUNT(DISTINCT v.id) AS total
         FROM videos v
         INNER JOIN video_category_map vcm ON v.id = vcm.video_id
         WHERE v.status IN ('READY', 'PUBLISHED')
           AND v.visibility = 'PUBLIC'
           AND vcm.category_id = ?`,
        [catId]
      );
      const total = countResult[0]?.total || 0;

      // Query paginated videos for category
      const [categoryVideos] = await pool.query(
        `SELECT 
           v.id, v.title, v.description, v.thumbnail_url, v.video_url,
           v.duration_seconds, v.view_count, v.like_count, v.comment_count,
           v.published_at, v.created_at,
           c.id AS channel_id, c.channel_name, c.handle AS channel_handle,
           c.avatar_url AS channel_avatar_url, c.subscriber_count AS channel_subscribers,
           cat.name AS category_name,
           COALESCE(var.access_type, 'FREE') AS access_type,
           COALESCE(var.minimum_plan_code, sp.code, 'BRONZE') AS minimum_plan_code,
           sp.name AS minimum_plan_name
         FROM videos v
         INNER JOIN channels c ON v.channel_id = c.id
         INNER JOIN video_category_map vcm ON v.id = vcm.video_id
         INNER JOIN video_categories cat ON vcm.category_id = cat.id
         LEFT JOIN video_access_rules var ON v.id = var.video_id
         LEFT JOIN subscription_plans sp ON var.required_plan_id = sp.id
         WHERE v.status IN ('READY', 'PUBLISHED')
           AND v.visibility = 'PUBLIC'
           AND vcm.category_id = ?
         ORDER BY v.published_at DESC
         LIMIT ? OFFSET ?`,
        [catId, limit, offset]
      );

      return res.status(200).json({
        success: true,
        data: {
          videos: categoryVideos.map(formatVideo),
          category: matchedCat[0],
          categories,
        },
        pagination: {
          page,
          limit,
          total,
          hasMore: offset + categoryVideos.length < total,
        },
      });
    }

    // 3. Default "All" View: Return structured sections (Recommended, Trending, Latest)
    const baseSelect = `
      SELECT 
        v.id, v.title, v.description, v.thumbnail_url, v.video_url,
        v.duration_seconds, v.view_count, v.like_count, v.comment_count,
        v.published_at, v.created_at,
        c.id AS channel_id, c.channel_name, c.handle AS channel_handle,
        c.avatar_url AS channel_avatar_url, c.subscriber_count AS channel_subscribers,
        (SELECT cat.name 
         FROM video_category_map vcm 
         JOIN video_categories cat ON vcm.category_id = cat.id 
         WHERE vcm.video_id = v.id 
         LIMIT 1) AS category_name,
        COALESCE(var.access_type, 'FREE') AS access_type,
        COALESCE(var.minimum_plan_code, sp.code, 'BRONZE') AS minimum_plan_code,
        sp.name AS minimum_plan_name
      FROM videos v
      INNER JOIN channels c ON v.channel_id = c.id
      LEFT JOIN video_access_rules var ON v.id = var.video_id
      LEFT JOIN subscription_plans sp ON var.required_plan_id = sp.id
      WHERE v.status IN ('READY', 'PUBLISHED') AND v.visibility = 'PUBLIC'
    `;

    // Recommended: Combination of views, likes, and published recency
    const [recommendedRows] = await pool.query(
      `${baseSelect}
       ORDER BY (v.view_count * 0.7 + v.like_count * 2) DESC, v.published_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Trending: Ranked predominantly by view velocity and views
    const [trendingRows] = await pool.query(
      `${baseSelect}
       ORDER BY v.view_count DESC, v.published_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Latest: Strictly reverse chronological published date
    const [latestRows] = await pool.query(
      `${baseSelect}
       ORDER BY v.published_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Total count for pagination metadata
    const [totalCountResult] = await pool.query(
      `SELECT COUNT(*) AS total FROM videos WHERE status IN ('READY', 'PUBLISHED') AND visibility = 'PUBLIC'`
    );
    const total = totalCountResult[0]?.total || 0;

    return res.status(200).json({
      success: true,
      data: {
        recommended: recommendedRows.map(formatVideo),
        trending: trendingRows.map(formatVideo),
        latest: latestRows.map(formatVideo),
        categories,
      },
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + recommendedRows.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/home/categories
 * Public endpoint to fetch all available video categories.
 */
const getCategories = async (req, res, next) => {
  try {
    const [categories] = await pool.query(
      'SELECT id, name, slug, description FROM video_categories ORDER BY id ASC'
    );
    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHomeFeed,
  getCategories,
};
