//server/src/models/user.model.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in query results by default
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
    enum: ['admin', 'business', 'developer'],
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
    select: false // Don't include 2FA secret in query results by default
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  passwordChangedAt: Date,
  createdAt: { 
    type: Date, 
    default: Date.now
  },
  updatedAt: { 
    type: Date, 
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  timestamps: true
});

// Virtual property for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified
  if (!this.isModified('password')) return next();
  
  // Hash the password with a cost factor of 12
  this.password = await bcrypt.hash(this.password, 12);
  
  // If this is a password change (not a new user), update passwordChangedAt
  if (!this.isNew) {
    this.passwordChangedAt = Date.now() - 1000; // Subtract 1 second for potential processing delays
  }
  
  next();
});

// Update the updatedAt field on save
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

/**
 * Compare provided password with stored password hash
 * @param {string} candidatePassword - Password to check
 * @param {string} userPassword - Stored password hash
 * @returns {Promise<boolean>} - True if passwords match
 */
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

/**
 * Check if password was changed after a given timestamp
 * @param {number} JWTTimestamp - JWT issued timestamp
 * @returns {boolean} - True if password was changed after token issuance
 */
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

/**
 * Create password reset token
 * @returns {string} - Reset token
 */
userSchema.methods.createPasswordResetToken = function() {
  // Generate random token
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // Hash token and store in database
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Set expiration (10 minutes)
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  
  // Return original token (not the hash)
  return resetToken;
};

/**
 * Create email verification token
 * @returns {string} - Verification token
 */
userSchema.methods.createVerificationToken = function() {
  // Generate random token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  // Hash token and store in database
  this.verificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  // Set expiration (24 hours)
  this.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
  
  // Return original token (not the hash)
  return verificationToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;