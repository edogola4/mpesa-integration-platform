// server/src/app.js
/**
 * Main Application Setup
 * Configures the Express application without starting the server
 */

'use strict';

// Core dependencies
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { v4: uuidv4 } = require('uuid');

// Custom modules
const config = require('./config');
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const { validateRequest } = require('./middleware/validator');

// Import routes
const authRoutes = require('./routes/auth.routes');
const businessRoutes = require('./routes/business.routes');
const transactionRoutes = require('./routes/transaction.routes');
const webhookRoutes = require('./routes/webhook.routes');
const apiKeyRoutes = require('./routes/apiKey.routes');
const integrationRoutes = require('./routes/integration.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const userRoutes = require('./routes/user.routes');

// Initialize Express app
const app = express();

/**
 * Simple Request ID middleware
 * Adds a unique request ID to each request for better tracing
 */
const requestIdMiddleware = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

/**
 * Security Middleware Configuration
 */
// Add unique request ID to each request for better tracing
app.use(requestIdMiddleware);

// Set security HTTP headers with custom configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 15552000, // 180 days
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration with more specific options
app.use(cors({
  origin: config.corsOrigin || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
  exposedHeaders: ['X-Rate-Limit-Remaining', 'X-Rate-Limit-Reset', 'X-Request-ID'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Enable compression for all routes
app.use(compression({
  level: 6, // balanced compression level
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Compress everything except images or already compressed content
    return compression.filter(req, res);
  }
}));

// Request logging
app.use(morgan(config.env === 'development' ? 'dev' : 'combined', {
  skip: (req, res) => config.env === 'production' && res.statusCode < 400,
  stream: { write: message => logger.http(message.trim()) }
}));

// Body parsers with size limits for security
app.use(express.json({ 
  limit: '10kb',
  strict: true // only accept arrays and objects
}));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Trust proxy settings if behind a reverse proxy
if (config.behindProxy) {
  app.set('trust proxy', 1);
}

/**
 * API Routes Configuration
 */
// API version prefix
const API_VERSION = '/api/v1';

// Apply rate limiting to all API routes
app.use(API_VERSION, apiLimiter);

// API routes with versioning
app.use(`${API_VERSION}/auth`, authLimiter, authRoutes);
app.use(`${API_VERSION}/users`, validateRequest, userRoutes);
app.use(`${API_VERSION}/businesses`, validateRequest, businessRoutes);
app.use(`${API_VERSION}/transactions`, validateRequest, transactionRoutes);
app.use(`${API_VERSION}/webhooks`, webhookRoutes);
app.use(`${API_VERSION}/analytics`, validateRequest, analyticsRoutes);

// Nested routes with cleaner URL patterns
app.use(`${API_VERSION}/businesses/:businessId/api-keys`, validateRequest, apiKeyRoutes);
app.use(`${API_VERSION}/businesses/:businessId/integrations`, validateRequest, integrationRoutes);

// API documentation route (using Swagger/OpenAPI)
app.use(`${API_VERSION}/docs`, express.static(path.join(__dirname, '../docs/api')));

// Health check endpoint with expanded system information
app.get('/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    version: config.version || '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.env || 'development',
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
    }
  });
});

// Root route with API information
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'M-Pesa Integration Platform',
    description: 'Modern payment processing and integration API for M-Pesa services across East Africa',
    version: config.version || '1.0.0',
    documentation: `${req.protocol}://${req.get('host')}${API_VERSION}/docs`,
    status: 'running'
  });
});

/**
 * Error Handling
 */
// Handle 404 routes
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;