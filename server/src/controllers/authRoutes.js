// server/src/routes/authRoutes.js

const express = require('express');
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/forgot-password', authController.forgotPassword);
router.patch('/reset-password/:token', authController.resetPassword);
router.post('/refresh-token', authController.refreshToken);
router.get('/logout', authController.logout);

// Protected routes (require authentication)
router.use(protect); // Apply auth middleware to all routes below

router.get('/me', authController.getMe);
router.patch('/update-me', authController.updateMe);
router.patch('/change-password', authController.changePassword);

// Two-factor authentication routes
router.post('/2fa/setup', authController.setupTwoFactor);
router.post('/2fa/verify-setup', authController.verifyTwoFactorSetup);
router.post('/2fa/verify', authController.verifyTwoFactor);
router.post('/2fa/disable', authController.disableTwoFactor);

module.exports = router;