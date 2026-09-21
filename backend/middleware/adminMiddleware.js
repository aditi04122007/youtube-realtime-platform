/**
 * Admin Role Verification Middleware
 * Requires authMiddleware to have executed first.
 */
const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }

  next();
};

module.exports = adminMiddleware;
