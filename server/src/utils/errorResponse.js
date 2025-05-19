/**
 * Enhanced Error Response Utility
 * 
 * A modernized and extensible error utility for creating standardized error objects
 * throughout the application with rich metadata, categorization, and formatting options.
 */

'use strict';

const httpStatus = require('http-status');

/**
 * ErrorResponse class
 * 
 * An enhanced error class that extends the native Error object with additional
 * properties and methods to standardize error handling across the application.
 */
class ErrorResponse extends Error {
  /**
   * Create a new ErrorResponse
   * 
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {Object} options - Additional error options
   * @param {string} [options.type] - Error type for categorization
   * @param {Object} [options.errors] - Validation errors object
   * @param {string} [options.code] - Error code (for integration with external systems)
   * @param {boolean} [options.isOperational=true] - Whether it's an operational error
   * @param {Object} [options.meta] - Additional error metadata
   */
  constructor(message, statusCode, options = {}) {
    super(message);

    // Standard properties
    this.name = this.constructor.name;
    this.statusCode = statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    this.message = message || httpStatus[this.statusCode];
    
    // Enhanced properties
    this.isOperational = options.isOperational !== undefined ? options.isOperational : true;
    this.type = options.type || this._inferErrorType(statusCode);
    this.errors = options.errors || {};
    this.code = options.code;
    this.meta = options.meta || {};
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Infer the error type based on status code
   * 
   * @private
   * @param {number} statusCode - HTTP status code
   * @returns {string} Inferred error type
   */
  _inferErrorType(statusCode) {
    const code = statusCode || this.statusCode;
    
    if (code >= 400 && code < 500) {
      return code === 401 ? 'authentication_error' : 
             code === 403 ? 'authorization_error' : 
             code === 404 ? 'not_found_error' : 
             code === 409 ? 'conflict_error' : 
             'client_error';
    } else if (code >= 500) {
      return 'server_error';
    }
    
    return 'unknown_error';
  }

  /**
   * Add metadata to the error
   * 
   * @param {string} key - Metadata key
   * @param {any} value - Metadata value
   * @returns {ErrorResponse} this instance for chaining
   */
  addMeta(key, value) {
    this.meta[key] = value;
    return this;
  }

  /**
   * Add multiple metadata properties
   * 
   * @param {Object} metaObject - Object containing metadata
   * @returns {ErrorResponse} this instance for chaining
   */
  withMeta(metaObject) {
    this.meta = { ...this.meta, ...metaObject };
    return this;
  }

  /**
   * Add field validation errors
   * 
   * @param {Object} errors - Validation errors object
   * @returns {ErrorResponse} this instance for chaining
   */
  withValidationErrors(errors) {
    this.errors = { ...this.errors, ...errors };
    this.type = 'validation_error';
    return this;
  }

  /**
   * Format the error for API response
   * 
   * @param {boolean} includeStack - Whether to include stack trace
   * @returns {Object} Formatted error response
   */
  toResponse(includeStack = false) {
    const response = {
      success: false,
      status: this.statusCode,
      message: this.message,
      type: this.type,
      timestamp: this.timestamp
    };

    // Only include non-empty properties
    if (Object.keys(this.errors).length > 0) {
      response.errors = this.errors;
    }

    if (this.code) {
      response.code = this.code;
    }

    if (Object.keys(this.meta).length > 0) {
      response.meta = this.meta;
    }

    if (includeStack) {
      response.stack = this.stack;
    }

    return response;
  }
}

/**
 * Pre-defined error types for application-wide consistency
 */
ErrorResponse.Types = {
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
 * Factory methods for common error responses
 */

/**
 * Create a Bad Request (400) error
 * 
 * @param {string} message - Error message
 * @param {Object} options - Additional options
 * @returns {ErrorResponse} The error response instance
 */
ErrorResponse.badRequest = (message = 'Bad Request', options = {}) => {
  return new ErrorResponse(message, httpStatus.BAD_REQUEST, options);
};

/**
 * Create an Unauthorized (401) error
 * 
 * @param {string} message - Error message
 * @param {Object} options - Additional options
 * @returns {ErrorResponse} The error response instance
 */
ErrorResponse.unauthorized = (message = 'Unauthorized', options = {}) => {
  return new ErrorResponse(message, httpStatus.UNAUTHORIZED, {
    type: ErrorResponse.Types.AUTHENTICATION,
    ...options
  });
};

/**
 * Create a Forbidden (403) error
 * 
 * @param {string} message - Error message
 * @param {Object} options - Additional options
 * @returns {ErrorResponse} The error response instance
 */
ErrorResponse.forbidden = (message = 'Forbidden', options = {}) => {
  return new ErrorResponse(message, httpStatus.FORBIDDEN, {
    type: ErrorResponse.Types.AUTHORIZATION,
    ...options
  });
};

/**
 * Create a Not Found (404) error
 * 
 * @param {string} message - Error message
 * @param {Object} options - Additional options
 * @returns {ErrorResponse} The error response instance
 */
ErrorResponse.notFound = (message = 'Resource not found', options = {}) => {
  return new ErrorResponse(message, httpStatus.NOT_FOUND, {
    type: ErrorResponse.Types.NOT_FOUND,
    ...options
  });
};

/**
 * Create a Conflict (409) error
 * 
 * @param {string} message - Error message
 * @param {Object} options - Additional options
 * @returns {ErrorResponse} The error response instance
 */
ErrorResponse.conflict = (message = 'Resource conflict', options = {}) => {
  return new ErrorResponse(message, httpStatus.CONFLICT, {
    type: ErrorResponse.Types.DUPLICATE,
    ...options
  });
};

/**
 * Create a Validation (400) error with field errors
 * 
 * @param {string} message - Error message
 * @param {Object} errors - Field validation errors
 * @param {Object} options - Additional options
 * @returns {ErrorResponse} The error response instance
 */
ErrorResponse.validation = (message = 'Validation error', errors = {}, options = {}) => {
  return new ErrorResponse(message, httpStatus.BAD_REQUEST, {
    type: ErrorResponse.Types.VALIDATION,
    errors,
    ...options
  });
};

/**
 * Create a Server Error (500) error
 * 
 * @param {string} message - Error message
 * @param {Object} options - Additional options
 * @returns {ErrorResponse} The error response instance
 */
ErrorResponse.serverError = (message = 'Internal Server Error', options = {}) => {
  return new ErrorResponse(message, httpStatus.INTERNAL_SERVER_ERROR, {
    isOperational: false,
    type: ErrorResponse.Types.SYSTEM,
    ...options
  });
};

/**
 * Create a Service Unavailable (503) error
 * 
 * @param {string} message - Error message
 * @param {Object} options - Additional options
 * @returns {ErrorResponse} The error response instance
 */
ErrorResponse.serviceUnavailable = (message = 'Service Unavailable', options = {}) => {
  return new ErrorResponse(message, httpStatus.SERVICE_UNAVAILABLE, {
    type: ErrorResponse.Types.SYSTEM,
    ...options
  });
};

/**
 * Create a Too Many Requests (429) error
 * 
 * @param {string} message - Error message
 * @param {Object} options - Additional options
 * @returns {ErrorResponse} The error response instance
 */
ErrorResponse.tooManyRequests = (message = 'Too Many Requests', options = {}) => {
  return new ErrorResponse(message, httpStatus.TOO_MANY_REQUESTS, {
    type: ErrorResponse.Types.RATE_LIMIT,
    ...options
  });
};

module.exports = ErrorResponse;