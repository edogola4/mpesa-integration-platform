// server/src/models/user.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config';

/**
 * User Schema
 * @description Defines the data model for user accounts
 */
const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,}$/, 'Please use a valid email address']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [10, 'Password must be at least 10 characters'],
    select: false, // Don't return password in queries by default
    validate: {
      validator: function(password) {
        // At least one uppercase, one lowercase, one number, one special character
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
        return passwordRegex.test(password);
      },
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }
  },
  firstName: { 
    type: String, 
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: { 
    type: String, 
    required: [true, 'Last name is required'],
    trim: true
  },
  role: { 
    type: String, 
    enum: {
      values: ['admin', 'business', 'developer'],
      message: 'Role must be either: admin, business, or developer'
    },
    default: 'business' 
  },
  company: { 
    type: String,
    trim: true
  },
  phone: { 
    type: String,
    trim: true
  },
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  twoFactorEnabled: { 
    type: Boolean, 
    default: false 
  },
  twoFactorSecret: { 
    type: String,
    select: false
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  lastLogin: Date,
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true // Automatically manage createdAt and updatedAt
});

/**
 * Pre-save middleware
 * Hash password before saving if it has been modified
 */
userSchema.pre('save', async function(next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    // Generate salt and hash password using a modern approach
    const salt = await bcrypt.genSalt(12); // Increased from 10 to 12 for better security
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Method to compare password
 * @param {string} candidatePassword - The password to compare
 * @returns {boolean} True if passwords match
 */
userSchema.methods.matchPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Generate JWT authentication token
 * @returns {string} JWT token
 */
userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      email: this.email, 
      role: this.role,
      version: 2 // Adding version for potential future token validation
    },
    config.jwt.secret,
    { 
      expiresIn: config.jwt.expiresIn || '1d',
      algorithm: 'HS256' // Explicitly set the algorithm
    }
  );
};

/**
 * Generate refresh token with longer expiry
 * @returns {string} Refresh token
 */
userSchema.methods.generateRefreshToken = function() {
  return jwt.sign(
    { 
      id: this._id,
      tokenType: 'refresh',
      version: 2
    },
    config.jwt.refreshSecret || config.jwt.secret,
    { 
      expiresIn: config.jwt.refreshExpiresIn || '7d',
      algorithm: 'HS256'
    }
  );
};

/**
 * Generate password reset token
 * @returns {string} Unhashed reset token (to be sent via email)
 */
userSchema.methods.generatePasswordResetToken = function() {
  // Generate cryptographically secure random token
  const resetToken = crypto.randomBytes(48).toString('hex');
  
  // Hash the token using a more modern approach
  this.resetPasswordToken = crypto
    .createHash('sha3-256')
    .update(resetToken)
    .digest('hex');
    
  // Set expiry (30 minutes from now)
  this.resetPasswordExpires = Date.now() + 30 * 60 * 1000;
  
  // Return the unhashed token
  return resetToken;
};

/**
 * Generate email verification token
 * @returns {string} Unhashed verification token (to be sent via email)
 */
userSchema.methods.generateVerificationToken = function() {
  // Generate cryptographically secure random token
  const verificationToken = crypto.randomBytes(48).toString('hex');
  
  // Hash the token using a more modern approach
  this.verificationToken = crypto
    .createHash('sha3-256')
    .update(verificationToken)
    .digest('hex');
    
  // Set expiry (24 hours from now)
  this.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
  
  // Return the unhashed token
  return verificationToken;
};

// Create a virtual field for fullName
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtual fields are included when converting to JSON/Objects
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model('User', userSchema);

export default User;