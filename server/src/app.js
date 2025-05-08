// server/src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const passport = require('./config/passport');
const routes = require('./routes');
const { errorHandler } = require('./middleware/error.middleware');
const logger = require('./config/logger');

// Initialize express app
const app = express();

// Set security HTTP headers
app.use(helmet());

// Enable CORS
app.use(cors());

// Parse JSON request body
app.use(express.json({ limit: '10kb' }));

// Parse URL-encoded request body
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Sanitize request data against NoSQL injection
app.use(mongoSanitize());

// Sanitize request data against XSS
app.use(xss());

// Compress responses
app.use(compression());

// HTTP request logger
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev', {
    stream: {
      write: (message) => logger.http(message.trim())
    }
  }));
}

// API rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests, please try again later'
  }
});
app.use('/api', limiter);

// Initialize Passport
app.use(passport.initialize());

// API routes
app.use('/api', routes);

// Error handler
app.use(errorHandler);

module.exports = app;