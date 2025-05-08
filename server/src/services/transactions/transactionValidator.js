// server/src/services/transactions/transactionValidator.js

const AppError = require('../../utils/appError');
const logger = require('../../utils/logger');

/**
 * Service for validating transaction requests
 */
class TransactionValidator {
  /**
   * Validate payment request data
   * 
   * @param {Object} paymentData - Payment data to validate
   * @param {string} paymentData.phoneNumber - Customer's phone number
   * @param {number} paymentData.amount - Amount to charge
   * @param {string} paymentData.reference - Business reference
   * @param {string} paymentData.description - Transaction description
   * @param {string} paymentData.country - Country code
   * @returns {Object} Validated payment data
   * @throws {AppError} If validation fails
   */
  validatePaymentRequest(paymentData) {
    const errors = [];
    
    // Check required fields
    if (!paymentData.phoneNumber) {
      errors.push('Phone number is required');
    }
    
    if (!paymentData.amount) {
      errors.push('Amount is required');
    } else if (isNaN(paymentData.amount) || paymentData.amount <= 0) {
      errors.push('Amount must be a positive number');
    }
    
    if (!paymentData.reference) {
      errors.push('Reference is required');
    }
    
    if (!paymentData.description) {
      errors.push('Description is required');
    }
    
    if (!paymentData.country) {
      errors.push('Country is required');
    } else if (!this._isSupportedCountry(paymentData.country)) {
      errors.push(`Country "${paymentData.country}" is not supported`);
    }
    
    // If there are validation errors, throw an error
    if (errors.length > 0) {
      logger.warn('Payment validation failed', { errors, paymentData });
      throw new AppError(`Validation error: ${errors.join(', ')}`, 400);
    }
    
    // Normalize phone number based on country
    const normalizedPhoneNumber = this._normalizePhoneNumber(
      paymentData.phoneNumber,
      paymentData.country
    );
    
    // Return normalized data
    return {
      ...paymentData,
      phoneNumber: normalizedPhoneNumber,
      amount: Number(paymentData.amount) // Ensure it's a number
    };
  }
  
  /**
   * Check if the country is supported
   * 
   * @private
   * @param {string} country - Country code
   * @returns {boolean} Whether the country is supported
   */
  _isSupportedCountry(country) {
    const supportedCountries = [
      'kenya',
      'tanzania',
      'uganda',
      'rwanda',
      'mozambique',
      'drc'
    ];
    
    return supportedCountries.includes(country.toLowerCase());
  }
  
  /**
   * Normalize phone number based on country
   * 
   * @private
   * @param {string} phoneNumber - Phone number to normalize
   * @param {string} country - Country code
   * @returns {string} Normalized phone number
   */
  _normalizePhoneNumber(phoneNumber, country) {
    // Remove non-numeric characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Country-specific normalization
    switch (country.toLowerCase()) {
      case 'kenya':
        // Kenya: Ensure it starts with 254 (country code)
        if (cleaned.startsWith('0')) {
          cleaned = '254' + cleaned.substring(1);
        } else if (!cleaned.startsWith('254')) {
          cleaned = '254' + cleaned;
        }
        break;
        
      case 'tanzania':
        // Tanzania: Ensure it starts with 255
        if (cleaned.startsWith('0')) {
          cleaned = '255' + cleaned.substring(1);
        } else if (!cleaned.startsWith('255')) {
          cleaned = '255' + cleaned;
        }
        break;
        
      case 'uganda':
        // Uganda: Ensure it starts with 256
        if (cleaned.startsWith('0')) {
          cleaned = '256' + cleaned.substring(1);
        } else if (!cleaned.startsWith('256')) {
          cleaned = '256' + cleaned;
        }
        break;
        
      case 'rwanda':
        // Rwanda: Ensure it starts with 250
        if (cleaned.startsWith('0')) {
          cleaned = '250' + cleaned.substring(1);
        } else if (!cleaned.startsWith('250')) {
          cleaned = '250' + cleaned;
        }
        break;
        
      case 'mozambique':
        // Mozambique: Ensure it starts with 258
        if (cleaned.startsWith('0')) {
          cleaned = '258' + cleaned.substring(1);
        } else if (!cleaned.startsWith('258')) {
          cleaned = '258' + cleaned;
        }
        break;
        
      case 'drc':
        // DRC: Ensure it starts with 243
        if (cleaned.startsWith('0')) {
          cleaned = '243' + cleaned.substring(1);
        } else if (!cleaned.startsWith('243')) {
          cleaned = '243' + cleaned;
        }
        break;
        
      default:
        // No specific handling for other countries
        break;
    }
    
    return cleaned;
  }
  
  /**
   * Validate transaction ID
   * 
   * @param {string} transactionId - Transaction ID to validate
   * @returns {boolean} Whether the transaction ID is valid
   */
  validateTransactionId(transactionId) {
    // Basic validation for MongoDB ObjectId
    return /^[0-9a-fA-F]{24}$/.test(transactionId);
  }
}

module.exports = new TransactionValidator();