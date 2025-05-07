const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false, // Don't return password by default
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  role: {
    type: String,
    enum: ['admin', 'business', 'developer'],
    default: 'business',
  },
  company: {
    type: String,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: String,
  verificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  passwordChangedAt: Date,
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  twoFactorSecret: {
    type: String,
    select: false, // Don't return 2FA secret by default
  },
  lastLogin: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Hash the password before saving
 */
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Generate a salt
    const salt = await bcrypt.genSalt(10);
    
    // Hash the password with the salt
    this.password = await bcrypt.hash(this.password, salt);
    
    // If password is changed, update the passwordChangedAt field
    if (!this.isNew) {
      this.passwordChangedAt = Date.now() - 1000; // Subtract 1 second for buffer
    }
    
    return next();
  } catch (error) {
    return next(error);
  }
});

/**
 * Check if entered password is correct
 * @param {string} candidatePassword - The password to check
 * @returns {Promise<boolean>}
 */
userSchema.methods.isPasswordMatch = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Generate JWT token for user
 * @returns {string} JWT token
 */
userSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    {
      sub: this._id,
      role: this.role,
      email: this.email,
      iat: Math.floor(Date.now() / 1000),
    },
    process.env.JWT_SECRET || 'your_jwt_secret_key_here',
    {
      expiresIn: process.env.JWT_EXPIRATION || '7d',
    }
  );
};

/**
 * Generate refresh token for user
 * @returns {string} Refresh token
 */
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      sub: this._id,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
    },
    process.env.JWT_SECRET || 'your_jwt_secret_key_here',
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRATION || '30d',
    }
  );
};

/**
 * Get user's full name
 */
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Create the User model
const User = mongoose.model('User', userSchema);

module.exports = User;