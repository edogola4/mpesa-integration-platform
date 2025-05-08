// server/src/config/logger.js

const winston = require('winston');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define log level based on environment
const level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

// Create Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || level,
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
    }),
  ],
});

// If we're in production, don't log to console
if (process.env.NODE_ENV === 'production') {
  logger.remove(
    logger.transports.find((transport) => transport instanceof winston.transports.Console)
  );
}

module.exports = logger;