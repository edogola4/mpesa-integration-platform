// server/src/services/transactions/webhookService.js

const Business = require('../../models/business');
const Transaction = require('../../models/transaction');
const AppError = require('../../utils/appError');
const logger = require('../../utils/logger');
const axios = require('axios');
const transactionService = require('./transactionService');

/**
 * Service for handling webhook operations
 */
class WebhookService {
  /**
   * Handle M-Pesa callback for a transaction
   * 
   * @param {string} transactionId - Transaction ID
   * @param {Object} callbackData - Callback data from M-Pesa
   * @returns {Promise<Object>} Result of callback processing
   */
  async handleMpesaCallback(transactionId, callbackData) {
    logger.info(`Received M-Pesa callback for transaction ${transactionId}`, { callbackData });
    
    try {
      // Process the callback with the transaction service
      const updatedTransaction = await transactionService.processCallback(
        transactionId,
        callbackData
      );
      
      // Forward the callback to the business webhook if configured
      await this._forwardCallbackToBusiness(updatedTransaction);
      
      return {
        success: true,
        message: 'Callback processed successfully'
      };
    } catch (error) {
      logger.error('Error processing M-Pesa callback', {
        error,
        transactionId,
        callbackData
      });
      
      throw new AppError('Failed to process callback: ' + error.message, 500);
    }
  }
  
  /**
   * Configure webhook URL for a business
   * 
   * @param {string} businessId - Business ID
   * @param {string} webhookUrl - Webhook URL
   * @returns {Promise<Object>} Updated business data
   */
  async configureWebhook(businessId, webhookUrl) {
    logger.info(`Configuring webhook for business ${businessId}: ${webhookUrl}`);
    
    // Validate webhook URL
    if (!this._isValidUrl(webhookUrl)) {
      throw new AppError('Invalid webhook URL', 400);
    }
    
    try {
      // Update business with new webhook URL
      const business = await Business.findByIdAndUpdate(
        businessId,
        { webhookUrl },
        { new: true }
      );
      
      if (!business) {
        throw new AppError('Business not found', 404);
      }
      
      return {
        success: true,
        webhookUrl: business.webhookUrl
      };
    } catch (error) {
      logger.error('Error configuring webhook', { error, businessId, webhookUrl });
      throw new AppError('Failed to configure webhook: ' + error.message, 500);
    }
  }
  
  /**
   * Test a configured webhook
   * 
   * @param {string} businessId - Business ID
   * @returns {Promise<Object>} Test result
   */
  async testWebhook(businessId) {
    logger.info(`Testing webhook for business ${businessId}`);
    
    // Get business with webhook URL
    const business = await Business.findById(businessId);
    
    if (!business) {
      throw new AppError('Business not found', 404);
    }
    
    if (!business.webhookUrl) {
      throw new AppError('Webhook URL not configured', 400);
    }
    
    try {
      // Create test payload
      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        business: businessId,
        testId: Date.now().toString()
      };
      
      // Send test request
      const response = await this._sendWebhook(business.webhookUrl, testPayload);
      
      return {
        success: true,
        statusCode: response.status,
        responseTime: response.responseTime,
        message: 'Webhook test successful'
      };
    } catch (error) {
      logger.error('Webhook test failed', { error, businessId });
      
      return {
        success: false,
        error: error.message,
        message: 'Webhook test failed'
      };
    }
  }
  
  /**
   * Forward a callback to the business webhook
   * 
   * @private
   * @param {Object} transaction - Transaction document
   * @returns {Promise<void>}
   */
  async _forwardCallbackToBusiness(transaction) {
    try {
      // Get business details including webhook URL
      const business = await Business.findById(transaction.business);
      
      if (!business || !business.webhookUrl) {
        logger.info(`No webhook URL configured for business ${transaction.business}`);
        return;
      }
      
      // Prepare payload
      const payload = {
        event: 'transaction.updated',
        timestamp: new Date().toISOString(),
        data: {
          transactionId: transaction._id,
          status: transaction.status,
          amount: transaction.amount,
          currency: transaction.currency,
          phoneNumber: transaction.phoneNumber,
          reference: transaction.internalReference,
          mpesaReference: transaction.mpesaReference,
          country: transaction.country,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt
        }
      };
      
      // Send webhook
      await this._sendWebhook(business.webhookUrl, payload);
      
      logger.info(`Webhook sent to business ${transaction.business} for transaction ${transaction._id}`);
    } catch (error) {
      logger.error('Error forwarding callback to business', {
        error,
        transactionId: transaction._id,
        businessId: transaction.business
      });
      // We don't throw here to avoid disrupting the main flow
    }
  }
  
  /**
   * Send webhook to specified URL
   * 
   * @private
   * @param {string} url - Webhook URL
   * @param {Object} payload - Webhook payload
   * @returns {Promise<Object>} Response from webhook
   */
  async _sendWebhook(url, payload) {
    const startTime = Date.now();
    
    try {
      // Add signature for security
      const signature = this._generateSignature(payload);
      
      // Send request with timeout
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature
        },
        timeout: 10000 // 10 seconds timeout
      });
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      
      return {
        status: response.status,
        data: response.data,
        responseTime
      };
    } catch (error) {
      // Add response time even to errors
      error.responseTime = Date.now() - startTime;
      throw error;
    }
  }
  
  /**
   * Generate signature for webhook payload
   * 
   * @private
   * @param {Object} payload - Webhook payload
   * @returns {string} Signature
   */
  _generateSignature(payload) {
    // In a real implementation, we would:
    // 1. Use a secure hashing algorithm (HMAC-SHA256)
    // 2. Use a secret key specific to each business
    // 3. Create a signature based on the payload
    
    // This is a placeholder
    return 'signature-placeholder';
  }
  
  /**
   * Validate a URL
   * 
   * @private
   * @param {string} url - URL to validate
   * @returns {boolean} Whether the URL is valid
   */
  _isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }
}