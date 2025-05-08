// server/src/services/notifications/smsService.js
const BaseNotificationService = require('./notificationService');
const AppError = require('../../utils/appError');
const logger = require('../../utils/logger');
const config = require('../../config');

/**
 * SMS notification service
 * Handles sending SMS notifications
 */
class SMSNotificationService extends BaseNotificationService {
  /**
   * Create a new SMSNotificationService
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();
    // In a real implementation, you would initialize an SMS service client here
    // such as Twilio, Africa's Talking, etc.
    this.smsClient = options.smsClient || this._createDefaultSMSClient();
    logger.info('SMS notification service initialized');
  }

  /**
   * Create a default SMS client
   * @returns {Object} - The SMS client
   * @private
   */
  _createDefaultSMSClient() {
    // In production, use a real SMS service client based on config
    // This is a placeholder implementation
    return {
      sendMessage: async (options) => {
        logger.debug('Sending SMS', { to: options.to, message: options.message });
        // In development, we might just log the SMS
        if (config.env === 'development') {
          logger.info('SMS would be sent', {
            to: options.to,
            message: options.message
          });
          return { messageId: 'dev-mode-' + Date.now() };
        }
        
        // In a real implementation, you would send the SMS here
        // For example, with Twilio:
        // return await this.twilioClient.messages.create({
        //   body: options.message,
        //   from: config.sms.fromNumber,
        //   to: options.to
        // });
        
        // Simulated response
        return { messageId: 'mock-sms-id-' + Date.now() };
      }
    };
  }

  /**
   * Validate SMS notification payload
   * @param {Object} payload - The notification payload
   * @throws {AppError} - If validation fails
   */
  validate(payload) {
    if (!payload) {
      throw new AppError('Notification payload is required', 400);
    }
    
    if (!payload.to) {
      throw new AppError('Recipient phone number is required', 400);
    }
    
    if (!payload.message) {
      throw new AppError('SMS message content is required', 400);
    }

    // Additional validation could be added here
    // (e.g., phone number format validation)
  }

  /**
   * Send an SMS notification
   * @param {Object} payload - The SMS notification payload
   * @param {string} payload.to - Recipient phone number
   * @param {string} payload.message - SMS message content
   * @param {string} [payload.from] - Sender phone number or ID (optional, uses default if not provided)
   * @returns {Promise<Object>} - The SMS sending result
   */
  async send(payload) {
    try {
      // Validate the payload
      this.validate(payload);
      
      // Prepare SMS options
      const smsOptions = {
        to: payload.to,
        message: payload.message,
        from: payload.from || config.sms.defaultFrom
      };
      
      // Send the SMS
      const result = await this.smsClient.sendMessage(smsOptions);
      
      logger.info('SMS notification sent successfully', {
        to: payload.to,
        messageId: result.messageId
      });
      
      return {
        success: true,
        messageId: result.messageId,
        channel: 'sms'
      };
      
    } catch (error) {
      logger.error('Failed to send SMS notification', {
        error: error.message,
        to: payload.to
      });
      
      throw new AppError(`Failed to send SMS notification: ${error.message}`, 500);
    }
  }
}

module.exports = SMSNotificationService;