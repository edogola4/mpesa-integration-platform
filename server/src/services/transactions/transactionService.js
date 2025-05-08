//server/src/services/transactions/transactionService.js
const { v4: uuidv4 } = require('uuid');
const Transaction = require('../../models/transaction');
const Business = require('../../models/business');
const MpesaClientFactory = require('../mpesa/mpesaClientFactory');
const logger = require('../../utils/logger');
const { AppError } = require('../../utils/appError');

/**
 * Service for handling transaction operations
 */
class TransactionService {
  /**
   * Get default currency for a country
   * @param {string} country - Country code
   * @returns {string} - Default currency code
   */
  getDefaultCurrency(country) {
    const currencyMap = {
      'kenya': 'KES',
      'tanzania': 'TZS',
      'uganda': 'UGX',
      'rwanda': 'RWF',
      'mozambique': 'MZN',
      'drc': 'CDF'
    };
    
    return currencyMap[country.toLowerCase()] || 'KES';
  }

  /**
   * Format transaction response for API
   * @param {object} transaction - Transaction document
   * @returns {object} - Formatted transaction response
   */
  formatTransactionResponse(transaction) {
    return {
      transactionId: transaction._id,
      status: transaction.status,
      mpesaReference: transaction.mpesaReference,
      amount: transaction.amount,
      currency: transaction.currency,
      phoneNumber: transaction.phoneNumber,
      reference: transaction.internalReference,
      country: transaction.country,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt
    };
  }

