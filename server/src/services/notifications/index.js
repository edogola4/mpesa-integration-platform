// server/src/services/notifications/index.js
const BaseNotificationService = require('./notificationService');
const EmailNotificationService = require('./emailService');
const SMSNotificationService = require('./smsService');
const WebhookNotificationService = require('./webhookService');
const NotificationManager = require('./notificationManager');

/**
 * Create a default notification manager with all services configured
 * @param {Object} options - Configuration options
 * @returns {NotificationManager} - Configured notification manager
 */
const createNotificationManager = (options = {}) => {
  return new NotificationManager(options);
};

module.exports = {
  BaseNotificationService,
  EmailNotificationService,
  SMSNotificationService,
  WebhookNotificationService,
  NotificationManager,
  createNotificationManager
};