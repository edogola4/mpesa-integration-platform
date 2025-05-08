/**
 * Two-factor authentication service
 */
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../../models/user');
const { AppError } = require('../../utils/errorHandler');
const config = require('../../config');

class TwoFactorService {
  /**
   * Generate 2FA secret for a user
   * @param {Object} user - User object
   * @returns {Promise<Object>} Secret and QR code data
   */
  async generateSecret(user) {
    // Generate a new secret
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `${config.appName}:${user.email}`,
      issuer: config.appName,
    });

    // Generate QR code for the secret
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCodeUrl,
    };
  }

  /**
   * Set up 2FA for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} 2FA setup data
   */
  async setup(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Generate secret
    const { secret, qrCodeUrl } = await this.generateSecret(user);

    // Store secret temporarily (not enabling 2FA yet)
    user.twoFactorSecret = secret;
    user.twoFactorPending = true;
    await user.save();

    return {
      secret,
      qrCodeUrl,
    };
  }

  /**
   * Verify and enable 2FA for a user
   * @param {string} userId - User ID
   * @param {string} token - 2FA token to verify
   * @returns {Promise<boolean>} Success status
   */
  async verifyAndEnable(userId, token) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.twoFactorSecret) {
      throw new AppError('Two-factor authentication not set up', 400);
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 steps before/after for clock drift
    });

    if (!verified) {
      throw new AppError('Invalid verification code', 401);
    }

    // Enable 2FA for the user
    user.twoFactorEnabled = true;
    user.twoFactorPending = false;
    await user.save();

    return true;
  }

  /**
   * Disable 2FA for a user
   * @param {string} userId - User ID
   * @param {string} token - 2FA token to verify
   * @returns {Promise<boolean>} Success status
   */
  async disable(userId, token) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.twoFactorEnabled) {
      throw new AppError('Two-factor authentication not enabled', 400);
    }

    // Verify the token before disabling
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      throw new AppError('Invalid verification code', 401);
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorPending = false;
    await user.save();

    return true;
  }

  /**
   * Verify a 2FA token
   * @param {string} secret - The 2FA secret
   * @param {string} token - The token to verify
   * @returns {boolean} Verification result
   */
  verify(secret, token) {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2,
    });
  }

  /**
   * Generate backup codes for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array<string>>} List of backup codes
   */
  async generateBackupCodes(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.twoFactorEnabled) {
      throw new AppError('Two-factor authentication not enabled', 400);
    }

    // Generate 10 backup codes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      const code = this.generateRandomCode();
      backupCodes.push(code);
    }

    // Store hashed backup codes
    user.backupCodes = backupCodes.map(code => ({
      code: this.hashCode(code),
      used: false,
    }));
    
    await user.save();

    // Return plain text codes to show to the user (one time only)
    return backupCodes;
  }

  /**
   * Verify a backup code
   * @param {string} userId - User ID
   * @param {string} code - Backup code to verify
   * @returns {Promise<boolean>} Verification result
   */
  async verifyBackupCode(userId, code) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.backupCodes || user.backupCodes.length === 0) {
      throw new AppError('No backup codes available', 400);
    }

    // Find matching backup code
    const hashedCode = this.hashCode(code);
    const backupCodeIndex = user.backupCodes.findIndex(
      bc => bc.code === hashedCode && !bc.used
    );

    if (backupCodeIndex === -1) {
      return false;
    }

    // Mark the code as used
    user.backupCodes[backupCodeIndex].used = true;
    await user.save();

    return true;
  }

  /**
   * Generate a random backup code
   * @returns {string} Random code
   */
  generateRandomCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  /**
   * Hash a backup code
   * @param {string} code - Code to hash
   * @returns {string} Hashed code
   */
  hashCode(code) {
    return crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');
  }
}

module.exports = new TwoFactorService();