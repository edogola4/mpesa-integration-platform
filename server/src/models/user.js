// server/src/models/user.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
      },
      message: props => `${props.value} is not a valid email address!`
    }
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't return password by default
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
      message: '{VALUE} is not a supported role'
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
  verificationToken: {
    type: String,
    select: false
  },
  verificationExpires: {
    type: Date,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  twoFactorEnabled: { 
    type: Boolean, 
    default: false 
  },
  twoFactorSecret: { 
    type: String,
    select: false
  },
  lastLogin: {
    type: Date
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  accountLocked: {
    type: Boolean,
    default: false
  },
  accountLockedUntil: {
    type: Date
  },
  active: {
    type: Boolean,
    default: true,
    select: false
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true, // Automatically update createdAt and updatedAt
  toJSON: { virtuals: true }, // Include virtuals when document is converted to JSON
  toObject: { virtuals: true } // Include virtuals when document is converted to Object
});

// Virtual property for fullName
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Add index for email
userSchema.index({ email: 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified('password')) return next();
  
  try {
    // Generate a salt
    const salt = await bcrypt.genSalt(10);
    
    // Hash the password with the new salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Hide sensitive data when converting to JSON
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.verificationToken;
  delete userObject.verificationExpires;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  delete userObject.twoFactorSecret;
  delete userObject.__v;
  
  return userObject;
};

// Method to check if provided password is correct
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate JWT token for authentication
userSchema.methods.generateAuthToken = function() {
  const payload = {
    id: this._id,
    email: this.email,
    role: this.role
  };
  
  // Get JWT secret and expiration from environment variables
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
  
  // Generate and return the token
  return jwt.sign(payload, secret, { expiresIn });
};

// Method to generate verification token
userSchema.methods.generateVerificationToken = function() {
  // Generate a random token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Hash the token and set it on the user
  this.verificationToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
    
  // Set expiration (24 hours)
  this.verificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  
  return token;
};

// Method to generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  // Generate a random token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Hash the token and set it on the user
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
    
  // Set expiration (1 hour)
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000;
  
  return token;
};

// Static method to find user by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

const User = mongoose.model('User', userSchema);

module.exports = User;