// server/src/models/token.model.js

const mongoose = require('mongoose');

/**
 * Token schema for verification tokens, password reset tokens, etc.
 */
const tokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['email-verification', 'password-reset', 'api-key'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '7d' // Automatically delete tokens after 7 days
  },
  expiresAt: {
    type: Date,
    required: true
  }
});

// Create index on token for faster lookups
tokenSchema.index({ token: 1 });

// Create index on userId for faster lookups
tokenSchema.index({ userId: 1 });

// Create index on type for faster lookups
tokenSchema.index({ type: 1 });

// Create index on expiresAt for faster expiry checks
tokenSchema.index({ expiresAt: 1 });

const Token = mongoose.model('Token', tokenSchema);

module.exports = Token;