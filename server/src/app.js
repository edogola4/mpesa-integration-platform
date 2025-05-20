// server/src/app.js
/**
 * Main Application Server
 * Enhanced with modern JavaScript patterns, security features, and performance optimizations
 * for the M-Pesa Integration Platform
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
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');

// Custom modules
const connectDB = require('./utils/db');
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
 * Database Connection
 * Using an IIFE to handle async connection with proper error handling
 */
(async () => {
  try {
    await connectDB();
    logger.info('Database connection established successfully');
  } catch (error) {
    logger.error(`Database connection failed: ${error.message}`);
    // Don't exit immediately to allow logging to complete
    setTimeout(() => process.exit(1), 1000);
  }
})();

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

/**
 * Server Configuration
 */
const PORT = config.port || 3000;

// Create HTTP server with graceful shutdown capability
const server = app.listen(PORT, () => {
  logger.info(`M-Pesa Integration Platform server running in ${config.env || 'development'} mode on port ${PORT}`);
});

/**
 * Process Event Handlers
 */
// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  // Graceful shutdown
  gracefulShutdown();
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  // Graceful shutdown
  gracefulShutdown();
});

// Handle SIGTERM signal
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully');
  gracefulShutdown();
});

// Handle SIGINT signal (Ctrl+C)
process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully');
  gracefulShutdown();
});

/**
 * Graceful shutdown function
 * Ensure all connections are properly closed before exiting
 */
function gracefulShutdown() {
  logger.info('Starting graceful shutdown...');
  
  // Set a timeout to force shutdown if graceful shutdown takes too long
  const forceShutdownTimeout = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000); // 30 seconds
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Close database connection if available
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        logger.info('Database connection closed');
      }
      
      // Add any other cleanup tasks here
      
      // Clear the force shutdown timeout
      clearTimeout(forceShutdownTimeout);
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (err) {
      logger.error('Error during cleanup:', err);
      process.exit(1);
    }
  });
}

module.exports = app;