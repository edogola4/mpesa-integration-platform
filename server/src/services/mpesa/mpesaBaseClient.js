//server/src/services/mpesa/mpesaBaseClient.js
const axios = require('axios');
const logger = require('../../utils/logger');
const AppError = require('../../utils/appError');

/**
 * Base client for M-Pesa API integration
 * This abstract class serves as the foundation for country-specific implementations
 */
class MpesaBaseClient {
  /**
   * Initialize the M-Pesa client
   * @param {Object} config - Configuration object
   * @param {string} config.environment - 'sandbox' or 'production'
   * @param {string} config.country - Country code (e.g. 'kenya', 'tanzania')
   * @param {string} config.consumerKey - API consumer key
   * @param {string} config.consumerSecret - API consumer secret
   * @param {string} config.shortCode - Business short code
   * @param {string} config.callbackUrl - Callback URL for notifications
   * @param {string} [config.passkey] - Passkey for transaction validation
   * @param {string} [config.initiatorName] - Initiator name for B2B/B2C transactions
   * @param {string} [config.initiatorPassword] - Initiator password
   * @param {string} [config.securityCredential] - Security credential
   */
  constructor(config) {
    // Ensure this class cannot be instantiated directly
    if (this.constructor === MpesaBaseClient) {
      throw new Error('MpesaBaseClient is an abstract class and cannot be instantiated directly');
    }
    
    this.config = config;
    this.environment = config.environment || 'sandbox';
    this.country = config.country;
    this.consumerKey = config.consumerKey;
    this.consumerSecret = config.consumerSecret;
    this.shortCode = config.shortCode;
    this.passkey = config.passkey;
    this.callbackUrl = config.callbackUrl;
    this.timeoutUrl = config.timeoutUrl || config.callbackUrl;
    this.resultUrl = config.resultUrl || config.callbackUrl;
    this.initiatorName = config.initiatorName;
    this.initiatorPassword = config.initiatorPassword;
    this.securityCredential = config.securityCredential;
    
    // Set up authentication token
    this.authToken = null;
    this.tokenExpiry = null;
    
    // Initialize HTTP client
    this.httpClient = axios.create({
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // Add request interceptor for logging
    this.httpClient.interceptors.request.use(request => {
      logger.debug(`M-Pesa API Request: ${request.method.toUpperCase()} ${request.url}`);
      return request;
    });
    
    // Add response interceptor for logging
    this.httpClient.interceptors.response.use(
      response => {
        logger.debug(`M-Pesa API Response: ${response.status}`, { data: response.data });
        return response;
      },
      error => {
        if (error.response) {
          logger.error(`M-Pesa API Error: ${error.response.status}`, { 
            data: error.response.data,
            url: error.config.url,
            method: error.config.method
          });
        } else {
          logger.error(`M-Pesa API Request Failed: ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Get the base URL for API calls based on environment
   * @returns {string} Base URL
   */
  getBaseUrl() {
    // This should be implemented by country-specific subclasses
    throw new Error('getBaseUrl() must be implemented by subclass');
  }
  
  /**
   * Get the authentication URL
   * @returns {string} Authentication URL
   */
  getAuthUrl() {
    // This should be implemented by country-specific subclasses
    throw new Error('getAuthUrl() must be implemented by subclass');
  }
  
  /**
   * Authenticate with the M-Pesa API and get an access token
   * @returns {Promise<string>} Access token
   */
  async authenticate() {
    try {
      // Check if we already have a valid token
      if (this.authToken && this.tokenExpiry && this.tokenExpiry > Date.now()) {
        return this.authToken;
      }
      
      logger.info(`Authenticating with M-Pesa API (${this.country}/${this.environment})`);
      
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      const response = await this.httpClient.get(this.getAuthUrl(), {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });
      
      if (!response.data || !response.data.access_token) {
        throw new AppError('Authentication failed: No access token received', 500);
      }
      
      this.authToken = response.data.access_token;
      
      // Set token expiry (usually 1 hour, but subtract 5 minutes to be safe)
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiry = Date.now() + ((expiresIn - 300) * 1000);
      
      logger.info('M-Pesa API authentication successful');
      return this.authToken;
    } catch (error) {
      logger.error('M-Pesa API authentication failed', { error: error.message });
      throw new AppError(`M-Pesa API authentication failed: ${error.message}`, 500);
    }
  }
  
  /**
   * Make an authenticated request to the M-Pesa API
   * @param {string} url - Endpoint URL
   * @param {Object} data - Request payload
   * @param {string} method - HTTP method (default: 'POST')
   * @returns {Promise<Object>} API response
   */
  async makeRequest(url, data, method = 'POST') {
    try {
      // Get authentication token
      const token = await this.authenticate();
      
      // Make the API request
      const response = await this.httpClient({
        method,
        url: url.startsWith('http') ? url : `${this.getBaseUrl()}${url}`,
        data,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      logger.error('M-Pesa API request failed', { 
        url,
        error: error.message,
        response: error.response?.data
      });
      
      // Handle different types of errors
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        throw new AppError(
          `M-Pesa API error: ${error.response.data.errorMessage || error.response.data.errorCode || error.response.statusText}`,
          error.response.status
        );
      } else if (error.request) {
        // The request was made but no response was received
        throw new AppError('M-Pesa API timeout: No response received', 504);
      } else {
        // Something happened in setting up the request that triggered an Error
        throw new AppError(`M-Pesa API request failed: ${error.message}`, 500);
      }
    }
  }
  
  /**
   * Validate phone number format
   * @param {string} phoneNumber - Phone number to validate
   * @returns {string} Formatted phone number
   */
  formatPhoneNumber(phoneNumber) {
    // This should be implemented by country-specific subclasses
    throw new Error('formatPhoneNumber() must be implemented by subclass');
  }
  
  /**
   * Initiate a customer-to-business (C2B) payment request
   * @param {Object} params - Payment parameters
   * @returns {Promise<Object>} Payment response
   */
  async initiatePayment(params) {
    // This should be implemented by country-specific subclasses
    throw new Error('initiatePayment() must be implemented by subclass');
  }
  
  /**
   * Initiate a business-to-customer (B2C) payment
   * @param {Object} params - Payment parameters
   * @returns {Promise<Object>} Payment response
   */
  async initiateB2CPayment(params) {
    // This should be implemented by country-specific subclasses
    throw new Error('initiateB2CPayment() must be implemented by subclass');
  }
  
  /**
   * Check the status of a transaction
   * @param {string} transactionId - Transaction ID to check
   * @returns {Promise<Object>} Transaction status
   */
  async checkTransactionStatus(transactionId) {
    // This should be implemented by country-specific subclasses
    throw new Error('checkTransactionStatus() must be implemented by subclass');
  }
  
  /**
   * Process a callback notification from M-Pesa
   * @param {Object} callbackData - Callback data from M-Pesa
   * @returns {Object} Processed callback data
   */
  processCallback(callbackData) {
    // This should be implemented by country-specific subclasses
    throw new Error('processCallback() must be implemented by subclass');
  }
  
  /**
   * Validate transaction data before sending to M-Pesa
   * @param {Object} transactionData - Transaction data to validate
   * @returns {Object} Validated transaction data
   */
  validateTransactionData(transactionData) {
    // Base validation that applies to all countries
    if (!transactionData.amount || isNaN(parseFloat(transactionData.amount))) {
      throw new AppError('Invalid amount: Amount must be a number', 400);
    }
    
    if (parseFloat(transactionData.amount) <= 0) {
      throw new AppError('Invalid amount: Amount must be greater than 0', 400);
    }
    
    if (!transactionData.phoneNumber) {
      throw new AppError('Phone number is required', 400);
    }
    
    // Additional validations should be implemented by subclasses
    return transactionData;
  }
}