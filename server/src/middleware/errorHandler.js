//server/src/middleware/errorHandler.js
const AppError = require('../utils/appError');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Handle MongoDB duplicate key errors
 * @param {Error} err - The error object
 * @returns {AppError} - Formatted error
 */
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `Duplicate value: ${value} for field ${field}. Please use another value.`;
  return new AppError(message, 400);
};

/**
 * Handle MongoDB validation errors
 * @param {Error} err - The error object
 * @returns {AppError} - Formatted error
 */
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map(error => error.message);
  const message = `Invalid input data: ${errors.join(', ')}`;
  return new AppError(message, 400, errors);
};

/**
 * Handle JWT errors
 * @param {Error} err - The error object
 * @returns {AppError} - Formatted error
 */
const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401);

/**
 * Handle JWT expired error
 * @returns {AppError} - Formatted error
 */
const handleJWTExpiredError = () => new AppError('Your token has expired. Please log in again.', 401);

/**
 * Handle errors in development environment
 * @param {Error} err - The error object
 * @param {object} res - Express response object
 */
const sendErrorDev = (err, res) => {
  logger.error(`ERROR 💥: ${err}`);
  const response = ApiResponse.error(
    err.message,
    err.statusCode || 500,
    {
      stack: err.stack,
      errors: err.errors
    }
  );
  res.status(err.statusCode || 500).json(response);
};

/**
 * Handle errors in production environment
 * @param {Error} err - The error object
 * @param {object} res - Express response object
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const response = ApiResponse.error(
      err.message,
      err.statusCode,
      err.errors
    );
    return res.status(err.statusCode).json(response);
  }
  
  // Programming or other unknown error: don't leak error details
  logger.error('ERROR 💥', err);
  const response = ApiResponse.error(
    'Something went wrong',
    500
  );
  return res.status(500).json(response);
};

/**
 * Global error handler middleware
 */
exports.errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  
  if (config.nodeEnv === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;
    
    // Handle specific error types
    if (err.code === 11000) error = handleDuplicateKeyError(err);
    if (err.name === 'ValidationError') error = handleValidationError(err);
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
    
    sendErrorProd(error, res);
  }
};