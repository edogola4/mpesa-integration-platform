//server/src/services/mpesa/mpesaBaseClient.js
const axios = require('axios');
const logger = require('../../utils/logger');
const { AppError } = require('../../utils/appError');

/**
 * Base client for M-Pesa API
 * Contains common functionality shared by country-specific implementations
 */
class MpesaBaseClient {
  /**
   * @param {object} config - Configuration object
   */
  constructor(config) {
    this.environment = config.environment || 'sandbox';
    
    // Set base URL based on environment
    const baseURL = this.environment === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';
    
    // Initialize axios instance with common configs
    this.axios = axios.create({
      baseURL,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // Add response interceptor for logging
    this.axios.interceptors.response.use(
      response => {
        logger.debug(`M-Pesa API Response: ${JSON.stringify(response.data)}`);
        return response;
      },
      error => {
        if (error.response) {
          logger.error(`M-Pesa API Error: ${JSON.stringify(error.response.data)}`);
        } else {
          logger.error(`M-Pesa API Error: ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Generate timestamp in the format required by M-Pesa API (YYYYMMDDHHmmss)
   * @returns {string} - Formatted timestamp
   */
  getTimestamp() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }
  
  /**
   * Handle M-Pesa API errors
   * @param {Error} error - Error object
   * @throws {AppError} - Custom error with appropriate status code and message
   */
  handleApiError(error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const statusCode = error.response.status;
      const errorMessage = error.response.data.errorMessage || 
                         error.response.data.errorDesc || 
                         error.response.data.message || 
                         'M-Pesa API error';
      
      throw new AppError(errorMessage, statusCode);
    } else if (error.request) {
      // The request was made but no response was received
      throw new AppError('No response received from M-Pesa API', 503);
    } else {
      // Something happened in setting up the request
      throw new AppError(`M-Pesa API request failed: ${error.message}`, 500);
    }
  }
  
  /**
   * Common method to authenticate with the M-Pesa API
   * To be implemented by country-specific subclasses
   */
  async authenticate() {
    throw new AppError('authenticate() method must be implemented by subclass', 500);
  }
}

module.exports = MpesaBaseClient;