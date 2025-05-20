/**
 * Request ID Middleware
 * Adds a unique request ID to each incoming request for better tracing and debugging
 */

'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Adds a unique request ID to each request
 * If X-Request-ID header is provided, uses that instead
 */
exports.requestIdMiddleware = (req, res, next) => {
  // Use provided request ID or generate a new one
  const requestId = req.headers['x-request-id'] || uuidv4();
  
  // Add to request object for use in other middleware and routes
  req.requestId = requestId;
  
  // Add to response headers
  res.setHeader('X-Request-ID', requestId);
  
  next();
};