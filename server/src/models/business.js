// server/src/models/business.js
import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * API Key Schema
 * @description Defines the data model for business API keys
 */
const apiKeySchema = new mongoose.Schema({
  key: { 
    type: String,
    required: true,
    index: true
  },
  secret: { 
    type: String,
    required: true,
    select: false // Don't return secret in queries by default
  },
  name: { 
    type: String,
    required: true,
    trim: true
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  lastUsed: {
    type: Date
  },
  permissions: {
    type: [String],
    default: ['read', 'write'],
    validate: {
      validator: function(permissions) {
        const validPermissions = ['read', 'write', 'admin', 'payments', 'reports'];
        return permissions.every(permission => validPermissions.includes(permission));
      },
      message: props => `${props.value} contains invalid permissions`
    }
  },
  ipRestrictions: {
    type: [String],
    default: []
  },
  expiresAt: {
    type: Date
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

/**
 * M-Pesa Integration Schema
 * @description Defines the data model for M-Pesa payment integrations
 */
const mpesaIntegrationSchema = new mongoose.Schema({
  country: { 
    type: String, 
    required: true,
    lowercase: true,
    enum: {
      values: ['kenya', 'tanzania', 'uganda', 'rwanda', 'mozambique', 'drc'],
      message: '{VALUE} is not a supported country'
    }
  },
  shortCode: { 
    type: String, 
    required: true,
    trim: true
  },
  consumerKey: { 
    type: String, 
    required: true,
    trim: true,
    select: false // Don't return in queries by default
  },
  consumerSecret: { 
    type: String, 
    required: true,
    trim: true,
    select: false
  },
  passkey: { 
    type: String,
    trim: true,
    select: false
  },
  initiatorName: {
    type: String,
    trim: true
  },
  initiatorPassword: {
    type: String,
    trim: true,
    select: false
  },
  organizationName: {
    type: String,
    trim: true
  },
  isLive: { 
    type: Boolean, 
    default: false 
  },
  callbackBaseUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^(https):\/\/[^ "]+$/.test(v); // Required HTTPS
      },
      message: props => `${props.value} is not a valid HTTPS URL`
    }
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'error'],
    default: 'pending'
  },
  lastVerified: {
    type: Date
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

/**
 * Notification Settings Schema
 * @description Defines notification preferences for the business
 */
const notificationSettingsSchema = new mongoose.Schema({
  webhookEnabled: {
    type: Boolean,
    default: true
  },
  emailEnabled: {
    type: Boolean,
    default: true
  },
  emailRecipients: {
    type: [String],
    validate: {
      validator: function(emails) {
        const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,}$/;
        return emails.every(email => emailRegex.test(email));
      },
      message: props => `Email list contains invalid email addresses`
    }
  },
  smsEnabled: {
    type: Boolean,
    default: false
  },
  smsRecipients: {
    type: [String],
    validate: {
      validator: function(phones) {
        // Basic phone validation - could be improved for international numbers
        return phones.every(phone => /^\+?[0-9]{10,15}$/.test(phone));
      },
      message: props => `Phone number list contains invalid phone numbers`
    }
  },
  notifyOnSuccess: {
    type: Boolean,
    default: true
  },
  notifyOnFailure: {
    type: Boolean,
    default: true
  },
  notificationEvents: {
    type: [String],
    default: ['payment.success', 'payment.failed', 'api.error']
  }
});

/**
 * Business Schema
 * @description Main schema for businesses in the platform
 */
const businessSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Business name is required'],
    trim: true,
    index: true
  },
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  users: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'member'
    },
    permissions: {
      type: [String],
      default: ['read']
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  description: {
    type: String,
    trim: true
  },
  apiKeys: [apiKeySchema],
  webhookUrl: { 
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        // Must be HTTPS for production environments
        return !v || /^(https):\/\/[^ "]+$/.test(v);
      },
      message: props => `${props.value} is not a valid HTTPS URL`
    }
  },
  webhookSecret: {
    type: String,
    select: false
  },
  notificationEmail: { 
    type: String,
    trim: true,
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,}$/, 'Please provide a valid email']
  },
  notificationPhone: { 
    type: String,
    trim: true
  },
  notificationSettings: {
    type: notificationSettingsSchema,
    default: () => ({})
  },
  mpesaIntegrations: [mpesaIntegrationSchema],
  logo: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^(http|https):\/\/[^ "]+$/.test(v);
      },
      message: props => `${props.value} is not a valid URL`
    }
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true }
  },
  defaultCurrency: {
    type: String,
    default: 'KES',
    uppercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[A-Z]{3}$/.test(v);
      },
      message: props => `${props.value} is not a valid currency code`
    }
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'suspended'],
    default: 'active'
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: () => new Map()
  },
  active: {
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add indexes for performance
businessSchema.index({ owner: 1 });
businessSchema.index({ 'users.user': 1 });
businessSchema.index({ 'apiKeys.key': 1 }, { unique: true, sparse: true });
businessSchema.index({ name: 'text', description: 'text' });
businessSchema.index({ status: 1 });

/**
 * Update timestamps pre-save middleware
 */
businessSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

/**
 * Virtual for active API keys count
 */
businessSchema.virtual('activeApiKeys').get(function() {
  return this.apiKeys.filter(key => key.isActive).length;
});

/**
 * Virtual for active M-Pesa integrations count
 */
businessSchema.virtual('activeMpesaIntegrations').get(function() {
  return this.mpesaIntegrations.filter(integration => 
    integration.status === 'active'
  ).length;
});

/**
 * Method to generate a new API key
 * @param {string} keyName - Name for the API key
 * @param {Array} permissions - Optional array of permissions
 * @param {Date} expiresAt - Optional expiration date
 * @returns {Object} API key and secret
 */
businessSchema.methods.generateApiKey = function(keyName, permissions = ['read', 'write'], expiresAt = null) {
  const apiKey = crypto.randomBytes(24).toString('hex');
  const apiSecret = crypto.randomBytes(48).toString('hex');
  
  this.apiKeys.push({
    key: apiKey,
    secret: crypto.createHash('sha3-256').update(apiSecret).digest('hex'),
    name: keyName || 'API Key',
    permissions,
    isActive: true,
    expiresAt,
    createdAt: Date.now()
  });
  
  return { apiKey, apiSecret };
};

/**
 * Method to find API key by key string
 * @param {string} keyString - API key to find
 * @returns {Object} API key object or null
 */
businessSchema.methods.findApiKey = function(keyString) {
  return this.apiKeys.find(apiKey => apiKey.key === keyString);
};

/**
 * Method to verify API key and secret
 * @param {string} keyString - API key
 * @param {string} secretString - API secret
 * @returns {boolean} True if valid
 */
businessSchema.methods.verifyApiKey = function(keyString, secretString) {
  const apiKey = this.apiKeys.find(apiKey => apiKey.key === keyString);
  
  if (!apiKey || !apiKey.isActive) {
    return false;
  }
  
  // Compare hashed secret
  const hashedSecret = crypto.createHash('sha3-256').update(secretString).digest('hex');
  
  // Check if key is expired
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return false;
  }
  
  return apiKey.secret === hashedSecret;
};

