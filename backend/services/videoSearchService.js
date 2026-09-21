const { pool } = require('../config/db');

/**
 * Format video row into safe public payload (strictly omits private data)
 */
const formatVideoResponse = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description || '',
  video_url: row.video_url,
  thumbnail_url: row.thumbnail_url || null,
  duration_seconds: Number(row.duration_seconds) || 0,
  visibility: row.visibility,
  status: row.status,
  view_count: Number(row.view_count) || 0,
  like_count: Number(row.like_count) || 0,
  comment_count: Number(row.comment_count) || 0,
  file_size: Number(row.file_size) || 0,
  mime_type: row.mime_type || null,
  published_at: row.published_at || row.created_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
  category: row.category_name || null,
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
 * Perform catalog search with rich filtering, sorting, relevance ranking, and pagination
 */
const searchVideos = async (params = {}) => {
  const {
    q = '',
    category = '',
    tag = '',
    channel = '',
    sort = 'relevance',
    date = 'any',
    duration = 'any',
  } = params;

  // Pagination bounds
  const page = Math.max(1, parseInt(params.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(params.limit, 10) || 20));
  const offset = (page - 1) * limit;

  // Sanitize & normalize search query
  const cleanQ = typeof q === 'string' ? q.trim().replace(/\s+/g, ' ').slice(0, 200) : '';

  // Allowlists
  const ALLOWED_SORTS = ['relevance', 'newest', 'views', 'oldest'];
  const cleanSort = ALLOWED_SORTS.includes(String(sort).toLowerCase())
    ? String(sort).toLowerCase()
    : cleanQ ? 'relevance' : 'newest';

  const ALLOWED_DATES = ['any', 'today', 'week', 'month', 'year'];
  const cleanDate = ALLOWED_DATES.includes(String(date).toLowerCase())
    ? String(date).toLowerCase()
    : 'any';

  const ALLOWED_DURATIONS = ['any', 'short', 'medium', 'long'];
  const cleanDuration = ALLOWED_DURATIONS.includes(String(duration).toLowerCase())
    ? String(duration).toLowerCase()
    : 'any';

  const whereConditions = [
    "v.status = 'PUBLISHED'",
    "v.visibility = 'PUBLIC'",
  ];
  const queryParams = [];
  const joins = [
    'INNER JOIN channels c ON v.channel_id = c.id',
    'LEFT JOIN video_access_rules var ON v.id = var.video_id',
    'LEFT JOIN subscription_plans sp ON var.required_plan_id = sp.id',
  ];

  // 1. Keyword search filter & relevance scoring
  let selectRelevance = '0 AS relevance_score';
  if (cleanQ) {
    const likeExact = cleanQ;
    const likePrefix = `${cleanQ}%`;
    const likeWildcard = `%${cleanQ}%`;

    // Add match condition
    whereConditions.push(`(
      v.title LIKE ?
      OR v.description LIKE ?
      OR c.channel_name LIKE ?
      OR c.handle LIKE ?
      OR EXISTS (
        SELECT 1 FROM video_tags vt2
        JOIN tags t2 ON vt2.tag_id = t2.id
        WHERE vt2.video_id = v.id AND (t2.name LIKE ? OR t2.slug LIKE ?)
      )
    )`);

    queryParams.push(likeWildcard, likeWildcard, likeWildcard, likeWildcard, likeWildcard, likeWildcard);

    // Compute relevance score for sorting
    selectRelevance = `(
      CASE 
        WHEN v.title = ? THEN 150
        WHEN v.title LIKE ? THEN 100
        WHEN v.title LIKE ? THEN 80
        ELSE 0
      END +
      CASE 
        WHEN c.channel_name LIKE ? OR c.handle LIKE ? THEN 40
        ELSE 0
      END +
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM video_tags vt2
          JOIN tags t2 ON vt2.tag_id = t2.id
          WHERE vt2.video_id = v.id AND (t2.name LIKE ? OR t2.slug LIKE ?)
        ) THEN 50
        ELSE 0
      END +
      CASE 
        WHEN v.description LIKE ? THEN 20
        ELSE 0
      END
    ) AS relevance_score`;
  }

  // 2. Category Filter
  if (category && category !== 'All') {
    joins.push('INNER JOIN video_category_map vcm ON v.id = vcm.video_id');
    joins.push('INNER JOIN video_categories cat ON vcm.category_id = cat.id');
    whereConditions.push('(cat.name = ? OR cat.slug = ?)');
    queryParams.push(category, category);
  }

  // 3. Tag Filter
  if (tag) {
    joins.push('INNER JOIN video_tags vt_f ON v.id = vt_f.video_id');
    joins.push('INNER JOIN tags t_f ON vt_f.tag_id = t_f.id');
    whereConditions.push('(t_f.name = ? OR t_f.slug = ?)');
    queryParams.push(tag, tag);
  }

  // 4. Channel Filter
  if (channel) {
    const cleanChan = String(channel).replace(/^@/, '');
    const isNum = /^\d+$/.test(cleanChan);
    if (isNum) {
      whereConditions.push('(c.id = ? OR c.handle = ?)');
      queryParams.push(parseInt(cleanChan, 10), cleanChan);
    } else {
      whereConditions.push('c.handle = ?');
      queryParams.push(cleanChan);
    }
  }

  // 5. Date Filter
  if (cleanDate === 'today') {
    whereConditions.push('v.published_at >= NOW() - INTERVAL 1 DAY');
  } else if (cleanDate === 'week') {
    whereConditions.push('v.published_at >= NOW() - INTERVAL 7 DAY');
  } else if (cleanDate === 'month') {
    whereConditions.push('v.published_at >= NOW() - INTERVAL 30 DAY');
  } else if (cleanDate === 'year') {
    whereConditions.push('v.published_at >= NOW() - INTERVAL 365 DAY');
  }

  // 6. Duration Filter
  if (cleanDuration === 'short') {
    whereConditions.push('v.duration_seconds > 0 AND v.duration_seconds < 240'); // < 4 min
  } else if (cleanDuration === 'medium') {
    whereConditions.push('v.duration_seconds >= 240 AND v.duration_seconds <= 1200'); // 4 to 20 min
  } else if (cleanDuration === 'long') {
    whereConditions.push('v.duration_seconds > 1200'); // > 20 min
  }

  // 7. Sort Order
  let orderByClause = 'v.published_at DESC';
  if (cleanSort === 'relevance' && cleanQ) {
    orderByClause = 'relevance_score DESC, v.published_at DESC';
  } else if (cleanSort === 'newest') {
    orderByClause = 'v.published_at DESC';
  } else if (cleanSort === 'views') {
    orderByClause = 'v.view_count DESC, v.published_at DESC';
  } else if (cleanSort === 'oldest') {
    orderByClause = 'v.published_at ASC';
  }

  const whereSQL = whereConditions.join(' AND ');
  const joinsSQL = joins.join(' ');

  // Query 1: Count Total Matching
  const countSql = `SELECT COUNT(DISTINCT v.id) AS total FROM videos v ${joinsSQL} WHERE ${whereSQL}`;
  const [countRows] = await pool.query(countSql, queryParams);
  const total = countRows[0]?.total || 0;

  // Query 2: Fetch Page Items
  let selectParams = [];
  if (cleanQ) {
    const likeExact = cleanQ;
    const likePrefix = `${cleanQ}%`;
    const likeWildcard = `%${cleanQ}%`;
    // Add relevance params to SELECT
    selectParams.push(likeExact, likePrefix, likeWildcard, likeWildcard, likeWildcard, likeWildcard, likeWildcard, likeWildcard);
  }
  selectParams = selectParams.concat(queryParams);
  selectParams.push(limit, offset);

  const fetchSql = `
    SELECT 
      v.id, v.title, v.description, v.video_url, v.thumbnail_url,
      v.duration_seconds, v.visibility, v.status, v.view_count, v.like_count,
      v.comment_count, v.file_size, v.mime_type, v.published_at, v.created_at, v.updated_at,
      c.id AS channel_id, c.channel_name, c.handle AS channel_handle,
      c.avatar_url AS channel_avatar_url, c.subscriber_count AS channel_subscribers,
      (
        SELECT cat2.name 
        FROM video_category_map vcm2 
        JOIN video_categories cat2 ON vcm2.category_id = cat2.id 
        WHERE vcm2.video_id = v.id 
        LIMIT 1
      ) AS category_name,
      COALESCE(var.access_type, 'FREE') AS access_type,
      COALESCE(var.minimum_plan_code, sp.code, 'BRONZE') AS minimum_plan_code,
      sp.name AS minimum_plan_name,
      ${selectRelevance}
    FROM videos v
    ${joinsSQL}
    WHERE ${whereSQL}
    GROUP BY v.id
    ORDER BY ${orderByClause}
    LIMIT ? OFFSET ?
  `;

  const [videos] = await pool.query(fetchSql, selectParams);

  return {
    results: videos.map(formatVideoResponse),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Autocomplete suggestions for query input (titles, channel names, tags)
 */
const getSearchSuggestions = async (query = '') => {
  const cleanQ = typeof query === 'string' ? query.trim() : '';
  if (!cleanQ) return [];

  const wildcard = `%${cleanQ}%`;

  // 1. Video titles (most viewed first)
  const [titleRows] = await pool.query(
    `SELECT title, MAX(view_count) AS max_views 
     FROM videos 
     WHERE status = 'PUBLISHED' AND visibility = 'PUBLIC' AND title LIKE ? 
     GROUP BY title 
     ORDER BY max_views DESC 
     LIMIT 6`,
    [wildcard]
  );

  // 2. Channel names
  const [channelRows] = await pool.query(
    `SELECT channel_name, MAX(subscriber_count) AS max_subs 
     FROM channels 
     WHERE channel_name LIKE ? 
     GROUP BY channel_name 
     ORDER BY max_subs DESC 
     LIMIT 4`,
    [wildcard]
  );

  // 3. Tags
  let tagRows = [];
  try {
    const [tRows] = await pool.query(
      `SELECT name 
       FROM tags 
       WHERE name LIKE ? 
       ORDER BY name ASC 
       LIMIT 4`,
      [wildcard]
    );
    tagRows = tRows;
  } catch {
    // If tags query fails or table empty, continue gracefully
  }

  // Merge and deduplicate
  const suggestions = [];
  const seen = new Set();

  const addTerm = (term) => {
    if (!term) return;
    const lower = term.toLowerCase().trim();
    if (!seen.has(lower)) {
      seen.add(lower);
      suggestions.push(term.trim());
    }
  };

  titleRows.forEach((r) => addTerm(r.title));
  channelRows.forEach((r) => addTerm(r.channel_name));
  tagRows.forEach((r) => addTerm(r.name));

  return suggestions.slice(0, 10);
};

/**
 * Fetch related videos for a given video
 */
const getRelatedVideos = async (videoId, limit = 10) => {
  const targetId = parseInt(videoId, 10);
  if (isNaN(targetId)) return [];

  // Get target video info (category and channel)
  const [targetRows] = await pool.query(
    `SELECT v.id, v.channel_id,
            (SELECT category_id FROM video_category_map WHERE video_id = v.id LIMIT 1) AS category_id
     FROM videos v
     WHERE v.id = ? LIMIT 1`,
    [targetId]
  );

  if (targetRows.length === 0) return [];
  const target = targetRows[0];
  const targetCatId = target.category_id || 0;
  const targetChannelId = target.channel_id || 0;

  const [rows] = await pool.query(
    `SELECT 
       v.id, v.title, v.description, v.video_url, v.thumbnail_url,
       v.duration_seconds, v.visibility, v.status, v.view_count, v.like_count,
       v.comment_count, v.file_size, v.mime_type, v.published_at, v.created_at, v.updated_at,
       c.id AS channel_id, c.channel_name, c.handle AS channel_handle,
       c.avatar_url AS channel_avatar_url, c.subscriber_count AS channel_subscribers,
       (SELECT cat.name FROM video_category_map vcm JOIN video_categories cat ON vcm.category_id = cat.id WHERE vcm.video_id = v.id LIMIT 1) AS category_name,
       COALESCE(var.access_type, 'FREE') AS access_type,
       COALESCE(var.minimum_plan_code, sp.code, 'BRONZE') AS minimum_plan_code,
       sp.name AS minimum_plan_name
     FROM videos v
     INNER JOIN channels c ON v.channel_id = c.id
     LEFT JOIN video_access_rules var ON v.id = var.video_id
     LEFT JOIN subscription_plans sp ON var.required_plan_id = sp.id
     WHERE v.id != ? 
       AND v.status = 'PUBLISHED' 
       AND v.visibility = 'PUBLIC'
     ORDER BY 
       (CASE 
          WHEN v.channel_id = ? THEN 3 
          WHEN ? > 0 AND EXISTS (SELECT 1 FROM video_category_map WHERE video_id = v.id AND category_id = ?) THEN 2 
          ELSE 1 
        END) DESC,
       v.view_count DESC,
       v.created_at DESC
     LIMIT ?`,
    [targetId, targetChannelId, targetCatId, targetCatId, limit]
  );

  return rows.map(formatVideoResponse);
};

module.exports = {
  searchVideos,
  getSearchSuggestions,
  getRelatedVideos,
};
