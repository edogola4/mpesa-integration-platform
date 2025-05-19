// server/src/middleware/error.js
/**
 * Enhanced Error Handling Middleware
 * Combines best practices from both implementations with modern error processing,
 * detailed logging, and security considerations.
 */

'use strict';

const httpStatus = require('http-status');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Custom API Error class with extended capabilities
 * Provides standardized error structure across the application
 */
class ApiError extends Error {
  /**
   * Create a new API error
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message
   * @param {Object} options - Additional error options
   * @param {boolean} [options.isOperational=true] - Is this an operational error
   * @param {string} [options.stack=''] - Error stack trace
   * @param {Object} [options.errors={}] - Validation errors object
   * @param {string} [options.type=''] - Error type for categorization
   */
  constructor(statusCode, message, options = {}) {
    super(message);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = options.isOperational !== undefined ? options.isOperational : true;
    this.errors = options.errors || {};
    this.type = options.type || this._inferErrorType(statusCode);
    this.code = options.code;
    
    if (options.stack) {
      this.stack = options.stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Infer error type from status code
   * @private
   * @param {number} statusCode - HTTP status code
   * @returns {string} Error type
   */
  _inferErrorType(statusCode) {
    if (statusCode >= 400 && statusCode < 500) {
      return 'client_error';
    } else if (statusCode >= 500) {
      return 'server_error';
    }
    return 'unknown_error';
  }
}

/**
 * Error types for specific business logic errors
 */
const ErrorTypes = {
  VALIDATION: 'validation_error',
  AUTHENTICATION: 'authentication_error',
  AUTHORIZATION: 'authorization_error',
  NOT_FOUND: 'not_found_error',
  DUPLICATE: 'duplicate_error',
  RATE_LIMIT: 'rate_limit_error',
  INTEGRATION: 'integration_error',
  BUSINESS_LOGIC: 'business_logic_error',
  DATABASE: 'database_error',
  NETWORK: 'network_error',
  SYSTEM: 'system_error'
};

/**
 * Convert various error types to standard ApiError
 * Handles Mongoose errors, validation errors, and other common types
 * 
 * @param {Error} err - The error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next function
 */
const errorConverter = (err, req, res, next) => {
  let error = err;
  let statusCode;
  let message;
  let errorType;
  let isOperational = true;
  let errors = {};

  // Extract request identifier for error correlation
  const requestId = req.headers['x-request-id'] || 'unknown';
  
  // Handle Mongoose validation errors
  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = 'Validation error';
    errorType = ErrorTypes.VALIDATION;
    errors = Object.keys(err.errors).reduce((acc, key) => {
      acc[key] = err.errors[key].message;
      return acc;
    }, {});
  }
  
  // Handle Mongoose CastError (Usually bad ObjectId)
  else if (err instanceof mongoose.Error.CastError) {
    statusCode = httpStatus.NOT_FOUND;
    message = `Resource not found. Invalid ${err.path}: ${err.value}`;
    errorType = ErrorTypes.NOT_FOUND;
  }
  
  // Handle Mongoose duplicate key errors (code 11000)
  else if (err.name === 'MongoError' && err.code === 11000) {
    statusCode = httpStatus.CONFLICT;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate value for ${field}`;
    errorType = ErrorTypes.DUPLICATE;
  }
  
  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = httpStatus.UNAUTHORIZED;
    message = 'Invalid token';
    errorType = ErrorTypes.AUTHENTICATION;
  }
  
  // Handle token expiration
  else if (err.name === 'TokenExpiredError') {
    statusCode = httpStatus.UNAUTHORIZED;
    message = 'Token expired';
    errorType = ErrorTypes.AUTHENTICATION;
  }
  
  // Handle missing JWT
  else if (err.name === 'MissingTokenError') {
    statusCode = httpStatus.UNAUTHORIZED;
    message = 'Authentication token required';
    errorType = ErrorTypes.AUTHENTICATION;
  }
  
  // Handle syntax errors
  else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = httpStatus.BAD_REQUEST;
    message = 'Invalid JSON payload';
    errorType = ErrorTypes.VALIDATION;
  }
  
  // Handle already ApiError instances
  else if (err instanceof ApiError) {
    return next(err);
  }
  
  // Handle other types of errors
  else {
    statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    message = err.message || httpStatus[statusCode];
    isOperational = false;
  }

  // Create standardized ApiError
  error = new ApiError(statusCode, message, {
    isOperational,
    stack: err.stack,
    errors,
    type: errorType,
    code: err.code
  });

  // Log non-operational errors (system errors) more explicitly
  if (!isOperational) {
    logger.error({
      message: 'Non-operational error occurred',
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack
      },
      requestId,
      path: req.path,
      method: req.method
    });
  }

  next(error);
};

/**
 * Handle 404 errors for undefined routes
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next function
 */
const notFound = (req, res, next) => {
  const error = new ApiError(
    httpStatus.NOT_FOUND, 
    `Resource not found - ${req.originalUrl}`,
    {
      type: ErrorTypes.NOT_FOUND
    }
  );
  next(error);
};

/**
 * Final error handler middleware
 * Formats and sends error response to client with appropriate details
 * 
 * @param {ApiError} err - The API error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  let { statusCode, message, errors, type } = err;
  
  // Extract request identifier for error correlation
  const requestId = req.headers['x-request-id'] || req.id || 'unknown';
  
  // Handle production environment security concerns
  // Don't expose internal error details in production
  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR];
    errors = {};
    type = ErrorTypes.SYSTEM;
  }

  // Prepare response object
  const response = {
    success: false,
    status: statusCode,
    message,
    ...(Object.keys(errors).length > 0 && { errors }),
    ...(type && { type }),
    ...(config.env === 'development' && { stack: err.stack }),
    requestId
  };

  // Log error with appropriate level based on status code
  if (statusCode >= 500) {
    logger.error({
      message: `[${requestId}] ${err.message}`,
      error: {
        name: err.name,
        statusCode,
        stack: err.stack
      },
      path: req.path,
      method: req.method,
      ip: req.ip,
      user: req.user ? req.user.id : 'unauthenticated'
    });
  } else if (statusCode >= 400 && config.env === 'development') {
    logger.warn({
      message: `[${requestId}] ${err.message}`,
      path: req.path,
      method: req.method
    });
  }

  res.status(statusCode).json(response);
};

/**
 * Create an error response factory
 * Provides a simple way to create consistent error responses
 */
const createError = (statusCode, message, options = {}) => {
  return new ApiError(statusCode, message, options);
};

// Export specific error builders for common error scenarios
const BadRequestError = (message, options = {}) => createError(httpStatus.BAD_REQUEST, message, options);
const UnauthorizedError = (message, options = {}) => createError(httpStatus.UNAUTHORIZED, message, options);
const ForbiddenError = (message, options = {}) => createError(httpStatus.FORBIDDEN, message, options);
const NotFoundError = (message, options = {}) => createError(httpStatus.NOT_FOUND, message, options);
const ConflictError = (message, options = {}) => createError(httpStatus.CONFLICT, message, options);
const ValidationError = (message, errors = {}) => createError(httpStatus.BAD_REQUEST, message, { type: ErrorTypes.VALIDATION, errors });
const ServerError = (message, options = {}) => createError(httpStatus.INTERNAL_SERVER_ERROR, message, { isOperational: false, ...options });

module.exports = {
  ApiError,
  ErrorTypes,
  errorConverter,
  errorHandler,
  notFound,
  createError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  ServerError
};