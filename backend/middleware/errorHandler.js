/**
 * Centralized Application Error Handling Middleware
 * Ensures consistent JSON error responses across the API.
 */
const errorHandler = (err, req, res, next) => {
  // Determine appropriate HTTP status code
  let statusCode = err.status || err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);

  // Handle malformed JSON body errors from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    return res.status(statusCode).json({
      success: false,
      message: 'Malformed JSON payload provided',
    });
  }

  // Handle custom validation or input errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
  }

  // Log error in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[API Error] ${req.method} ${req.originalUrl} - ${err.message}`);
  }

  // In production, mask internal server error details to prevent information leakage
  const isProduction = process.env.NODE_ENV === 'production';
  let clientMessage = err.message || 'Internal Server Error';

  if (isProduction && statusCode >= 500) {
    clientMessage = 'Something went wrong. Please try again.';
  }

  res.status(statusCode).json({
    success: false,
    message: clientMessage,
    ...(!isProduction && {
      stack: err.stack,
      ...(err.code && { code: err.code }),
    }),
  });
};

module.exports = errorHandler;
