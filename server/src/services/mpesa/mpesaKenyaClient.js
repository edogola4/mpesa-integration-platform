//server/src/services/mpesa/mpesaKenyaClient.js
const crypto = require('crypto');
const MpesaBaseClient = require('./mpesaBaseClient');
const logger = require('../../utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * Client for Kenya M-Pesa API
 * Extends the base client with Kenya-specific implementations
 */
class MpesaKenyaClient extends MpesaBaseClient {
  /**
   * @param {object} config - Configuration object
   */
  constructor(config) {
    super(config);
    this.consumerKey = config.consumerKey;
    this.consumerSecret = config.consumerSecret;
    this.shortCode = config.shortCode; 
    this.passkey = config.passkey;
    this.environment = config.environment;
    this.accessToken = null;
    this.tokenExpiry = null;
  }
  
  /**
   * Get OAuth access token
   * @returns {Promise<string>} - Access token
   */
  async authenticate() {
    try {
      // Check if we already have a valid token
      if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        return this.accessToken;
      }
      
      // Encode consumer key and secret
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      
      // Make request to get access token
      const response = await this.axios.get('/oauth/v1/generate?grant_type=client_credentials', {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });
      
      // Set token and expiry (typically 1 hour)
      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000) - 60000); // Subtract 1 minute for safety
      
      return this.accessToken;
    } catch (error) {
      logger.error('M-Pesa Kenya authentication error:', error);
      this.handleApiError(error);
    }
  }
  
  /**
   * Generate password for STK Push
   * @returns {string} - Base64 encoded password
   */
  generateStkPushPassword() {
    const timestamp = this.getTimestamp();
    const passwordString = `${this.shortCode}${this.passkey}${timestamp}`;
    return Buffer.from(passwordString).toString('base64');
  }
  
  /**
   * Initiate STK Push request (for customer to business payment)
   * @param {object} params - Payment parameters
   * @returns {Promise<object>} - API response
   */
  async initiateSTKPush(params) {
    try {
      const token = await this.authenticate();
      const timestamp = this.getTimestamp();
      const password = this.generateStkPushPassword();
      
      // Format phone number (remove + if present and ensure 254 prefix for Kenya)
      let phoneNumber = params.phoneNumber.replace(/\\+/g, '');
      if (!phoneNumber.startsWith('254')) {
        // If number starts with 0, replace it with 254
        if (phoneNumber.startsWith('0')) {
          phoneNumber = `254${phoneNumber.substring(1)}`;
        } 
        // If it starts with 7 or 1, add 254 prefix
        else if (phoneNumber.startsWith('7') || phoneNumber.startsWith('1')) {
          phoneNumber = `254${phoneNumber}`;
        }
      }
      
      // Prepare request payload
      const payload = {
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: params.amount,
        PartyA: phoneNumber,
        PartyB: this.shortCode,
        PhoneNumber: phoneNumber,
        CallBackURL: params.callbackUrl,
        AccountReference: params.reference || "Payment",
        TransactionDesc: params.description || "Payment"
      };
      
      // Make API request
      const response = await this.axios.post('/mpesa/stkpush/v1/processrequest', payload, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      logger.error('M-Pesa Kenya STK Push error:', error);
      this.handleApiError(error);
    }
  }
  
  /**
   * Check status of an STK Push transaction
   * @param {string} checkoutRequestId - Checkout request ID from the STK Push response
   * @returns {Promise<object>} - API response
   */
  async checkSTKPushStatus(checkoutRequestId) {
    try {
      const token = await this.authenticate();
      const timestamp = this.getTimestamp();
      const password = this.generateStkPushPassword();
      
      // Prepare request payload
      const payload = {
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      };
      
      // Make API request
      const response = await this.axios.post('/mpesa/stkpushquery/v1/query', payload, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      logger.error('M-Pesa Kenya STK Push status check error:', error);
      this.handleApiError(error);
    }
  }
  
  /**
   * Register URL for C2B transactions
   * @param {string} confirmationUrl - Confirmation URL
   * @param {string} validationUrl - Validation URL
   * @returns {Promise<object>} - API response
   */
  async registerC2BUrls(confirmationUrl, validationUrl) {
    try {
      const token = await this.authenticate();
      
      // Prepare request payload
      const payload = {
        ShortCode: this.shortCode,
        ResponseType: "Completed",
        ConfirmationURL: confirmationUrl,
        ValidationURL: validationUrl
      };
      
      // Make API request
      const response = await this.axios.post('/mpesa/c2b/v1/registerurl', payload, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      logger.error('M-Pesa Kenya C2B URL registration error:', error);
      this.handleApiError(error);
    }
  }
  
  /**
   * Simulate a C2B transaction (for testing in sandbox)
   * @param {object} params - Simulation parameters
   * @returns {Promise<object>} - API response
   */
  async simulateC2B(params) {
    try {
      // Only available in sandbox
      if (this.environment !== 'sandbox') {
        throw new Error('C2B simulation is only available in sandbox environment');
      }
      
      const token = await this.authenticate();
      
      // Format phone number
      let phoneNumber = params.phoneNumber.replace(/\\+/g, '');
      if (!phoneNumber.startsWith('254')) {
        // If number starts with 0, replace it with 254
        if (phoneNumber.startsWith('0')) {
          phoneNumber = `254${phoneNumber.substring(1)}`;
        } 
        // If it starts with 7 or 1, add 254 prefix
        else if (phoneNumber.startsWith('7') || phoneNumber.startsWith('1')) {
          phoneNumber = `254${phoneNumber}`;
        }
      }
      
      // Prepare request payload
      const payload = {
        ShortCode: this.shortCode,
        CommandID: params.commandId || "CustomerPayBillOnline",
        Amount: params.amount,
        Msisdn: phoneNumber,
        BillRefNumber: params.reference || "Test"
      };
      
      // Make API request
      const response = await this.axios.post('/mpesa/c2b/v1/simulate', payload, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      logger.error('M-Pesa Kenya C2B simulation error:', error);
      this.handleApiError(error);
    }
  }
  
  /**
   * Check account balance
   * @param {object} params - Parameters
   * @returns {Promise<object>} - API response
   */
  async checkBalance(params) {
    try {
      const token = await this.authenticate();
      
      // Prepare request payload
      const payload = {
        Initiator: params.initiator,
        SecurityCredential: params.securityCredential,
        CommandID: "AccountBalance",
        PartyA: this.shortCode,
        IdentifierType: "4", // For shortcode
        Remarks: params.remarks || "Balance inquiry",
        QueueTimeOutURL: params.timeoutUrl,
        ResultURL: params.resultUrl
      };
      
      // Make API request
      const response = await this.axios.post('/mpesa/accountbalance/v1/query', payload, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      logger.error('M-Pesa Kenya account balance check error:', error);
      this.handleApiError(error);
    }
  }
  
  /**
   * B2C transaction (business to customer)
   * @param {object} params - Transaction parameters
   * @returns {Promise<object>} - API response
   */
  async b2cPayment(params) {
    try {
      const token = await this.authenticate();
      
      // Format phone number
      let phoneNumber = params.phoneNumber.replace(/\\+/g, '');
      if (!phoneNumber.startsWith('254')) {
        // If number starts with 0, replace it with 254
        if (phoneNumber.startsWith('0')) {
          phoneNumber = `254${phoneNumber.substring(1)}`;
        } 
        // If it starts with 7 or 1, add 254 prefix
        else if (phoneNumber.startsWith('7') || phoneNumber.startsWith('1')) {
          phoneNumber = `254${phoneNumber}`;
        }
      }
      
      // Prepare request payload
      const payload = {
        InitiatorName: params.initiator,
        SecurityCredential: params.securityCredential,
        CommandID: params.commandId || "BusinessPayment",
        Amount: params.amount,
        PartyA: this.shortCode,
        PartyB: phoneNumber,
        Remarks: params.remarks || "Payment",
        QueueTimeOutURL: params.timeoutUrl,
        ResultURL: params.resultUrl,
        Occasion: params.occasion || ""
      };
      
      // Make API request
      const response = await this.axios.post('/mpesa/b2c/v1/paymentrequest', payload, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      logger.error('M-Pesa Kenya B2C payment error:', error);
      this.handleApiError(error);
    }
  }
  
  /**
   * Generate security credential
   * @param {string} initiatorPassword - Initiator password
   * @returns {string} - Base64 encoded security credential
   */
  generateSecurityCredential(initiatorPassword) {
    try {
      // In production, you'd use the M-Pesa public key to encrypt
      // For sandbox, we use a specific certificate
      let publicKeyPath;
      
      if (this.environment === 'production') {
        publicKeyPath = path.join(__dirname, '../../../certs/production.cert');
      } else {
        publicKeyPath = path.join(__dirname, '../../../certs/sandbox.cert');
      }
      
      const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
      const buffer = Buffer.from(initiatorPassword);
      
      const encrypted = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_PADDING
        },
        buffer
      );
      
      return encrypted.toString('base64');
    } catch (error) {
      logger.error('M-Pesa Kenya security credential generation error:', error);
      throw new Error('Failed to generate security credential');
    }
  }
  
  /**
   * Transaction status query
   * @param {object} params - Query parameters
   * @returns {Promise<object>} - API response
   */
  async transactionStatus(params) {
    try {
      const token = await this.authenticate();
      
      // Prepare request payload
      const payload = {
        Initiator: params.initiator,
        SecurityCredential: params.securityCredential,
        CommandID: "TransactionStatusQuery",
        TransactionID: params.transactionId,
        PartyA: this.shortCode,
        IdentifierType: "4", // For shortcode
        ResultURL: params.resultUrl,
        QueueTimeOutURL: params.timeoutUrl,
        Remarks: params.remarks || "Transaction status query",
        Occasion: params.occasion || ""
      };
      
      // Make API request
      const response = await this.axios.post('/mpesa/transactionstatus/v1/query', payload, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      logger.error('M-Pesa Kenya transaction status query error:', error);
      this.handleApiError(error);
    }
  }
  
  /**
   * Transaction reversal
   * @param {object} params - Reversal parameters
   * @returns {Promise<object>} - API response
   */
  async reverseTransaction(params) {
    try {
      const token = await this.authenticate();
      
      // Prepare request payload
      const payload = {
        Initiator: params.initiator,
        SecurityCredential: params.securityCredential,
        CommandID: "TransactionReversal",
        TransactionID: params.transactionId,
        Amount: params.amount,
        ReceiverParty: this.shortCode,
        ReceiverIdentifierType: "4", // For shortcode
        ResultURL: params.resultUrl,
        QueueTimeOutURL: params.timeoutUrl,
        Remarks: params.remarks || "Transaction reversal",
        Occasion: params.occasion || ""
      };
      
      // Make API request
      const response = await this.axios.post('/mpesa/reversal/v1/request', payload, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      logger.error('M-Pesa Kenya transaction reversal error:', error);
      this.handleApiError(error);
    }
  }
}

module.exports = MpesaKenyaClient;