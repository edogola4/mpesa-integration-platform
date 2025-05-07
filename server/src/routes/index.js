const express = require('express');
const authRoutes = require('./auth.routes');
const businessRoutes = require('./business.routes');
const transactionRoutes = require('./transaction.routes');
const webhookRoutes = require('./webhook.routes');

const router = express.Router();

/**
 * Health check route
 * @route GET /api/health
 * @group System - System operations
 * @returns {object} 200 - Success response
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/businesses', businessRoutes);
router.use('/transactions', transactionRoutes);
router.use('/webhooks', webhookRoutes);

module.exports = router;