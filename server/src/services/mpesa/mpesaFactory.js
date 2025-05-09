const MpesaKenyaClient = require('./mpesaKenyaClient');
const AppError = require('../../utils/appError');
const logger = require('../../utils/logger');

/**
 * Factory class for creating M-Pesa client instances based on country
 */
class MpesaFactory {
  /**
   * Create an M-Pesa client instance for the specified country
   * @param {Object} config - M-Pesa configuration
   * @param {string} config.country - Country code (e.g., 'kenya', 'tanzania')
   * @returns {Object} M-Pesa client instance
   */
  static createClient(config) {
    if (!config) {
      throw new AppError('M-Pesa configuration is required', 400);
    }
    
    if (!config.country) {
      throw new AppError('Country is required in M-Pesa configuration', 400);
    }
    
    const country = config.country.toLowerCase();
    
    logger.info(`Creating M-Pesa client for ${country}`);
    
    switch (country) {
      case 'kenya':
        return new MpesaKenyaClient(config);
      
      // Future implementations for other countries
      // case 'tanzania':
      //   return new MpesaTanzaniaClient(config);
      // case 'uganda':
      //   return new MpesaUgandaClient(config);
      // etc.
        
      default:
        throw new AppError(`Unsupported M-Pesa country: ${country}`, 400);
    }
  }
  
  /**
   * Get a list of supported countries
   * @returns {Array<string>} List of supported countries
   */
  static getSupportedCountries() {
    return [
      'kenya',
      // Add more countries as they are implemented
    ];
  }
  
  /**
   * Check if a country is supported
   * @param {string} country - Country to check
   * @returns {boolean} Whether the country is supported
   */
  static isCountrySupported(country) {
    return this.getSupportedCountries().includes(country.toLowerCase());
  }
}

module.exports = MpesaFactory;