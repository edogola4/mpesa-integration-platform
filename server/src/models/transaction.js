// transaction.model.js
'use strict';

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * Transaction Schema
 * Enhanced with modern JavaScript patterns, improved security,
 * expanded features, and performance optimizations
 */
const transactionSchema = new mongoose.Schema({
  // Core identifiers
  transactionId: {
    type: String,
    unique: true,
    immutable: true,
    default: () => `txn_${uuidv4().replace(/-/g, '')}`,
    index: true,
  },
  internalReference: {
    type: String,
    required: true,
    unique: true,
    index: true,
    validate: {
      validator: function(v) {
        return typeof v === 'string' && v.trim().length > 0;
      },
      message: 'Internal reference cannot be empty',
    }
  },
  mpesaReference: {
    type: String,
    sparse: true,
    trim: true,
    index: true,
  },
  
  // Business relation
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true,
  },
  
  // Transaction details
  transactionType: {
    type: String,
    enum: ['payment', 'refund', 'reversal', 'deposit', 'withdrawal'], // Expanded options
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: [true, 'Please add a transaction amount'],
    min: [0, 'Amount must be greater than or equal to 0'],
    set: v => Math.round(v * 100) / 100, // Round to 2 decimal places
  },
  fee: {
    type: Number,
    default: 0,
    min: 0,
    set: v => Math.round(v * 100) / 100,
  },
  currency: {
    type: String,
    required: [true, 'Please add a currency'],
    enum: ['KES', 'TZS', 'UGX', 'RWF', 'MZN', 'CDF'], // Currency codes
    uppercase: true,
    index: true,
  },
  country: {
    type: String,
    required: [true, 'Please add a country'],
    enum: ['kenya', 'tanzania', 'uganda', 'rwanda', 'mozambique', 'drc'],
    lowercase: true,
    index: true,
  },
  phoneNumber: {
    type: String,
    required: [true, 'Please add a phone number'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^\+?[0-9]{10,15}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number`
    },
    index: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['initiated', 'pending', 'processing', 'completed', 'failed', 'canceled', 'expired'],
    default: 'initiated',
    index: true,
  },
  statusHistory: [{
    status: {
      type: String,
      enum: ['initiated', 'pending', 'processing', 'completed', 'failed', 'canceled', 'expired'],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    _id: false,
  }],
  
  // Payment provider data
  paymentProvider: {
    type: String,
    enum: ['mpesa', 'airtel', 'mtn', 'card', 'bank', 'crypto', 'other'],
    default: 'mpesa',
  },
  providerTransactionId: {
    type: String,
    trim: true,
    sparse: true,
    index: true,
  },
  callbackUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\//.test(v);
      },
      message: 'Callback URL must be a valid HTTP(S) URL'
    }
  },
  callbackData: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
  
  // API payloads
  requestPayload: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
  responsePayload: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
  
  // Additional metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
  
  // Webhook tracking
  webhookAttempts: [{
    timestamp: {
      type: Date,
      default: Date.now,
    },
    url: {
      type: String,
      trim: true,
    },
    responseCode: {
      type: Number,
    },
    responseBody: {
      type: String,
    },
    success: {
      type: Boolean,
      required: true,
    },
    _id: false,
  }],
  
  // Environment and security
  environment: {
    type: String,
    enum: ['sandbox', 'production'],
    default: 'sandbox',
    index: true,
  },
  ipAddress: {
    type: String,
    trim: true,
  },
  userAgent: {
    type: String,
    trim: true,
  },
  
  // Time management
  expiresAt: {
    type: Date,
    index: true,
  },
  processedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
}, {
  // Schema options
  timestamps: true, // Automatically handle createdAt and updatedAt
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v; // Remove version key
      return ret;
    }
  },
  toObject: { virtuals: true }
});

/**
 * Virtuals
 */
transactionSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

transactionSchema.virtual('ageInSeconds').get(function() {
  return Math.round((Date.now() - this.createdAt.getTime()) / 1000);
});

transactionSchema.virtual('amountFormatted').get(function() {
  return new Intl.NumberFormat(this.country === 'kenya' ? 'en-KE' : 'en-US', {
    style: 'currency',
    currency: this.currency,
  }).format(this.amount);
});

/**
 * Pre-save middleware
 */
transactionSchema.pre('save', function(next) {
  // If new document, add initial status to history
  if (this.isNew) {
    this.statusHistory = [{
      status: this.status,
      timestamp: this.createdAt,
    }];
  } 
  // If status has changed, add to history
  else if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      timestamp: Date.now(),
    });
  }
  
  // Auto-expire transactions if they reach certain failed states
  if (['failed', 'canceled'].includes(this.status) && !this.processedAt) {
    this.processedAt = Date.now();
  }
  
  // Mark as processed when completed
  if (this.status === 'completed' && !this.processedAt) {
    this.processedAt = Date.now();
  }
  
  next();
});

/**
 * Methods
 */
transactionSchema.methods = {
  /**
   * Add webhook attempt to transaction
   * @param {Object} webhookData - Webhook response data
   * @returns {Promise} - Updated transaction
   */
  async addWebhookAttempt(webhookData) {
    this.webhookAttempts.push({
      timestamp: Date.now(),
      url: webhookData.url,
      responseCode: webhookData.responseCode,
      responseBody: webhookData.responseBody,
      success: webhookData.success,
    });
    
    return this.save();
  },
  
  /**
   * Update transaction status with reason
   * @param {String} status - New status
   * @param {String} reason - Reason for status change
   * @param {Object} metadata - Additional metadata
   * @returns {Promise} - Updated transaction
   */
  async updateStatus(status, reason = null, metadata = {}) {
    this.status = status;
    
    this.statusHistory.push({
      status,
      timestamp: Date.now(),
      reason,
      metadata,
    });
    
    if (['completed', 'failed', 'canceled'].includes(status)) {
      this.processedAt = Date.now();
    }
    
    return this.save();
  },
  
  /**
   * Check if transaction can be retried
   * @returns {Boolean}
   */
  canBeRetried() {
    const nonRetriableStatuses = ['completed', 'expired'];
    return !nonRetriableStatuses.includes(this.status);
  },
  
  /**
   * Securely get sensitive data
   * @returns {Object} - Object with sensitive data
   */
  getSensitiveData() {
    return {
      phoneNumber: this.phoneNumber,
      amount: this.amount,
      providerTransactionId: this.providerTransactionId,
    };
  }
};

/**
 * Static methods
 */
transactionSchema.statics = {
  /**
   * Generate a secure transaction reference
   * @returns {String} - Unique transaction reference
   */
  generateReference() {
    const timestamp = Date.now().toString().slice(-6);
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `TR${timestamp}${random}`;
  },
  
  /**
   * Find transaction by provider reference
   * @param {String} providerRef - Provider reference
   * @returns {Promise} - Transaction document
   */
  findByProviderReference(providerRef) {
    return this.findOne({ 
      $or: [
        { mpesaReference: providerRef },
        { providerTransactionId: providerRef }
      ]
    });
  },
  
  /**
   * Find by business with advanced filters
   * @param {String} businessId - Business ID
   * @param {Object} filters - Query filters
   * @returns {Promise} - Array of transactions
   */
  async findByBusinessWithFilters(businessId, filters = {}) {
    const query = { business: mongoose.Types.ObjectId(businessId) };
    
    // Apply filters
    if (filters.status) query.status = filters.status;
    if (filters.transactionType) query.transactionType = filters.transactionType;
    if (filters.country) query.country = filters.country;
    if (filters.currency) query.currency = filters.currency;
    if (filters.paymentProvider) query.paymentProvider = filters.paymentProvider;
    if (filters.environment) query.environment = filters.environment;
    
    // Date range filters
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }
    
    // Amount range filters
    if (filters.minAmount || filters.maxAmount) {
      query.amount = {};
      if (filters.minAmount) query.amount.$gte = Number(filters.minAmount);
      if (filters.maxAmount) query.amount.$lte = Number(filters.maxAmount);
    }
    
    // Search by multiple fields
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { transactionId: searchRegex },
        { internalReference: searchRegex },
        { mpesaReference: searchRegex },
        { providerTransactionId: searchRegex },
        { phoneNumber: searchRegex }
      ];
    }
    
    // Set default pagination and sorting
    const limit = filters.limit ? parseInt(filters.limit, 10) : 50;
    const page = filters.page ? parseInt(filters.page, 10) : 1;
    const skip = (page - 1) * limit;
    const sortField = filters.sortField || 'createdAt';
    const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortField]: sortOrder };
    
    // Execute query with pagination
    const transactions = await this.find(query)
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .lean();
    
    // Get total count for pagination
    const total = await this.countDocuments(query);
    
    return {
      transactions,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  },
  
  /**
   * Generate comprehensive statistics for a business
   * @param {String} businessId - Business ID
   * @param {String} period - Time period (7d, 30d, 90d, 1y)
   * @param {Object} additionalFilters - Additional filters
   * @returns {Promise} - Statistics object
   */
  async generateStatistics(businessId, period = '30d', additionalFilters = {}) {
    // Determine date range based on period
    const endDate = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    // Build match criteria
    const matchCriteria = {
      business: mongoose.Types.ObjectId(businessId),
      createdAt: { $gte: startDate, $lte: endDate },
      ...additionalFilters
    };
    
    // Run aggregation pipeline
    const stats = await this.aggregate([
      {
        $match: matchCriteria
      },
      {
        $facet: {
          // Total transactions by status
          statusCounts: [
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          
          // Total transaction volume by status
          volumeByStatus: [
            { 
              $match: { 
                status: { $in: ['completed', 'pending', 'failed'] } 
              } 
            },
            { 
              $group: { 
                _id: '$status', 
                volume: { $sum: '$amount' },
                count: { $sum: 1 },
                avgAmount: { $avg: '$amount' }
              } 
            },
            { $sort: { volume: -1 } }
          ],
          
          // Transactions by country
          countryStats: [
            { 
              $group: { 
                _id: '$country', 
                count: { $sum: 1 },
                volume: { $sum: '$amount' }
              } 
            },
            { $sort: { count: -1 } }
          ],
          
          // Transactions by currency
          currencyStats: [
            { 
              $group: { 
                _id: '$currency', 
                count: { $sum: 1 },
                volume: { $sum: '$amount' }
              } 
            },
            { $sort: { volume: -1 } }
          ],
          
          // Transactions by payment provider
          providerStats: [
            { 
              $group: { 
                _id: '$paymentProvider', 
                count: { $sum: 1 },
                volume: { $sum: '$amount' }
              } 
            },
            { $sort: { count: -1 } }
          ],
          
          // Success rate over time (daily)
          dailySuccessRate: [
            {
              $group: {
                _id: {
                  date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                  status: '$status',
                },
                count: { $sum: 1 },
                volume: { $sum: '$amount' }
              },
            },
            {
              $group: {
                _id: '$_id.date',
                total: { $sum: '$count' },
                totalVolume: { $sum: '$volume' },
                completed: {
                  $sum: {
                    $cond: [{ $eq: ['$_id.status', 'completed'] }, '$count', 0],
                  },
                },
                completedVolume: {
                  $sum: {
                    $cond: [{ $eq: ['$_id.status', 'completed'] }, '$volume', 0],
                  },
                },
              },
            },
            {
              $project: {
                date: '$_id',
                total: 1,
                totalVolume: 1,
                completed: 1,
                completedVolume: 1,
                successRate: {
                  $multiply: [
                    { $cond: [{ $eq: ['$total', 0] }, 0, { $divide: ['$completed', '$total'] }] }, 
                    100
                  ],
                },
                successVolumeRate: {
                  $multiply: [
                    { $cond: [{ $eq: ['$totalVolume', 0] }, 0, { $divide: ['$completedVolume', '$totalVolume'] }] }, 
                    100
                  ],
                },
              },
            },
            { $sort: { date: 1 } },
          ],
          
          // Overall summary
          summary: [
            {
              $group: {
                _id: null,
                totalTransactions: { $sum: 1 },
                totalVolume: { $sum: '$amount' },
                avgAmount: { $avg: '$amount' },
                maxAmount: { $max: '$amount' },
                minAmount: { $min: '$amount' },
                completedCount: {
                  $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                },
                completedVolume: {
                  $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] }
                },
                failedCount: {
                  $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
                }
              }
            },
            {
              $project: {
                _id: 0,
                totalTransactions: 1,
                totalVolume: 1,
                avgAmount: 1,
                maxAmount: 1,
                minAmount: 1,
                completedCount: 1,
                completedVolume: 1,
                failedCount: 1,
                successRate: {
                  $multiply: [
                    { $divide: ['$completedCount', '$totalTransactions'] },
                    100
                  ]
                }
              }
            }
          ]
        },
      },
    ]);
    
    return stats[0];
  },
  
  /**
   * Find expired pending transactions
   * @param {Number} minutesAgo - Minutes to look back
   * @returns {Promise} - Array of expired transactions
   */
  async findExpiredPendingTransactions(minutesAgo = 30) {
    const expiryTime = new Date(Date.now() - minutesAgo * 60 * 1000);
    
    return this.find({
      status: 'pending',
      createdAt: { $lt: expiryTime },
      expiresAt: { $exists: false }
    });
  },
  
  /**
   * Get real-time transaction metrics
   * @param {String} businessId - Business ID 
   * @returns {Promise} - Real-time metrics
   */
  async getRealTimeMetrics(businessId) {
    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get metrics for today
    const todayMetrics = await this.aggregate([
      {
        $match: {
          business: mongoose.Types.ObjectId(businessId),
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          volume: { $sum: '$amount' }
        }
      }
    ]);
    
    // Get metrics for last hour
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);
    const hourlyMetrics = await this.aggregate([
      {
        $match: {
          business: mongoose.Types.ObjectId(businessId),
          createdAt: { $gte: lastHour }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          volume: { $sum: '$amount' }
        }
      }
    ]);
    
    return {
      today: todayMetrics,
      lastHour: hourlyMetrics
    };
  }
};

/**
 * Create indexes for optimized queries
 */
// Compound indexes for common query patterns
transactionSchema.index({ business: 1, status: 1, createdAt: -1 });
transactionSchema.index({ business: 1, transactionType: 1, createdAt: -1 });
transactionSchema.index({ business: 1, country: 1, createdAt: -1 });
transactionSchema.index({ business: 1, paymentProvider: 1, createdAt: -1 });

// Text index for full-text search
transactionSchema.index({ 
  transactionId: 'text', 
  internalReference: 'text',
  mpesaReference: 'text',
  providerTransactionId: 'text',
  phoneNumber: 'text'
});

// Create the Transaction model
const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;