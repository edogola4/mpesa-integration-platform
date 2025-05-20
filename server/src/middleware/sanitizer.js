/**
 * Input Sanitization Middleware
 * Sanitizes request body, query and params to prevent XSS attacks
 */

'use strict';

const xss = require('xss');

/**
 * Recursively sanitize an object's string values
 * @param {Object} obj - The object to sanitize
 * @returns {Object} - The sanitized object
 */
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  // Handle objects
  const result = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        // Sanitize string values
        result[key] = xss(value);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize objects
        result[key] = sanitizeObject(value);
      } else {
        // Pass through other types (numbers, booleans, etc.)
        result[key] = value;
      }
    }
  }
  
  return result;
};

/**
 * Middleware to sanitize request inputs
 */
exports.sanitizeInput = (req, res, next) => {
  // Skip sanitization for specific routes if needed
  if (req.originalUrl.includes('/webhooks')) {
    // Skip sanitization for webhooks as they may contain signatures
    return next();
  }

  // Sanitize body if present
  if (req.body && Object.keys(req.body).length) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query params if present
  if (req.query && Object.keys(req.query).length) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize route params if present
  if (req.params && Object.keys(req.params).length) {
    req.params = sanitizeObject(req.params);
  }

  next();
};