/**
 * Method to revoke API key
 * @param {string} keyString - API key to revoke
 * @returns {boolean} True if key was found and revoked
 */
businessSchema.methods.revokeApiKey = function(keyString) {
  const keyIndex = this.apiKeys.findIndex(apiKey => apiKey.key === keyString);
  
  if (keyIndex === -1) {
    return false;
  }
  
  this.apiKeys[keyIndex].isActive = false;
  return true;
};

/**
 * Method to generate a webhook secret
 * @returns {string} Generated webhook secret
 */
businessSchema.methods.generateWebhookSecret = function() {
  const secret = crypto.randomBytes(48).toString('hex');
  this.webhookSecret = crypto.createHash('sha3-256').update(secret).digest('hex');
  return secret;
};

/**
 * Method to verify webhook signature
 * @param {string} payload - Request body as string
 * @param {string} signature - Received signature
 * @returns {boolean} True if signature is valid
 */
businessSchema.methods.verifyWebhookSignature = function(payload, signature) {
  const expectedSignature = crypto
    .createHmac('sha256', this.webhookSecret)
    .update(payload)
    .digest('hex');
  
  // Time-constant comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(signature, 'hex')
  );
};

/**
 * Method to add M-Pesa integration
 * @param {Object} integrationData - Integration details
 * @returns {Array} Updated M-Pesa integrations array
 */
businessSchema.methods.addMpesaIntegration = function(integrationData) {
  // Check if integration for this country already exists
  const existingIndex = this.mpesaIntegrations.findIndex(
    integration => integration.country === integrationData.country.toLowerCase()
  );
  
  if (existingIndex >= 0) {
    // Update existing integration
    this.mpesaIntegrations[existingIndex] = {
      ...this.mpesaIntegrations[existingIndex].toObject(),
      ...integrationData,
      updatedAt: Date.now()
    };
  } else {
    // Add new integration
    this.mpesaIntegrations.push({
      ...integrationData,
      country: integrationData.country.toLowerCase()
    });
  }
  
  return this.mpesaIntegrations;
};

/**
 * Method to get M-Pesa integration by country
 * @param {string} country - Country code
 * @returns {Object} M-Pesa integration or null
 */
businessSchema.methods.getMpesaIntegration = function(country) {
  return this.mpesaIntegrations.find(
    integration => integration.country.toLowerCase() === country.toLowerCase()
  );
};

/**
 * Method to update notification settings
 * @param {Object} settings - New notification settings
 * @returns {Object} Updated notification settings
 */
businessSchema.methods.updateNotificationSettings = function(settings) {
  this.notificationSettings = {
    ...this.notificationSettings.toObject(),
    ...settings
  };
  
  return this.notificationSettings;
};

/**
 * Static method to find businesses by user
 * @param {string} userId - User ID
 * @returns {Promise} Query promise
 */
businessSchema.statics.findByUser = function(userId) {
  return this.find({
    $or: [
      { owner: userId },
      { 'users.user': userId }
    ]
  });
};

/**
 * Static method to find business by API key
 * @param {string} apiKey - API key
 * @returns {Promise} Query promise
 */
businessSchema.statics.findByApiKey = function(apiKey) {
  return this.findOne({
    'apiKeys.key': apiKey,
    'apiKeys.isActive': true
  });
};

const Business = mongoose.model('Business', businessSchema);

export default Business;