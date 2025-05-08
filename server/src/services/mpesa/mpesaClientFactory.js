//server/src/services/mpesa/mpesaClientFactory.js
const MpesaKenyaClient = require('./mpesaKenyaClient');
// Import other country-specific clients when implemented
// const MpesaTanzaniaClient = require('./mpesaTanzaniaClient');
// const MpesaUgandaClient = require('./mpesaUgandaClient');
const { AppError } = require('../../utils/appError');

/**
 * Factory for creating country-specific M-Pesa clients
 */
class MpesaClientFactory {
  /**
   * Create a country-specific M-Pesa client
   * @param {string} country - Country code (e.g., 'kenya', 'tanzania', 'uganda')
   * @param {object} config - Configuration for the client
   * @returns {object} - Country-specific M-Pesa client instance
   */
  static createClient(country, config) {
    switch (country.toLowerCase()) {
      case 'kenya':
        return new MpesaKenyaClient(config);
      
      // Add cases for other countries as they are implemented
      // case 'tanzania':
      //   return new MpesaTanzaniaClient(config);
      // case 'uganda':
      //   return new MpesaUgandaClient(config);
        
      default:
        throw new AppError(`M-Pesa client for ${country} is not implemented`, 400);
    }
  }
}

module.exports = MpesaClientFactory;