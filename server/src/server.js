/**
 * Server Entry Point
 * Responsible for database connection, starting the server, and handling process events
 */

'use strict';

const mongoose = require('mongoose');
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

/**
 * Connect to MongoDB
 */
const connectDB = async () => {
  try {
    const mongoOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: config.env !== 'production', // Don't build indexes in production
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      family: 4 // Use IPv4, skip trying IPv6
    };

    await mongoose.connect(config.mongodbUri, mongoOptions);
    logger.info('Connected to MongoDB successfully');
  } catch (err) {
    logger.error(`MongoDB connection error: ${err.message}`);
    // Exit with failure
    process.exit(1);
  }
};

// Initialize database connection
connectDB();

/**
 * Start HTTP Server
 */
const PORT = config.port || 3000;
const server = app.listen(PORT, () => {
  logger.info(`M-Pesa Integration Platform server running in ${config.env || 'development'} mode on port ${PORT}`);
  logger.info(`API Documentation: http://localhost:${PORT}/api/v1/docs`);
});

/**
 * Graceful shutdown function
 * Ensure all connections are properly closed before exiting
 */
const gracefulShutdown = async (signal, exitCode = 0) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  // Set a timeout to force shutdown if graceful shutdown takes too long
  const forceShutdownTimeout = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000); // 30 seconds

  try {
    // Close HTTP server first
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) {
          logger.error(`Error closing server: ${err.message}`);
          reject(err);
        } else {
          logger.info('HTTP server closed successfully');
          resolve();
        }
      });
    });
    
    // Close database connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info('Database connection closed successfully');
    }
    
    // Clear the force shutdown timeout
    clearTimeout(forceShutdownTimeout);
    
    logger.info('Graceful shutdown completed');
    process.exit(exitCode);
  } catch (err) {
    logger.error(`Error during shutdown: ${err.message}`);
    process.exit(1);
  }
};

/**
 * Process Event Handlers
 */

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`UNCAUGHT EXCEPTION: ${err.name}: ${err.message}`);
  logger.error(err.stack);
  gracefulShutdown('Uncaught Exception', 1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`UNHANDLED REJECTION: ${err.name}: ${err.message}`);
  logger.error(err.stack);
  gracefulShutdown('Unhandled Rejection', 1);
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});

module.exports = server; // Export for testing purposes