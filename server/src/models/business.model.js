//server/src/models/business.model.js
const mongoose = require('mongoose');
const crypto = require('crypto');

// API Key schema (as a sub-document)
const apiKeySchema = new mongoose.Schema({
  key: { 
    type: String,
    required: true 
  },
  secret: { 
    type: String,
    required: true,
    select: false // Don't include secret in query results by default
  },
  name: { 
    type: String,
    required: [true, 'API key name is required'],
    trim: true
  },
  isActive: { 
    type: Boolean,
    default: true 
  },
  createdAt: { 
    type: Date,
    default: Date.now 
  },
  lastUsed: Date
});

// M-Pesa Integration schema (as a sub-document)
const mpesaIntegrationSchema = new mongoose.Schema({
  country: { 
    type: String, 
    required: [true, 'Country is required'],
    enum: ['kenya', 'tanzania', 'uganda', 'rwanda', 'mozambique', 'drc'],
    lowercase: true
  },
  shortCode: { 
    type: String, 
    required: [true, 'Short code is required']
  },
  consumerKey: { 
    type: String, 
    required: [true, 'Consumer key is required'],
    select: false // Don't include in query results by default
  },
  consumerSecret: { 
    type: String, 
    required: [true, 'Consumer secret is required'],
    select: false // Don't include in query results by default
  },
  passkey: { 
    type: String,
    select: false // Don't include in query results by default
  },
  isLive: { 
    type: Boolean, 
    default: false 
  },
  initiationUrl: String,
  callbackUrl: String,
  timeoutUrl: String,
  resultUrl: String,
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Business schema
const businessSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Business name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  logo: {
    type: String // URL to logo image
  },
  website: {
    type: String,
    trim: true
  },
  apiKeys: [apiKeySchema],
  webhookUrl: { 
    type: String,
    trim: true 
  },
  webhookSecret: {
    type: String,
    select: false // Don't include in query results by default
  },
  notificationEmail: { 
    type: String,
    trim: true 
  },
  notificationPhone: { 
    type: String,
    trim: true 
  },
  mpesaIntegrations: [mpesaIntegrationSchema],
  isActive: {
    type: Boolean,
    default: true
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  timestamps: true
});

// Update the updatedAt field on save
businessSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

/**
 * Generate a new API key pair
 * @param {string} name - Name for the API key
 * @returns {object} - Object containing key and secret
 */
businessSchema.methods.generateApiKey = function(name) {
  // Generate random key and secret
  const key = `mp_${crypto.randomBytes(16).toString('hex')}`;
  const secret = crypto.randomBytes(32).toString('hex');
  
  // Hash the secret for storage
  const hashedSecret = crypto
    .createHash('sha256')
    .update(secret)
    .digest('hex');
  
  // Add to API keys array
  this.apiKeys.push({
    key,
    secret: hashedSecret,
    name,
    isActive: true,
    createdAt: Date.now()
  });
  
  // Return the unhashed values to be shown to the user once
  return { key, secret };
};

/**
 * Generate a webhook secret
 * @returns {string} - Webhook secret
 */
businessSchema.methods.generateWebhookSecret = function() {
  const secret = crypto.randomBytes(32).toString('hex');
  
  // Hash the secret for storage
  this.webhookSecret = crypto
    .createHash('sha256')
    .update(secret)
    .digest('hex');
  
  // Return the unhashed value to be shown to the user once
  return secret;
};

/**
 * Verify a webhook signature
 * @param {string} signature - Signature from request header
 * @param {string} body - Request body as string
 * @returns {boolean} - True if signature is valid
 */
businessSchema.methods.verifyWebhookSignature = function(signature, body) {
  const computedSignature = crypto
    .createHmac('sha256', this.webhookSecret)
    .update(body)
    .digest('hex');
  
  return signature === computedSignature;
};

const Business = mongoose.model('Business', businessSchema);

module.exports = Business;