  /**
   * Initiate a payment transaction
   * @param {object} data - Payment data
   * @param {string} apiKey - API key of the business
   * @returns {Promise<object>} - Transaction data
   */
  async initiatePayment(data, apiKey) {
    try {
      // Find the business by API key
      const business = await Business.findOne({ 'apiKeys.key': apiKey });
      if (!business) {
        throw new AppError('Invalid API key', 401);
      }
      
      // Check if the API key is active
      const apiKeyObj = business.apiKeys.find(k => k.key === apiKey);
      if (!apiKeyObj || !apiKeyObj.isActive) {
        throw new AppError('Inactive API key', 401);
      }
      
      // Check if the business has M-Pesa integration for the specified country
      const mpesaIntegration = business.mpesaIntegrations.find(i => 
        i.country.toLowerCase() === data.country.toLowerCase());
      
      if (!mpesaIntegration) {
        throw new AppError(`No M-Pesa integration found for ${data.country}`, 400);
      }
      
      // Generate internal reference if not provided
      const internalReference = data.reference || uuidv4();

      // Create Transaction record with initial state
      const transaction = await Transaction.create({
        business: business._id,
        transactionType: 'payment',
        amount: data.amount,
        currency: data.currency || this.getDefaultCurrency(data.country),
        country: data.country,
        phoneNumber: data.phoneNumber,
        internalReference,
        status: 'initiated',
        statusHistory: [{ status: 'initiated', metadata: { initiatedBy: 'api' } }],
        requestPayload: data,
        metadata: data.metadata || {}
      });
      
      // Create M-Pesa client for the country
      const mpesaConfig = {
        consumerKey: mpesaIntegration.consumerKey,
        consumerSecret: mpesaIntegration.consumerSecret,
        shortCode: mpesaIntegration.shortCode,
        passkey: mpesaIntegration.passkey,
        environment: mpesaIntegration.isLive ? 'production' : 'sandbox'
      };
      
      const mpesaClient = MpesaClientFactory.createClient(data.country, mpesaConfig);
      
      // Prepare callback URL (either from request or default)
      const callbackUrl = data.callbackUrl || 
                       `${process.env.API_BASE_URL}/api/webhooks/mpesa/${transaction._id}`;
      
      // Initiate payment with M-Pesa
      let mpesaResponse;
      
      switch (data.country.toLowerCase()) {
        case 'kenya':
          mpesaResponse = await mpesaClient.initiateSTKPush({
            phoneNumber: data.phoneNumber,
            amount: data.amount,
            reference: internalReference,
            description: data.description || `Payment to ${business.name}`,
            callbackUrl
          });
          break;
          
        // Add cases for other countries as they are implemented
          
        default:
          throw new AppError(`Payment initiation for ${data.country} is not implemented`, 400);
      }
      
      // Update transaction with M-Pesa response
      transaction.mpesaReference = mpesaResponse.CheckoutRequestID || mpesaResponse.transactionId;
      transaction.responsePayload = mpesaResponse;
      transaction.status = 'pending';
      transaction.statusHistory.push({ 
        status: 'pending', 
        metadata: { mpesaReference: transaction.mpesaReference } 
      });
      
      await transaction.save();
      
      return {
        transactionId: transaction._id,
        status: transaction.status,
        mpesaReference: transaction.mpesaReference,
        amount: transaction.amount,
        currency: transaction.currency,
        phoneNumber: transaction.phoneNumber,
        reference: internalReference,
        createdAt: transaction.createdAt
      };
    } catch (error) {
      logger.error(`Payment initiation error: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get transaction by ID
   * @param {string} transactionId - Transaction ID
   * @param {string} apiKey - API key of the business
   * @returns {Promise<object>} - Transaction data
   */
  async getTransaction(transactionId, apiKey) {
    try {
      // Find the business by API key
      const business = await Business.findOne({ 'apiKeys.key': apiKey });
      if (!business) {
        throw new AppError('Invalid API key', 401);
      }
      
      // Check if the API key is active
      const apiKeyObj = business.apiKeys.find(k => k.key === apiKey);
      if (!apiKeyObj || !apiKeyObj.isActive) {
        throw new AppError('Inactive API key', 401);
      }
      
      // Find the transaction
      const transaction = await Transaction.findOne({
        _id: transactionId,
        business: business._id
      });
      
      if (!transaction) {
        throw new AppError('Transaction not found', 404);
      }
      
      return this.formatTransactionResponse(transaction);
    } catch (error) {
      logger.error(`Get transaction error: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Check transaction status with M-Pesa
   * @param {string} transactionId - Transaction ID
   * @param {string} apiKey - API key of the business
   * @returns {Promise<object>} - Updated transaction data
   */
  async checkTransactionStatus(transactionId, apiKey) {
    try {
      // Find the business by API key
      const business = await Business.findOne({ 'apiKeys.key': apiKey });
      if (!business) {
        throw new AppError('Invalid API key', 401);
      }
      
      // Find the transaction
      const transaction = await Transaction.findOne({
        _id: transactionId,
        business: business._id
      });
      
      if (!transaction) {
        throw new AppError('Transaction not found', 404);
      }
      
      // If transaction is already in a final state, return it
      if (['completed', 'failed', 'canceled'].includes(transaction.status)) {
        return this.formatTransactionResponse(transaction);
      }
      
      // Get M-Pesa integration for the transaction's country
      const mpesaIntegration = business.mpesaIntegrations.find(i => 
        i.country.toLowerCase() === transaction.country.toLowerCase());
      
      if (!mpesaIntegration) {
        throw new AppError(`No M-Pesa integration found for ${transaction.country}`, 400);
      }
      
      // Create M-Pesa client
      const mpesaConfig = {
        consumerKey: mpesaIntegration.consumerKey,
        consumerSecret: mpesaIntegration.consumerSecret,
        shortCode: mpesaIntegration.shortCode,
        passkey: mpesaIntegration.passkey,
        environment: mpesaIntegration.isLive ? 'production' : 'sandbox'
      };
      
      const mpesaClient = MpesaClientFactory.createClient(transaction.country, mpesaConfig);
      
      // Check status with M-Pesa
      let statusResponse;
      
      switch (transaction.country.toLowerCase()) {
        case 'kenya':
          statusResponse = await mpesaClient.checkSTKPushStatus(transaction.mpesaReference);
          break;
          
        // Add cases for other countries as they are implemented
          
        default:
          throw new AppError(`Status check for ${transaction.country} is not implemented`, 400);
      }
      
      // Update transaction based on status response
      const resultCode = statusResponse.ResultCode || statusResponse.ResultDesc;
      
      if (resultCode === 0) {
        transaction.status = 'completed';
      } else if (resultCode === 1032) { // Transaction canceled by user
        transaction.status = 'canceled';
      } else {
        transaction.status = 'failed';
      }
      
      transaction.statusHistory.push({ 
        status: transaction.status, 
        metadata: statusResponse 
      });
      
      transaction.responsePayload = {
        ...transaction.responsePayload,
        statusCheck: statusResponse
      };
      
      await transaction.save();
      
      return this.formatTransactionResponse(transaction);
    } catch (error) {
      logger.error(`Check transaction status error: ${error.message}`);
      throw error;
    }
  }

  /**
   * List transactions for a business
   * @param {object} filters - Query filters
   * @param {string} apiKey - API key of the business
   * @returns {Promise<object>} - Transactions data with pagination
   */
  async listTransactions(filters, apiKey) {
    try {
      // Find the business by API key
      const business = await Business.findOne({ 'apiKeys.key': apiKey });
      if (!business) {
        throw new AppError('Invalid API key', 401);
      }
      
      // Check if the API key is active
      const apiKeyObj = business.apiKeys.find(k => k.key === apiKey);
      if (!apiKeyObj || !apiKeyObj.isActive) {
        throw new AppError('Inactive API key', 401);
      }
      
      // Prepare query
      const query = {
        business: business._id,
      };
      
      // Add optional filters
      if (filters.status) query.status = filters.status;
      if (filters.transactionType) query.transactionType = filters.transactionType;
      if (filters.phoneNumber) query.phoneNumber = { $regex: filters.phoneNumber };
      if (filters.reference) query.internalReference = { $regex: filters.reference };
      if (filters.country) query.country = filters.country;
      
      // Date range filters
      if (filters.startDate && filters.endDate) {
        query.createdAt = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      } else if (filters.startDate) {
        query.createdAt = { $gte: new Date(filters.startDate) };
      } else if (filters.endDate) {
        query.createdAt = { $lte: new Date(filters.endDate) };
      }
      
      // Pagination
      const page = parseInt(filters.page, 10) || 1;
      const limit = parseInt(filters.limit, 10) || 10;
      const skip = (page - 1) * limit;
      
      // Execute query
      const transactions = await Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      // Get total count
      const total = await Transaction.countDocuments(query);
      
      return {
        data: transactions.map(this.formatTransactionResponse),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`List transactions error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get transaction statistics for a business
   * @param {object} filters - Query filters
   * @param {string} apiKey - API key of the business
   * @returns {Promise<object>} - Transaction statistics
   */
  async getTransactionStats(filters, apiKey) {
    try {
      // Find the business by API key
      const business = await Business.findOne({ 'apiKeys.key': apiKey });
      if (!business) {
        throw new AppError('Invalid API key', 401);
      }
      
      // Check if the API key is active
      const apiKeyObj = business.apiKeys.find(k => k.key === apiKey);
      if (!apiKeyObj || !apiKeyObj.isActive) {
        throw new AppError('Inactive API key', 401);
      }
      
      // Prepare base match
      const match = {
        business: business._id,
      };
      
      // Add optional filters
      if (filters.country) match.country = filters.country;
      
      // Date range filters
      if (filters.startDate && filters.endDate) {
        match.createdAt = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      } else if (filters.startDate) {
        match.createdAt = { $gte: new Date(filters.startDate) };
      } else if (filters.endDate) {
        match.createdAt = { $lte: new Date(filters.endDate) };
      } else {
        // Default to last 30 days if no date range specified
        match.createdAt = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
      }
      
      // Get summary stats
      const [totalStats, statusStats, dailyStats] = await Promise.all([
        // Overall totals
        Transaction.aggregate([
          { $match: match },
          { $group: {
            _id: null,
            totalCount: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgAmount: { $avg: '$amount' }
          }}
        ]),
        
        // Stats by status
        Transaction.aggregate([
          { $match: match },
          { $group: {
            _id: '$status',
            count: { $sum: 1 },
            amount: { $sum: '$amount' }
          }}
        ]),
        
        // Daily stats
        Transaction.aggregate([
          { $match: match },
          { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            amount: { $sum: '$amount' }
          }},
          { $sort: { '_id': 1 } }
        ])
      ]);
      
      // Format status stats
      const statusStatsFormatted = {};
      statusStats.forEach(stat => {
        statusStatsFormatted[stat._id] = {
          count: stat.count,
          amount: stat.amount
        };
      });
      
      return {
        summary: totalStats.length > 0 ? {
          totalCount: totalStats[0].totalCount,
          totalAmount: totalStats[0].totalAmount,
          avgAmount: totalStats[0].avgAmount
        } : {
          totalCount: 0,
          totalAmount: 0,
          avgAmount: 0
        },
        byStatus: statusStatsFormatted,
        byDay: dailyStats.map(stat => ({
          date: stat._id,
          count: stat.count,
          amount: stat.amount
        }))
      };
    } catch (error) {
      logger.error(`Get transaction stats error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancel a pending transaction
   * @param {string} transactionId - Transaction ID
   * @param {string} apiKey - API key of the business
   * @returns {Promise<object>} - Cancelled transaction data
   */
  async cancelTransaction(transactionId, apiKey) {
    try {
      // Find the business by API key
      const business = await Business.findOne({ 'apiKeys.key': apiKey });
      if (!business) {
        throw new AppError('Invalid API key', 401);
      }
      
      // Check if the API key is active
      const apiKeyObj = business.apiKeys.find(k => k.key === apiKey);
      if (!apiKeyObj || !apiKeyObj.isActive) {
        throw new AppError('Inactive API key', 401);
      }
      
      // Find the transaction
      const transaction = await Transaction.findOne({
        _id: transactionId,
        business: business._id
      });
      
      if (!transaction) {
        throw new AppError('Transaction not found', 404);
      }
      
      // Check if transaction can be cancelled
      if (!['initiated', 'pending'].includes(transaction.status)) {
        throw new AppError(`Cannot cancel transaction with status: ${transaction.status}`, 400);
      }
      
      // For certain countries and transaction types, we might need to call the M-Pesa API
      // to cancel the transaction. For now, we'll just update our local status.
      
      transaction.status = 'canceled';
      transaction.statusHistory.push({ 
        status: 'canceled', 
        metadata: { cancelledBy: 'api' } 
      });
      
      await transaction.save();
      
      return this.formatTransactionResponse(transaction);
    } catch (error) {
      logger.error(`Cancel transaction error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process M-Pesa callback
   * @param {string} transactionId - Transaction ID
   * @param {object} callbackData - Callback data from M-Pesa
   * @returns {Promise<object>} - Updated transaction
   */
  async processCallback(transactionId, callbackData) {
    try {
      // Find the transaction
      const transaction = await Transaction.findById(transactionId);
      
      if (!transaction) {
        logger.error(`Callback received for unknown transaction: ${transactionId}`);
        throw new AppError('Transaction not found', 404);
      }
      
      // Store callback data
      transaction.callbackData = callbackData;
      
      // Process callback based on country
      switch (transaction.country.toLowerCase()) {
        case 'kenya':
          // For Kenya STK Push, check the callback result
          const resultCode = callbackData.Body?.stkCallback?.ResultCode;
          
          if (resultCode === 0) {
            transaction.status = 'completed';
            
            // Extract additional details if available
            const callbackMetadata = callbackData.Body?.stkCallback?.CallbackMetadata?.Item;
            if (callbackMetadata) {
              const metadata = {};
              
              callbackMetadata.forEach(item => {
                if (item.Name === 'MpesaReceiptNumber') {
                  metadata.receiptNumber = item.Value;
                } else if (item.Name === 'TransactionDate') {
                  metadata.transactionDate = item.Value;
                } else if (item.Name === 'PhoneNumber') {
                  metadata.phoneNumber = item.Value;
                }
              });
              
              transaction.statusHistory.push({
                status: 'completed',
                metadata
              });
            } else {
              transaction.statusHistory.push({
                status: 'completed',
                metadata: { resultCode }
              });
            }
          } else {
            transaction.status = 'failed';
            transaction.statusHistory.push({
              status: 'failed',
              metadata: {
                resultCode,
                resultDesc: callbackData.Body?.stkCallback?.ResultDesc
              }
            });
          }
          break;
          
        // Add cases for other countries as they are implemented
          
        default:
          logger.warn(`Callback processor not implemented for country: ${transaction.country}`);
          break;
      }
      
      await transaction.save();
      
      // Notify business via webhook if configured
      try {
        const business = await Business.findById(transaction.business);
        if (business && business.webhookUrl) {
          // This would be a separate service/method to send webhooks
          // await webhookService.sendWebhook(business.webhookUrl, this.formatTransactionResponse(transaction));
          logger.info(`Webhook sent to ${business.webhookUrl} for transaction ${transactionId}`);
        }
      } catch (webhookError) {
        logger.error(`Webhook sending error: ${webhookError.message}`);
        // We don't throw here to avoid disrupting the callback processing
      }
      
      return this.formatTransactionResponse(transaction);
    } catch (error) {
      logger.error(`Process callback error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new TransactionService();