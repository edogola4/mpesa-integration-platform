// server/src/models/business.js

const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
  key: { 
    type: String,
    required: true
  },
  secret: { 
    type: String,
    required: true,
    select: false // Don't return secret in queries by default
  },
  name: { 
    type: String,
    required: true
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
    default: ['read', 'write']
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

const mpesaIntegrationSchema = new mongoose.Schema({
  country: { 
    type: String, 
    required: true,
    enum: {
      values: ['kenya', 'tanzania', 'uganda', 'rwanda', 'mozambique', 'drc'],
      message: '{VALUE} is not a supported country'
    }
  },
  shortCode: { 
    type: String, 
    required: true 
  },
  consumerKey: { 
    type: String, 
    required: true,
    select: false // Don't return in queries by default
  },
  consumerSecret: { 
    type: String, 
    required: true,
    select: false
  },
  passkey: { 
    type: String,
    select: false
  },
  initiatorName: {
    type: String,
  },
  initiatorPassword: {
    type: String,
    select: false
  },
  organizationName: {
    type: String
  },
  isLive: { 
    type: Boolean, 
    default: false 
  },
  callbackBaseUrl: {
    type: String
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
    type: [String]
  },
  smsEnabled: {
    type: Boolean,
    default: false
  },
  smsRecipients: {
    type: [String]
  },
  notifyOnSuccess: {
    type: Boolean,
    default: true
  },
  notifyOnFailure: {
    type: Boolean,
    default: true
  }
});

const businessSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Business name is required'],
    trim: true
  },
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
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
    trim: true
  },
  webhookSecret: {
    type: String,
    select: false
  },
  notificationEmail: { 
    type: String,
    trim: true
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
    type: String
  },
  website: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },
  defaultCurrency: {
    type: String,
    default: 'KES'
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'suspended'],
    default: 'active'
  },
  metadata: {
    type: Object,
    default: {}
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
businessSchema.index({ 'apiKeys.key': 1 });
businessSchema.index({ name: 'text', description: 'text' });

// Virtual for active API keys count
businessSchema.virtual('activeApiKeys').get(function() {
  return this.apiKeys.filter(key => key.isActive).length;
});

// Method to generate a new API key
businessSchema.methods.generateApiKey = function(keyName) {
  const apiKey = crypto.randomBytes(16).toString('hex');
  const apiSecret = crypto.randomBytes(32).toString('hex');
  
  this.apiKeys.push({
    key: apiKey,
    secret: apiSecret,
    name: keyName || 'API Key',
    isActive: true,
    createdAt: Date.now()
  });
  
  return { apiKey, apiSecret };
};

// Method to find API key by key string
businessSchema.methods.findApiKey = function(keyString) {
  return this.apiKeys.find(apiKey => apiKey.key === keyString);
};

// Method to verify API key and secret
businessSchema.methods.verifyApiKey = function(keyString, secretString) {
  const apiKey = this.apiKeys.find(apiKey => apiKey.key === keyString);
  
  if (!apiKey || !apiKey.isActive) {
    return false;
  }
  
  // Compare secret (in a real implementation, we'd use a more secure comparison)
  return apiKey.secret === secretString;
};

// Method to generate a webhook secret
businessSchema.methods.generateWebhookSecret = function() {
  const secret = crypto.randomBytes(32).toString('hex');
  this.webhookSecret = secret;
  return secret;
};

// Method to add M-Pesa integration
businessSchema.methods.addMpesaIntegration = function(integrationData) {
  // Check if integration for this country already exists
  const existingIndex = this.mpesaIntegrations.findIndex(
    integration => integration.country === integrationData.country
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
    this.mpesaIntegrations.push(integrationData);
  }
  
  return this.mpesaIntegrations;
};

// Method to get M-Pesa integration by country
businessSchema.methods.getMpesaIntegration = function(country) {
  return this.mpesaIntegrations.find(
    integration => integration.country.toLowerCase() === country.toLowerCase()
  );
};

// Static method to find businesses by user
businessSchema.statics.findByUser = function(userId) {
  return this.find({
    $or: [
      { owner: userId },
      { 'users.user': userId }
    ]
  });
};

const Business = mongoose.model('Business', businessSchema);

module.exports = Business;