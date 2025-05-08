// server/src/utils/appError.js
/**
 * Custom error class for application-specific errors
 * Extends the built-in Error class
 */
class AppError extends Error {
    /**
     * @param {string} message - Error message
     * @param {number} statusCode - HTTP status code
     * @param {object|null} errors - Additional error details
     */
    constructor(message, statusCode, errors = null) {
      super(message);
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = true; // Flag to identify operational errors
      this.errors = errors;
  
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  module.exports = AppError;