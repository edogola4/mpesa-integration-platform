// server/src/models/transaction.model.js
const mongoose = require('mongoose');

// Status history schema (as a sub-document)
const statusHistorySchema = new mongoose.Schema({
  status: { 
    type: String,
    required: true,
    enum: [
      'initiated', 
      'pending', 
      'processing',
      'completed', 
      'failed', 
      'canceled', 
      'expired',
      'reversed'
    ]
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  metadata: { 
    type: Object 
  },
  reason: {
    type: String
  }
});

// Transaction schema
const transactionSchema = new mongoose.Schema({
  business: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Business', 
    required: true 
  },
  transactionType: { 
    type: String, 
    enum: ['payment', 'refund', 'reversal', 'balance'], 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true,
    min: [1, 'Amount must be at least 1']
  },
  currency: { 
    type: String, 
    required: true,
    uppercase: true
  },
  country: { 
    type: String, 
    required: true,
    enum: ['kenya', 'tanzania', 'uganda', 'rwanda', 'mozambique', 'drc'],
    lowercase: true
  },
  phoneNumber: { 
    type: String, 
    required: true,
    match: [/^\+?[0-9]+$/, 'Phone number can only contain numbers and an optional + prefix']
  },
  mpesaReference: { 
    type: String
  },
  internalReference: { 
    type: String, 
    required: true,
    unique: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [100, 'Description cannot be longer than 100 characters']
  },
  status: { 
    type: String, 
    enum: [
      'initiated', 
      'pending', 
      'processing',
      'completed', 
      'failed', 
      'canceled', 
      'expired',
      'reversed'
    ],
    default: 'initiated'
  },
  statusHistory: [statusHistorySchema],
  callbackData: { 
    type: Object 
  },
  requestPayload: { 
    type: Object 
  },
  responsePayload: { 
    type: Object 
  },
  errorDetails: {
    type: Object
  },
  callbackUrl: {
    type: String
  },
  metadata: { 
    type: Object 
  },
  apiKey: {
    type: String
  },
  isTest: {
    type: Boolean,
    default: false
  },
  processedAt: {
    type: Date
  },
  completedAt: {
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
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  timestamps: true
});

// Indexes for common queries
transactionSchema.index({ business: 1, createdAt: -1 });
transactionSchema.index({ internalReference: 1 }, { unique: true });
transactionSchema.index({ mpesaReference: 1 });
transactionSchema.index({ status: 1, business: 1 });
transactionSchema.index({ phoneNumber: 1, business: 1 });

/**
 * Update transaction status and add to status history
 * @param {string} status - New status
 * @param {object} metadata - Additional metadata
 * @param {string} reason - Reason for status change
 */
transactionSchema.methods.updateStatus = function(status, metadata = {}, reason = '') {
  this.status = status;
  
  // Add to status history
  this.statusHistory.push({
    status,
    timestamp: Date.now(),
    metadata,
    reason
  });
  
  // Update timestamps based on status
  if (status === 'completed') {
    this.completedAt = Date.now();
  } else if (status === 'processing' || status === 'pending') {
    this.processedAt = Date.now();
  }
  
  // Always update updatedAt
  this.updatedAt = Date.now();
};

// Update the updatedAt field on save
transactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for duration
transactionSchema.virtual('duration').get(function() {
  if (!this.completedAt) return null;
  return this.completedAt - this.createdAt;
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;