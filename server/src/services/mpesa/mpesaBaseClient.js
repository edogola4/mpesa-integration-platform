//server/src/services/mpesa/mpesaBaseClient.js
const axios = require('axios');
const logger = require('../../utils/logger');

/**
 * Base M-Pesa API client class with common functionality
 */
class MpesaBaseClient {
  /**
   * @param {object} config - Configuration object
   */
  constructor(config) {
    this.config = config;
    this.axios = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // Add request interceptor for logging
    this.axios.interceptors.request.use(
      (config) => {
        logger.debug(`API Request to ${config.url}`, { 
          method: config.method.toUpperCase(),
          headers: config.headers
        });
        return config;
      },
      (error) => {
        logger.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );
    
    // Add response interceptor for logging
    this.axios.interceptors.response.use(
      (response) => {
        logger.debug(`API Response from ${response.config.url}`, {
          status: response.status,
          statusText: response.statusText
        });
        return response;
      },
      (error) => {
        if (error.response) {
          logger.error(`API Error Response: ${error.response.status}`, {
            data: error.response.data,
            status: error.response.status,
            headers: error.response.headers
          });
        } else if (error.request) {
          logger.error('API No Response Received', {
            request: error.request
          });
        } else {
          logger.error('API Request Setup Error', {
            message: error.message
          });
        }
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Get current timestamp in the format YYYYMMDDHHmmss
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
   * Handle API errors consistently
   * @param {Error} error - The error from API call
   * @throws {Error} - Enhanced error with additional context
   */
  handleApiError(error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const responseData = error.response.data;
      const status = error.response.status;
      
      const errorMessage = responseData.errorMessage || 
                           responseData.message || 
                           responseData.error_description ||
                           responseData.errorDescription ||
                           'Unknown API error';
      
      const enhancedError = new Error(`M-Pesa API Error (${status}): ${errorMessage}`);
      enhancedError.status = status;
      enhancedError.response = responseData;
      
      throw enhancedError;
    } else if (error.request) {
      // The request was made but no response was received
      throw new Error('No response received from M-Pesa API. Please check your network connection.');
    } else {
      // Something happened in setting up the request that triggered an Error
      throw new Error(`Error setting up request: ${error.message}`);
    }
  }
  
  /**
   * Generate a unique transaction reference
   * @param {string} prefix - Prefix for the reference
   * @returns {string} - Unique reference
   */
  generateReference(prefix = 'TX') {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}_${timestamp}_${random}`;
  }
}

module.exports = MpesaBaseClient;