// server/src/services/notifications/notificationManager.js
const EmailNotificationService = require('./emailService');
const SMSNotificationService = require('./smsService');
const WebhookNotificationService = require('./webhookService');
const AppError = require('../../utils/appError');
const logger = require('../../utils/logger');

/**
 * Notification Manager
 * Coordinates different notification channels and provides a unified interface
 */
class NotificationManager {
  /**
   * Create a new NotificationManager
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    // Initialize notification services
    this.services = {};
    
    // Set up email service
    this.services.email = options.emailService || new EmailNotificationService(options.emailOptions);
    
    // Set up SMS service
    this.services.sms = options.smsService || new SMSNotificationService(options.smsOptions);
    
    // Set up webhook service
    this.services.webhook = options.webhookService || new WebhookNotificationService(options.webhookOptions);
    
    logger.info('Notification manager initialized');
  }

  /**
   * Send a notification through a specific channel
   * @param {string} channel - The notification channel ('email', 'sms', 'webhook')
   * @param {Object} payload - The notification payload
   * @returns {Promise<Object>} - The notification result
   */
  async send(channel, payload) {
    if (!this.services[channel]) {
      throw new AppError(`Unsupported notification channel: ${channel}`, 400);
    }
    
    return await this.services[channel].send(payload);
  }

  /**
   * Send an email notification
   * @param {Object} payload - The email notification payload
   * @returns {Promise<Object>} - The notification result
   */
  async sendEmail(payload) {
    return await this.send('email', payload);
  }

  /**
   * Send an SMS notification
   * @param {Object} payload - The SMS notification payload
   * @returns {Promise<Object>} - The notification result
   */
  async sendSMS(payload) {
    return await this.send('sms', payload);
  }

  /**
   * Send a webhook notification
   * @param {Object} payload - The webhook notification payload
   * @returns {Promise<Object>} - The notification result
   */
  async sendWebhook(payload) {
    return await this.send('webhook', payload);
  }

  /**
   * Send multiple notifications
   * @param {Array<Object>} notifications - Array of notification objects
   * @param {string} notifications[].channel - The notification channel
   * @param {Object} notifications[].payload - The notification payload
   * @returns {Promise<Array<Object>>} - Array of notification results
   */
  async sendMultiple(notifications) {
    if (!Array.isArray(notifications)) {
      throw new AppError('Notifications must be an array', 400);
    }
    
    const results = [];
    const errors = [];
    
    // Send all notifications in parallel
    const promises = notifications.map(async (notification, index) => {
      try {
        const result = await this.send(notification.channel, notification.payload);
        results[index] = {
          success: true,
          channel: notification.channel,
          result
        };
      } catch (error) {
        errors.push(error);
        results[index] = {
          success: false,
          channel: notification.channel,
          error: error.message
        };
      }
    });
    
    await Promise.all(promises);
    
    if (errors.length > 0) {
      logger.warn(`${errors.length}/${notifications.length} notifications failed to send`);
    }
    
    return results;
  }

  /**
   * Send a transaction notification to relevant parties
   * @param {string} event - The transaction event type (e.g., 'created', 'completed', 'failed')
   * @param {Object} transaction - The transaction object
   * @param {Object} business - The business object
   * @returns {Promise<Array<Object>>} - Array of notification results
   */
  async sendTransactionNotification(event, transaction, business) {
    logger.debug('Sending transaction notification', { event, transactionId: transaction._id });
    
    const notifications = [];
    
    // Prepare common transaction data
    const transactionData = {
      id: transaction._id,
      reference: transaction.internalReference,
      mpesaReference: transaction.mpesaReference,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      timestamp: new Date().toISOString(),
      event
    };
    
    // Add webhook notification if business has webhook URL configured
    if (business.webhookUrl) {
      notifications.push({
        channel: 'webhook',
        payload: {
          url: business.webhookUrl,
          data: {
            event: `transaction.${event}`,
            data: transactionData
          }
        }
      });
    }
    
    // Add email notification if business has notification email configured
    if (business.notificationEmail) {
      notifications.push({
        channel: 'email',
        payload: {
          to: business.notificationEmail,
          subject: `Transaction ${event.toUpperCase()}: ${transaction.internalReference}`,
          html: this._generateTransactionEmailHtml(event, transaction, business),
          text: this._generateTransactionEmailText(event, transaction, business)
        }
      });
    }
    
    // Add SMS notification if business has notification phone configured
    // and the event is important enough to warrant an SMS
    if (business.notificationPhone && ['completed', 'failed'].includes(event)) {
      notifications.push({
        channel: 'sms',
        payload: {
          to: business.notificationPhone,
          message: this._generateTransactionSmsText(event, transaction, business)
        }
      });
    }
    
    // Send all notifications
    if (notifications.length > 0) {
      return await this.sendMultiple(notifications);
    } else {
      logger.info('No notification channels configured for this business');
      return [];
    }
  }

