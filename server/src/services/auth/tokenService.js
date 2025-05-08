/**
 * Token management service
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../config');
const { AppError } = require('../../utils/errorHandler');
const User = require('../../models/user');

// Token types
const TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  RESET_PASSWORD: 'reset_password',
  VERIFY_EMAIL: 'verify_email',
  API_KEY: 'api_key',
};

class TokenService {
  /**
   * Generate JWT access token
   * @param {string} userId - User ID
   * @param {Array} permissions - Optional array of specific permissions
   * @returns {string} JWT token
   */
  generateAccessToken(userId, permissions = null) {
    const payload = {
      userId,
      type: TOKEN_TYPES.ACCESS,
    };

    if (permissions) {
      payload.permissions = permissions;
    }

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.accessExpiresIn || '15m',
    });
  }

  /**
   * Generate refresh token
   * @param {string} userId - User ID
   * @returns {string} Refresh token
   */
  generateRefreshToken(userId) {
    const payload = {
      userId,
      type: TOKEN_TYPES.REFRESH,
      tokenId: crypto.randomBytes(16).toString('hex'),
    };

    return jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn || '7d',
    });
  }

  /**
   * Generate temporary token for specific purposes
   * @param {string} userId - User ID
   * @param {string} type - Token type
   * @param {string} expiresIn - Expiration time
   * @returns {string} JWT token
   */
  generateTempToken(userId, type, expiresIn = '1h') {
    const payload = {
      userId,
      type,
      tokenId: crypto.randomBytes(16).toString('hex'),
    };

    const secret = this.getSecretForTokenType(type);
    return jwt.sign(payload, secret, { expiresIn });
  }

  /**
   * Verify a JWT token
   * @param {string} token - JWT token to verify
   * @param {string} type - Expected token type
   * @returns {Object} Decoded token payload
   */
  verifyToken(token, type) {
    try {
      const secret = this.getSecretForTokenType(type);
      const decoded = jwt.verify(token, secret);
      
      // Validate token type
      if (decoded.type !== type) {
        throw new AppError('Invalid token type', 401);
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError('Token expired', 401);
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AppError('Invalid token', 401);
      }
      throw error;
    }
  }

  /**
   * Get the appropriate secret for a token type
   * @param {string} type - Token type
   * @returns {string} Secret key
   */
  getSecretForTokenType(type) {
    switch (type) {
      case TOKEN_TYPES.ACCESS:
        return config.jwt.secret;
      case TOKEN_TYPES.REFRESH:
        return config.jwt.refreshSecret;
      case TOKEN_TYPES.RESET_PASSWORD:
        return config.jwt.secret + '_reset';
      case TOKEN_TYPES.VERIFY_EMAIL:
        return config.jwt.secret + '_verify';
      case TOKEN_TYPES.API_KEY:
        return config.jwt.apiKeySecret;
      default:
        return config.jwt.secret;
    }
  }

  /**
   * Generate verification token for email verification
   * @param {string} userId - User ID
   * @returns {string} Token
   */
  generateEmailVerificationToken(userId) {
    return this.generateTempToken(userId, TOKEN_TYPES.VERIFY_EMAIL, '24h');
  }

  /**
   * Generate password reset token
   * @param {string} userId - User ID
   * @returns {string} Token
   */
  generatePasswordResetToken(userId) {
    return this.generateTempToken(userId, TOKEN_TYPES.RESET_PASSWORD, '1h');
  }

  /**
   * Generate an API key for a business
   * @param {string} businessId - Business ID
   * @returns {string} API key
   */
  generateApiKey(businessId) {
    // Generate a random key
    const apiKey = `mp_${crypto.randomBytes(16).toString('hex')}`;
    
    // Generate a signed token that encodes the businessId
    const apiKeyToken = jwt.sign(
      { businessId, type: TOKEN_TYPES.API_KEY },
      config.jwt.apiKeySecret,
      { expiresIn: '10y' } // Long expiry for API keys
    );
    
    return {
      key: apiKey,
      token: apiKeyToken,
    };
  }

  /**
   * Validate an API key
   * @param {string} apiKey - The API key to validate
   * @param {string} apiKeyToken - The API key token
   * @returns {Object} Decoded API key data
   */
  validateApiKey(apiKey, apiKeyToken) {
    if (!apiKey || !apiKeyToken) {
      throw new AppError('Invalid API key', 401);
    }

    try {
      return this.verifyToken(apiKeyToken, TOKEN_TYPES.API_KEY);
    } catch (error) {
      throw new AppError('Invalid or expired API key', 401);
    }
  }

  /**
   * Add token to blacklist
   * @param {string} token - Token to blacklist
   * @param {Date} expiry - Token expiry date
   * @returns {Promise<void>}
   */
  async blacklistToken(token, expiry) {
    // This would typically be stored in Redis or similar for production
    // For now, we'll just use a simple MongoDB implementation
    await BlacklistedToken.create({
      token: this.hashToken(token),
      expiresAt: expiry,
    });
  }

  /**
   * Check if a token is blacklisted
   * @param {string} token - Token to check
   * @returns {Promise<boolean>} Whether the token is blacklisted
   */
  async isTokenBlacklisted(token) {
    const hashedToken = this.hashToken(token);
    const blacklisted = await BlacklistedToken.findOne({ token: hashedToken });
    return !!blacklisted;
  }

  /**
   * Hash a token for storage in blacklist
   * @param {string} token - Token to hash
   * @returns {string} Hashed token
   */
  hashToken(token) {
    return crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
  }
}

module.exports = {
  TokenService: new TokenService(),
  TOKEN_TYPES,
};