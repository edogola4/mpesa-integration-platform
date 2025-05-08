// server/src/services/notifications/webhookService.js
const axios = require('axios');
const BaseNotificationService = require('./notificationService');
const AppError = require('../../utils/appError');
const logger = require('../../utils/logger');

/**
 * Webhook notification service
 * Handles sending webhook notifications to client systems
 */
class WebhookNotificationService extends BaseNotificationService {
  /**
   * Create a new WebhookNotificationService
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();
    this.retryAttempts = options.retryAttempts || 3;
    this.requestTimeout = options.requestTimeout || 10000; // 10 seconds
    this.httpClient = options.httpClient || axios.create({
      timeout: this.requestTimeout
    });
    logger.info('Webhook notification service initialized');
  }

  /**
   * Validate webhook notification payload
   * @param {Object} payload - The notification payload
   * @throws {AppError} - If validation fails
   */
  validate(payload) {
    if (!payload) {
      throw new AppError('Notification payload is required', 400);
    }
    
    if (!payload.url) {
      throw new AppError('Webhook URL is required', 400);
    }
    
    if (!payload.data) {
      throw new AppError('Webhook data is required', 400);
    }

    try {
      new URL(payload.url);
    } catch (error) {
      throw new AppError('Invalid webhook URL format', 400);
    }
  }

  /**
   * Send a webhook notification with retry mechanism
   * @param {Object} payload - The webhook notification payload
   * @param {string} payload.url - Webhook URL
   * @param {Object} payload.data - Data to send to the webhook
   * @param {string} [payload.method='POST'] - HTTP method
   * @param {Object} [payload.headers={}] - Additional HTTP headers
   * @returns {Promise<Object>} - The webhook sending result
   */
  async send(payload) {
    try {
      // Validate the payload
      this.validate(payload);
      
      // Prepare webhook options
      const webhookOptions = {
        method: payload.method || 'POST',
        url: payload.url,
        data: payload.data,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'M-Pesa-Integration-Platform/1.0',
          ...payload.headers
        }
      };
      
      // Add signature if available
      if (payload.signature) {
        webhookOptions.headers['X-Webhook-Signature'] = payload.signature;
      }
      
      // Send the webhook with retries
      const result = await this._sendWithRetry(webhookOptions);
      
      logger.info('Webhook notification sent successfully', {
        url: payload.url,
        method: webhookOptions.method,
        responseStatus: result.status
      });
      
      return {
        success: true,
        status: result.status,
        channel: 'webhook',
        responseData: result.data
      };
      
    } catch (error) {
      logger.error('Failed to send webhook notification', {
        error: error.message,
        url: payload.url
      });
      
      throw new AppError(`Failed to send webhook notification: ${error.message}`, 500);
    }
  }

  /**
   * Send webhook with retry mechanism
   * @param {Object} options - Webhook options
   * @returns {Promise<Object>} - The webhook response
   * @private
   */
  async _sendWithRetry(options) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        // Add attempt number to headers for debugging
        const requestOptions = {
          ...options,
          headers: {
            ...options.headers,
            'X-Attempt-Number': attempt
          }
        };
        
        // Send the webhook request
        const response = await this.httpClient(requestOptions);
        
        // Return successful response
        return response;
        
      } catch (error) {
        lastError = error;
        
        // Log retry attempt
        logger.warn(`Webhook delivery failed (attempt ${attempt}/${this.retryAttempts})`, {
          url: options.url,
          error: error.message,
          statusCode: error.response?.status
        });
        
        // If this is not the last attempt, wait before retrying
        if (attempt < this.retryAttempts) {
          // Exponential backoff: 2^attempt * 1000ms (1s, 2s, 4s, ...)
          const backoffTime = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }
    
    // If we get here, all attempts failed
    throw new AppError(`Webhook delivery failed after ${this.retryAttempts} attempts: ${lastError.message}`, 500);
  }
}

module.exports = WebhookNotificationService;