  /**
   * Generate HTML content for transaction email
   * @param {string} event - The transaction event
   * @param {Object} transaction - The transaction object
   * @param {Object} business - The business object
   * @returns {string} - HTML content for the email
   * @private
   */
  _generateTransactionEmailHtml(event, transaction, business) {
    const statusColors = {
      completed: '#28a745',
      failed: '#dc3545',
      pending: '#ffc107',
      initiated: '#17a2b8'
    };
    
    const statusColor = statusColors[transaction.status] || '#6c757d';
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Transaction ${event.toUpperCase()}</h2>
        <p>Your M-Pesa transaction has been ${event}.</p>
        
        <div style="border: 1px solid #ddd; border-radius: 4px; padding: 15px; margin-top: 20px;">
          <h3 style="margin-top: 0;">Transaction Details</h3>
          <p><strong>Reference:</strong> ${transaction.internalReference}</p>
          <p><strong>M-Pesa Reference:</strong> ${transaction.mpesaReference || 'Not available yet'}</p>
          <p><strong>Amount:</strong> ${transaction.amount} ${transaction.currency}</p>
          <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${transaction.status.toUpperCase()}</span></p>
          <p><strong>Phone Number:</strong> ${transaction.phoneNumber}</p>
          <p><strong>Transaction Type:</strong> ${transaction.transactionType}</p>
          <p><strong>Country:</strong> ${transaction.country}</p>
          <p><strong>Created:</strong> ${new Date(transaction.createdAt).toLocaleString()}</p>
        </div>
        
        <p style="margin-top: 20px;">You can view this transaction in your dashboard at any time.</p>
        
        <p style="margin-top: 30px; font-size: 12px; color: #666;">
          This is an automated message from the M-Pesa Integration Platform.
          Please do not reply to this email.
        </p>
      </div>
    `;
  }

  /**
   * Generate plain text content for transaction email
   * @param {string} event - The transaction event
   * @param {Object} transaction - The transaction object
   * @param {Object} business - The business object
   * @returns {string} - Plain text content for the email
   * @private
   */
  _generateTransactionEmailText(event, transaction, business) {
    return `
TRANSACTION ${event.toUpperCase()}

Your M-Pesa transaction has been ${event}.

TRANSACTION DETAILS
------------------
Reference: ${transaction.internalReference}
M-Pesa Reference: ${transaction.mpesaReference || 'Not available yet'}
Amount: ${transaction.amount} ${transaction.currency}
Status: ${transaction.status.toUpperCase()}
Phone Number: ${transaction.phoneNumber}
Transaction Type: ${transaction.transactionType}
Country: ${transaction.country}
Created: ${new Date(transaction.createdAt).toLocaleString()}

You can view this transaction in your dashboard at any time.

This is an automated message from the M-Pesa Integration Platform.
Please do not reply to this email.
    `;
  }

  /**
   * Generate SMS text for transaction notification
   * @param {string} event - The transaction event
   * @param {Object} transaction - The transaction object
   * @param {Object} business - The business object
   * @returns {string} - SMS text content
   * @private
   */
  _generateTransactionSmsText(event, transaction, business) {
    // Keep SMS short due to length limitations
    return `M-Pesa Transaction ${event.toUpperCase()}: ${transaction.internalReference} - ${transaction.amount} ${transaction.currency} is now ${transaction.status.toUpperCase()}`;
  }
}

module.exports = NotificationManager;