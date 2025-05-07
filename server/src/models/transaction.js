const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    unique: true,
    default: () => `txn_${uuidv4().replace(/-/g, '')}`,
  },
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
  },
  transactionType: {
    type: String,
    enum: ['payment', 'refund', 'reversal'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
    enum: ['kenya', 'tanzania', 'uganda', 'rwanda', 'mozambique', 'drc'],
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
  },
  mpesaReference: {
    type: String,
    sparse: true,
  },
  internalReference: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ['initiated', 'pending', 'completed', 'failed', 'canceled', 'expired'],
    default: 'initiated',
  },
  statusHistory: [{
    status: {
      type: String,
      enum: ['initiated', 'pending', 'completed', 'failed', 'canceled', 'expired'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: Object,
    },
  }],
  callbackData: {
    type: Object,
  },
  requestPayload: {
    type: Object,
  },
  responsePayload: {
    type: Object,
  },
  metadata: {
    type: Object,
  },
  webhookAttempts: [{
    timestamp: Date,
    response: Object,
    success: Boolean,
  }],
  environment: {
    type: String,
    enum: ['sandbox', 'production'],
    default: 'sandbox',
  },
  expiresAt: {
    type: Date,
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
 * Add status to history when status changes
 */
transactionSchema.pre('save', function (next) {
  // Update the updatedAt timestamp
  this.updatedAt = Date.now();
  
  // If it's a new document, add the initial status to history
  if (this.isNew) {
    this.statusHistory = [{
      status: this.status,
      timestamp: this.createdAt,
    }];
    return next();
  }
  
  // If status has changed, add to history
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      timestamp: Date.now(),
    });
  }
  
  next();
});

/**
 * Find transaction by M-Pesa reference
 */
transactionSchema.statics.findByMpesaReference = function (mpesaReference) {
  return this.findOne({ mpesaReference });
};

/**
 * Find transactions for a business with filters
 */
transactionSchema.statics.findByBusinessWithFilters = function (businessId, filters = {}) {
  const query = { business: businessId };
  
  // Apply filters
  if (filters.status) query.status = filters.status;
  if (filters.transactionType) query.transactionType = filters.transactionType;
  if (filters.country) query.country = filters.country;
  if (filters.startDate && filters.endDate) {
    query.createdAt = {
      $gte: new Date(filters.startDate),
      $lte: new Date(filters.endDate),
    };
  }
  
  // Search by reference or phone number
  if (filters.search) {
    query.$or = [
      { transactionId: { $regex: filters.search, $options: 'i' } },
      { mpesaReference: { $regex: filters.search, $options: 'i' } },
      { internalReference: { $regex: filters.search, $options: 'i' } },
      { phoneNumber: { $regex: filters.search, $options: 'i' } },
    ];
  }
  
  return this.find(query)
    .sort({ createdAt: filters.sortOrder === 'asc' ? 1 : -1 })
    .limit(filters.limit || 50)
    .skip(filters.offset || 0);
};

/**
 * Generate transaction statistics for a business
 */
transactionSchema.statics.generateStatistics = async function (businessId, period = '30d') {
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
  
  // Run aggregation pipeline
  const stats = await this.aggregate([
    {
      $match: {
        business: mongoose.Types.ObjectId(businessId),
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $facet: {
        // Total transactions by status
        statusCounts: [
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ],
        // Total transaction volume by status
        volumeByStatus: [
          { $match: { status: { $in: ['completed', 'pending', 'failed'] } } },
          { $group: { _id: '$status', volume: { $sum: '$amount' } } },
        ],
        // Transactions by country
        countryStats: [
          { $group: { _id: '$country', count: { $sum: 1 } } },
        ],
        // Success rate over time
        dailySuccessRate: [
          {
            $group: {
              _id: {
                date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                status: '$status',
              },
              count: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: '$_id.date',
              total: { $sum: '$count' },
              completed: {
                $sum: {
                  $cond: [{ $eq: ['$_id.status', 'completed'] }, '$count', 0],
                },
              },
            },
          },
          {
            $project: {
              date: '$_id',
              total: 1,
              completed: 1,
              successRate: {
                $multiply: [{ $divide: ['$completed', '$total'] }, 100],
              },
            },
          },
          { $sort: { date: 1 } },
        ],
      },
    },
  ]);
  
  return stats[0];
};

// Create the Transaction model
const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;