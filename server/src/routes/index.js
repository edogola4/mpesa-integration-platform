//server/src/routes/index.js

const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const businessRoutes = require('./business.routes');
const transactionRoutes = require('./transaction.routes');
const webhookRoutes = require('./webhook.routes');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../config/swagger');
const passport = require('passport');

// API Documentation
router.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/businesses', passport.authenticate('jwt', { session: false }), businessRoutes);
router.use('/transactions', transactionRoutes); // Some public, some protected (handled in controller)
router.use('/webhooks', webhookRoutes); // Public endpoints for callbacks

// 404 handler for API routes
router.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found'
  });
});

module.exports = router;