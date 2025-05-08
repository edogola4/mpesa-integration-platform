//server/utils.logger.js
const config = require('../config/config');

// Simple logger that changes behavior based on environment
const logger = {
  info: (message, ...args) => {
    if (config.nodeEnv !== 'test') {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },
  debug: (message, ...args) => {
    if (config.nodeEnv === 'development' && config.logLevel === 'debug') {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },
  warn: (message, ...args) => {
    if (config.nodeEnv !== 'test') {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },
  error: (message, ...args) => {
    if (config.nodeEnv !== 'test') {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }
};

module.exports = logger;