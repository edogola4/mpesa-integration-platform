// server/src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');
const config = require('./config/config');

// Import routes
const authRoutes = require('./routes/auth.routes');
const businessRoutes = require('./routes/business.routes');
const transactionRoutes = require('./routes/transaction.routes');
const webhookRoutes = require('./routes/webhook.routes');
const apiKeyRoutes = require('./routes/apiKey.routes');
const integrationRoutes = require('./routes/integration.routes');
const authRoutes = require('./routes/authRoutes');

// Initialize Express app
const app = express();

// Middleware
app.use(helmet()); // Set security HTTP headers
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined')); // HTTP request logger
app.use(cors({
  origin: config.corsOrigin,
  optionsSuccessStatus: 200,
}));
app.use(express.json()); // Parse JSON request body
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request body

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/businesses/:businessId/api-keys', apiKeyRoutes);
app.use('/api/businesses/:businessId/integrations', integrationRoutes);

// API documentation route (we'll implement this later)
app.use('/api/docs', express.static('docs/api'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;