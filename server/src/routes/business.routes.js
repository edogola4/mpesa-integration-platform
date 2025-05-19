// server/src/routes/business.routes.js

const express = require('express');
const router = express.Router();
const { validateRequest } = require('../middleware/validator');

// Placeholder controller & rules
// const businessController = require('../controllers/business.controller');
const businessValidation = {
  create: [],
  update: [],
  getById: []
};

/**
 * @swagger
 * tags:
 *   name: Business
 *   description: Business management endpoints
 */

// GET all
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Get all businesses endpoint - Not implemented yet',
    data: []
  });
});

// GET by ID
router.get(
  '/:id',
  validateRequest(businessValidation.getById),
  (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'Get business by ID endpoint - Not implemented yet',
      data: { id: req.params.id, name: 'Sample Business', createdAt: new Date() }
    });
  }
);

// CREATE
router.post(
  '/',
  validateRequest(businessValidation.create),
  (req, res) => {
    res.status(201).json({
      status: 'success',
      message: 'Create business endpoint - Not implemented yet',
      data: {
        id: 'sample-id',
        name: req.body.name || 'New Business',
        createdAt: new Date()
      }
    });
  }
);

// UPDATE
router.put(
  '/:id',
  validateRequest(businessValidation.update),
  (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'Update business endpoint - Not implemented yet',
      data: {
        id: req.params.id,
        name: req.body.name || 'Updated Business',
        updatedAt: new Date()
      }
    });
  }
);

// DELETE
router.delete('/:id', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Delete business endpoint - Not implemented yet'
  });
});

module.exports = router;
