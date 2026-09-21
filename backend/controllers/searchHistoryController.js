const { pool } = require('../config/db');

/**
 * GET /api/search-history
 * Protected: Fetch authenticated user's recent search queries
 */
const getSearchHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT id, query, created_at 
       FROM search_history 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [userId]
    );

    res.status(200).json({
      success: true,
      history: rows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/search-history
 * Protected: Save or touch search query in history
 */
const addSearchHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { query } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const cleanQuery = query.trim().slice(0, 200);

    // Delete recent duplicate to keep list deduplicated & fresh
    await pool.query(
      'DELETE FROM search_history WHERE user_id = ? AND query = ?',
      [userId, cleanQuery]
    );

    // Insert new history entry
    const [insertResult] = await pool.query(
      'INSERT INTO search_history (user_id, query) VALUES (?, ?)',
      [userId, cleanQuery]
    );

    // Trim history to maintain at most 20 items
    await pool.query(
      `DELETE FROM search_history 
       WHERE user_id = ? AND id NOT IN (
         SELECT id FROM (
           SELECT id FROM search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
         ) AS keeper
       )`,
      [userId, userId]
    );

    const historyItem = {
      id: insertResult.insertId,
      query: cleanQuery,
      created_at: new Date().toISOString(),
    };

    res.status(201).json({
      success: true,
      data: historyItem,
      historyItem,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/search-history/:id
 * Protected: Delete a specific history item
 */
const deleteSearchHistoryItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const historyId = parseInt(req.params.id, 10);

    if (isNaN(historyId)) {
      return res.status(400).json({ success: false, message: 'Invalid search history ID' });
    }

    const [delRes] = await pool.query(
      'DELETE FROM search_history WHERE id = ? AND user_id = ?',
      [historyId, userId]
    );

    if (delRes.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Search history entry not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Search history entry removed',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/search-history
 * Protected: Clear all search history for current user
 */
const clearSearchHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await pool.query('DELETE FROM search_history WHERE user_id = ?', [userId]);

    res.status(200).json({
      success: true,
      message: 'Search history cleared successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSearchHistory,
  addSearchHistory,
  deleteSearchHistoryItem,
  clearSearchHistory,
};
