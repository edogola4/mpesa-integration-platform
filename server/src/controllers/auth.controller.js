//server/src/controllers/authController.js
const User = require('../models/user.model');
const Token = require('../models/token.model'); // We'll create this model in the next step
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const logger = require('../config/logger');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email.service'); // We'll create this service in a later step

/**
 * Register a new user
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, company, phone } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        status: 'error',
        message: 'Email already registered'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      company,
      phone
    });

    await user.save();

    // Generate verification token
    const verificationToken = new Token({
      userId: user._id,
      token: crypto.randomBytes(32).toString('hex'),
      type: 'email-verification',
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });

    await verificationToken.save();

    // Send verification email
    await sendVerificationEmail(user.email, verificationToken.token);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully. Please check your email for verification.',
      data: {
        userId: user._id
      }
    });
  } catch (error) {
    logger.error('Error in user registration:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during registration'
    });
  }
};

/**
 * User login
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({
        status: 'error',
        message: 'Please verify your email before logging in'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Handle 2FA if enabled
    if (user.twoFactorEnabled) {
      // Generate temporary token for 2FA verification
      const tempToken = jwt.sign(
        { id: user._id, require2FA: true },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      return res.status(200).json({
        status: 'success',
        message: '2FA verification required',
        require2FA: true,
        tempToken
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      }
    });
  } catch (error) {
    logger.error('Error in user login:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during login'
    });
  }
};

/**
 * Verify email
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    // Find token in database
    const verificationToken = await Token.findOne({
      token,
      type: 'email-verification',
      expiresAt: { $gt: Date.now() }
    });

    if (!verificationToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired verification token'
      });
    }

    // Find and update user
    const user = await User.findById(verificationToken.userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Mark user as verified
    user.isVerified = true;
    await user.save();

    // Delete token
    await Token.deleteOne({ _id: verificationToken._id });

    res.status(200).json({
      status: 'success',
      message: 'Email verified successfully'
    });
  } catch (error) {
    logger.error('Error in email verification:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during verification'
    });
  }
};

/**
 * Request password reset
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User with this email does not exist'
      });
    }

    // Delete any existing reset tokens for this user
    await Token.deleteMany({
      userId: user._id,
      type: 'password-reset'
    });

    // Generate reset token
    const resetToken = new Token({
      userId: user._id,
      token: crypto.randomBytes(32).toString('hex'),
      type: 'password-reset',
      expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour
    });

    await resetToken.save();

    // Send password reset email
    await sendPasswordResetEmail(user.email, resetToken.token);

    res.status(200).json({
      status: 'success',
      message: 'Password reset link sent to your email'
    });
  } catch (error) {
    logger.error('Error in forgot password:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during password reset request'
    });
  }
};

/**
 * Reset password with token
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Find token in database
    const resetToken = await Token.findOne({
      token,
      type: 'password-reset',
      expiresAt: { $gt: Date.now() }
    });

    if (!resetToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired reset token'
      });
    }

    // Find user
    const user = await User.findById(resetToken.userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Update password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    // Delete token
    await Token.deleteOne({ _id: resetToken._id });

    res.status(200).json({
      status: 'success',
      message: 'Password reset successful'
    });
  } catch (error) {
    logger.error('Error in reset password:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during password reset'
    });
  }
};

/**
 * Get user profile
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (error) {
    logger.error('Error in get profile:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while fetching profile'
    });
  }
};

/**
 * Update user profile
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, company, phone } = req.body;

    // Find user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (company) user.company = company;
    if (phone) user.phone = phone;

    user.updatedAt = Date.now();
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          company: user.company,
          phone: user.phone,
          role: user.role
        }
      }
    });
  } catch (error) {
    logger.error('Error in update profile:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while updating profile'
    });
  }
};

/**
 * Set up two-factor authentication
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.setup2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return res.status(400).json({
        status: 'error',
        message: '2FA is already enabled'
      });
    }

    // Generate new secret
    const secret = speakeasy.generateSecret({
      name: `M-Pesa Platform:${user.email}`
    });

    // Save secret to user temporarily (not enabled yet)
    user.twoFactorSecret = secret.base32;
    await user.save();

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    res.status(200).json({
      status: 'success',
      message: '2FA setup initiated',
      data: {
        qrCode
      }
    });
  } catch (error) {
    logger.error('Error in setup 2FA:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while setting up 2FA'
    });
  }
};

/**
 * Verify and enable two-factor authentication
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.verify2FA = async (req, res) => {
  try {
    const { token } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Verify token against secret
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token
    });

    if (!verified) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid verification code'
      });
    }

    // Enable 2FA
    user.twoFactorEnabled = true;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: '2FA enabled successfully'
    });
  } catch (error) {
    logger.error('Error in verify 2FA:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while verifying 2FA'
    });
  }
};

/**
 * Disable two-factor authentication
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.disable2FA = async (req, res) => {
  try {
    const { token } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        status: 'error',
        message: '2FA is not enabled'
      });
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token
    });

    if (!verified) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid verification code'
      });
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: '2FA disabled successfully'
    });
  } catch (error) {
    logger.error('Error in disable 2FA:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while disabling 2FA'
    });
  }
};

/**
 * Verify 2FA token during login
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.verify2FALogin = async (req, res) => {
  try {
    const { token, tempToken } = req.body;

    // Verify tempToken
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or expired token'
      });
    }

    // Check if this is a 2FA verification token
    if (!decoded.require2FA) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid token type'
      });
    }

    // Find user
    const user = await User.findById(decoded.id);
    if (!user || !user.twoFactorEnabled) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found or 2FA not enabled'
      });
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token
    });

    if (!verified) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid verification code'
      });
    }

    // Generate full JWT token
    const newToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        token: newToken,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      }
    });
  } catch (error) {
    logger.error('Error in 2FA login verification:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during 2FA verification'
    });
  }
};

/**
 * Log out the user
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.logout = async (req, res) => {
  try {
    // Note: JWT tokens are stateless, so we can't invalidate them server-side
    // The client should remove the token from local storage
    
    // In a more advanced implementation, you could use a token blacklist
    // or implement short-lived tokens with refresh tokens
    
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Error in logout:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during logout'
    });
  }
};