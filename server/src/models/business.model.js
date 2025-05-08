//server/src/models/business.model.js

const mongoose = require('mongoose');
const crypto = require('crypto');

const businessSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  apiKeys: [{
    key: {
      type: String,
      unique: true,
    },
    secret: {
      type: String,
      select: false, // Don't return secret by default
    },
    name: {
      type: String,
      default: 'Default',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsed: Date,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  webhookUrl: {
    type: String,
    trim: true,
  },
  webhookSecret: {
    type: String,
    select: false, // Don't return webhook secret by default
  },
  notificationEmail: {
    type: String,
    trim: true,
  },
  notificationPhone: {
    type: String,
    trim: true,
  },
  mpesaIntegrations: [{
    country: {
      type: String,
      required: true,
      enum: ['kenya', 'tanzania', 'uganda', 'rwanda', 'mozambique', 'drc'],
    },
    shortCode: {
      type: String,
      required: true,
    },
    consumerKey: {
      type: String,
      required: true,
      select: false, // Don't return consumer key by default
    },
    consumerSecret: {
      type: String,
      required: true,
      select: false, // Don't return consumer secret by default
    },
    passkey: {
      type: String,
      select: false, // Don't return passkey by default
    },
    environment: {
      type: String,
      enum: ['sandbox', 'production'],
      default: 'sandbox',
    },
    callbackUrl: {
      type: String,
      trim: true,
    },
    timeoutUrl: {
      type: String,
      trim: true,
    },
    resultUrl: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  }],
  settings: {
    autoConfirmation: {
      type: Boolean,
      default: true,
    },
    notifyOnSuccess: {
      type: Boolean,
      default: true,
    },
    notifyOnFailure: {
      type: Boolean,
      default: true,
    },
    webhookTimeout: {
      type: Number,
      default: 15000, // 15 seconds
    },
  },
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
 * Generate API key and secret
 * @returns {Object} Object containing key and secret
 */
businessSchema.methods.generateApiKey = function () {
  const key = `key_${crypto.randomBytes(16).toString('hex')}`;
  const secret = `secret_${crypto.randomBytes(32).toString('hex')}`;
  
  this.apiKeys.push({
    key,
    secret,
    name: `API Key ${this.apiKeys.length + 1}`,
    createdAt: Date.now(),
  });
  
  return { key, secret };
};

/**
 * Generate webhook secret
 * @returns {string} Webhook secret
 */
businessSchema.methods.generateWebhookSecret = function () {
  const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
  this.webhookSecret = secret;
  return secret;
};

/**
 * Find business by API key
 * @param {string} apiKey - The API key to search for
 * @returns {Promise<Business>} Business document
 */
businessSchema.statics.findByApiKey = async function (apiKey) {
  return this.findOne({
    'apiKeys.key': apiKey,
    'apiKeys.isActive': true,
  }).select('+apiKeys.secret');
};

/**
 * Verify API key and secret
 * @param {string} apiKey - The API key
 * @param {string} apiSecret - The API secret
 * @returns {Promise<boolean>} Whether the key and secret are valid
 */
businessSchema.statics.verifyApiCredentials = async function (apiKey, apiSecret) {
  const business = await this.findOne({
    'apiKeys.key': apiKey,
    'apiKeys.isActive': true,
  }).select('+apiKeys.secret');
  
  if (!business) return false;
  
  const keyObject = business.apiKeys.find(k => k.key === apiKey);
  if (!keyObject) return false;
  
  // Update last used timestamp
  await this.updateOne(
    { 'apiKeys.key': apiKey },
    { $set: { 'apiKeys.$.lastUsed': new Date() } }
  );
  
  return keyObject.secret === apiSecret;
};

/**
 * Update timestamps before saving
 */
businessSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Create the Business model
const Business = mongoose.model('Business', businessSchema);

module.exports = Business;