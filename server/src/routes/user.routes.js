const express = require('express');
const router  = express.Router();
const { validateRequest } = require('../middleware/validator');
const { body }            = require('express-validator');
const userController      = require('../controllers/user.controller');

// Define your validation chains
const userValidation = {
  create: [
    body('email').isEmail().withMessage('Must be a valid email'),
    body('password').isLength({ min: 8 }).withMessage('Password too short'),
  ],
  update: [
    body('firstName').optional().isString(),
    body('lastName').optional().isString(),
  ],
};

// Routes
router.get(
  '/',
  (req, res) => res.json({ message: 'List users – not implemented yet' })
);

router.post(
  '/',
  validateRequest(userValidation.create),
  userController.createUser
);

router.put(
  '/:id',
  validateRequest(userValidation.update),
  userController.updateUser
);

router.get(
  '/:id',
  (req, res) => res.json({ message: `Get user ${req.params.id} – not implemented yet` })
);

router.delete(
  '/:id',
  (req, res) => res.json({ message: `Delete user ${req.params.id} – not implemented yet` })
);

module.exports = router;
