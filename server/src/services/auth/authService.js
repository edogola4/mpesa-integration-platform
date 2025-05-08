/**
 * Authentication service for user management
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../../config');
const { AppError } = require('../../utils/errorHandler');
const User = require('../../models/user');
const { sendMail } = require('../notifications/emailService');

class AuthService {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Object} The created user object (without password)
   */
  async registerUser(userData) {
    // Check if user with this email already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new AppError('Email already in use', 400);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const newUser = await User.create({
      ...userData,
      password: hashedPassword,
      verificationToken,
      verificationTokenExpiry,
    });

    // Send verification email
    await this.sendVerificationEmail(newUser.email, verificationToken);

    // Return user without sensitive data
    const userObj = newUser.toObject();
    delete userObj.password;
    delete userObj.verificationToken;
    delete userObj.verificationTokenExpiry;

    return userObj;
  }

  /**
   * Login a user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Object} Authentication data including JWT token
   */
  async loginUser(email, password) {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check if email is verified
    if (!user.isVerified) {
      throw new AppError('Email not verified', 401);
    }

    // Generate JWT token
    const token = this.generateToken(user._id);

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      return {
        userId: user._id,
        requiresTwoFactor: true,
        tempToken: this.generateTempToken(user._id),
      };
    }

    // Return auth data
    return {
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  /**
   * Verify user email
   * @param {string} token - Email verification token
   * @returns {boolean} Success status
   */
  async verifyEmail(token) {
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();

    return true;
  }

  /**
   * Request password reset
   * @param {string} email - User email
   * @returns {boolean} Success status
   */
  async requestPasswordReset(email) {
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists or not
      return true;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    await this.sendPasswordResetEmail(email, resetToken);

    return true;
  }

  /**
   * Reset user password
   * @param {string} token - Password reset token
   * @param {string} newPassword - New password
   * @returns {boolean} Success status
   */
  async resetPassword(token, newPassword) {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    return true;
  }

  /**
   * Set up two-factor authentication
   * @param {string} userId - User ID
   * @returns {Object} 2FA setup data
   */
  async setupTwoFactor(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Generate secret
    const secret = this.generateTwoFactorSecret();
    user.twoFactorSecret = secret.base32;
    await user.save();

    return {
      secret: secret.base32,
      otpauth_url: secret.otpauth_url,
    };
  }

  /**
   * Verify two-factor authentication code
   * @param {string} userId - User ID
   * @param {string} code - 2FA code
   * @returns {Object} Auth data including JWT token
   */
  async verifyTwoFactor(userId, code) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify code
    const isValid = this.verifyTwoFactorCode(user.twoFactorSecret, code);
    if (!isValid) {
      throw new AppError('Invalid authentication code', 401);
    }

    // Enable 2FA if first verification
    if (!user.twoFactorEnabled) {
      user.twoFactorEnabled = true;
      await user.save();
    }

    // Generate JWT token
    const token = this.generateToken(user._id);

    // Return auth data
    return {
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  /**
   * Generate JWT token
   * @param {string} userId - User ID
   * @returns {string} JWT token
   */
  generateToken(userId) {
    return jwt.sign({ id: userId }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }

  /**
   * Generate temporary token for 2FA flow
   * @param {string} userId - User ID
   * @returns {string} Temporary JWT token
   */
  generateTempToken(userId) {
    return jwt.sign({ id: userId, temp: true }, config.jwt.secret, {
      expiresIn: '5m', // Short expiry for security
    });
  }

  /**
   * Send verification email
   * @param {string} email - User email
   * @param {string} token - Verification token
   * @returns {Promise} Email send promise
   */
  async sendVerificationEmail(email, token) {
    const verificationUrl = `${config.clientUrl}/verify-email?token=${token}`;
    
    return sendMail({
      to: email,
      subject: 'Verify Your Email',
      template: 'emailVerification',
      context: {
        verificationUrl,
      },
    });
  }

  /**
   * Send password reset email
   * @param {string} email - User email
   * @param {string} token - Reset token
   * @returns {Promise} Email send promise
   */
  async sendPasswordResetEmail(email, token) {
    const resetUrl = `${config.clientUrl}/reset-password?token=${token}`;
    
    return sendMail({
      to: email,
      subject: 'Reset Your Password',
      template: 'passwordReset',
      context: {
        resetUrl,
      },
    });
  }

  /**
   * Generate two-factor authentication secret
   * @returns {Object} 2FA secret data
   */
  generateTwoFactorSecret() {
    // Note: This is a placeholder. In a real implementation, you'd use a library like speakeasy
    const base32 = crypto.randomBytes(20).toString('base64');
    return {
      base32,
      otpauth_url: `otpauth://totp/MPesa-Platform:${base32}?secret=${base32}&issuer=MPesa-Platform`,
    };
  }

  /**
   * Verify two-factor authentication code
   * @param {string} secret - 2FA secret
   * @param {string} code - 2FA code to verify
   * @returns {boolean} Verification result
   */
  verifyTwoFactorCode(secret, code) {
    // Note: This is a placeholder. In a real implementation, you'd use a library like speakeasy
    // For now, we'll just accept any 6-digit code
    return /^\d{6}$/.test(code);
  }
}

module.exports = new AuthService();