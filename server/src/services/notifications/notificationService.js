// server/src/services/notifications/notificationService.js
const AppError = require('../../utils/appError');
const logger = require('../../utils/logger');

/**
 * Base notification service class
 * Acts as an abstract class for different notification channels
 */
class BaseNotificationService {
  constructor() {
    if (this.constructor === BaseNotificationService) {
      throw new Error('BaseNotificationService is an abstract class and cannot be instantiated directly');
    }
  }

  /**
   * Send a notification
   * @param {Object} payload - The notification payload
   * @returns {Promise<Object>} - The notification result
   */
  async send(payload) {
    throw new Error('Method "send" must be implemented by derived classes');
  }

  /**
   * Validate notification payload
   * @param {Object} payload - The notification payload
   * @throws {AppError} - If validation fails
   */
  validate(payload) {
    throw new Error('Method "validate" must be implemented by derived classes');
  }
}

module.exports = BaseNotificationService;