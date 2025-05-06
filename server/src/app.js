const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const httpStatus = require('http-status');
const passport = require('passport');
const { jwtStrategy } = require('./config/passport');
const routes = require('./routes');
const { errorConverter, errorHandler } = require('./middleware/error');
const logger = require('./config/logger');

// Load environment variables
require('dotenv').config();

// Connect to MongoDB
require('./config/mongoose');

// Initialize Express app
const app = express();

// Set security HTTP headers
app.use(helmet());

// Parse JSON request body
app.use(express.json());

// Parse URL-encoded request body
app.use(express.urlencoded({ extended: true }));

// Sanitize request data to prevent XSS attacks
app.use(xss());

// Sanitize request data to prevent MongoDB operator injection
app.use(mongoSanitize());

// gzip compression
app.use(compression());

// Enable CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// JWT authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// API routes
app.use('/api', routes);

// Serve API documentation
if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', require('./config/swagger'));
}

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/build', 'index.html'));
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(httpStatus.OK).send({ status: 'ok' });
});

// 404 handler
app.use((req, res) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: 'Not Found',
    error: `${req.originalUrl} not found`
  });
});

// Convert errors to API response format
app.use(errorConverter);

// Handle errors
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

module.exports = app;