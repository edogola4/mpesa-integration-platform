const axios = require('axios');
const moment = require('moment');
const Transaction = require('../models/transaction');

/**
 * Generates an OAuth token for M-Pesa API calls
 * @returns {Promise<string>} The OAuth token
 */
const getOAuthToken = async () => {
  try {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    
    const response = await axios.get(
      `${process.env.MPESA_API_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );
    
    return response.data.access_token;
  } catch (error) {
    console.error('Error generating M-Pesa OAuth token:', error);
    throw new Error('Failed to generate M-Pesa authentication token');
  }
};

/**
 * Initiates STK Push request to customer's phone
 */
exports.initiateSTKPush = async (req, res) => {
  try {
    const { phoneNumber, amount, accountReference, transactionDesc } = req.body;
    
    if (!phoneNumber || !amount) {
      return res.status(400).json({ message: 'Phone number and amount are required' });
    }
    
    // Format phone number (remove leading zero or +254)
    let formattedPhone = phoneNumber.toString().replace(/^0|^\+254/, '');
    // Add country code if needed
    if (formattedPhone.length === 9) {
      formattedPhone = `254${formattedPhone}`;
    }
    
    // Get OAuth token
    const token = await getOAuthToken();
    
    // Prepare timestamp
    const timestamp = moment().format('YYYYMMDDHHmmss');
    
    // Prepare password (Base64 of BusinessShortCode + Passkey + Timestamp)
    const shortCode = process.env.MPESA_SHORT_CODE;
    const passkey = process.env.MPESA_PASSKEY;
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');
    
    // Prepare request payload
    const requestBody = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: `${process.env.APP_URL}/api/mpesa/callback`,
      AccountReference: accountReference || 'M-Pesa Integration',
      TransactionDesc: transactionDesc || 'Payment'
    };
    
    // Make request to M-Pesa API
    const response = await axios.post(
      `${process.env.MPESA_API_URL}/mpesa/stkpush/v1/processrequest`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Save transaction request to database
    const transaction = new Transaction({
      user: req.user._id,
      phoneNumber: formattedPhone,
      amount,
      reference: accountReference,
      description: transactionDesc,
      requestId: response.data.CheckoutRequestID,
      status: 'pending'
    });
    
    await transaction.save();
    
    res.status(200).json({
      message: 'STK push request sent successfully',
      requestId: response.data.CheckoutRequestID,
      transaction: transaction
    });
  } catch (error) {
    console.error('STK Push error:', error.response?.data || error.message);
    res.status(500).json({
      message: 'Failed to initiate M-Pesa payment',
      error: error.response?.data || error.message
    });
  }
};

/**
 * Handles callback from M-Pesa API
 */
exports.handleCallback = async (req, res) => {
  try {
    const { Body } = req.body;
    
    // Acknowledge receipt of callback
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback received successfully' });
    
    // Process callback asynchronously
    if (Body.stkCallback) {
      const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = Body.stkCallback;
      
      // Find transaction by request ID
      const transaction = await Transaction.findOne({ requestId: CheckoutRequestID });
      
      if (!transaction) {
        console.error('Transaction not found for CheckoutRequestID:', CheckoutRequestID);
        return;
      }
      
      if (ResultCode === 0) {
        // Payment successful
        const metadataItems = CallbackMetadata?.Item || [];
        
        // Extract metadata
        const mpesaReceiptNumber = metadataItems.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
        const transactionDate = metadataItems.find(item => item.Name === 'TransactionDate')?.Value;
        const phoneNumber = metadataItems.find(item => item.Name === 'PhoneNumber')?.Value;
        
        // Update transaction
        transaction.status = 'completed';
        transaction.mpesaReceiptNumber = mpesaReceiptNumber;
        transaction.transactionDate = moment(transactionDate.toString(), 'YYYYMMDDHHmmss').toDate();
        transaction.resultCode = ResultCode;
        transaction.resultDesc = ResultDesc;
        
        await transaction.save();
        
        // Further processing (e.g., update user account, send notification)
        // ...
      } else {
        // Payment failed
        transaction.status = 'failed';
        transaction.resultCode = ResultCode;
        transaction.resultDesc = ResultDesc;
        
        await transaction.save();
      }
    }
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    // Don't send error response to M-Pesa
  }
};

/**
 * Get user's transactions
 */
exports.getTransactions = async (req, res) => {
  try {
    const { status, limit = 10, page = 1 } = req.query;
    
    const query = { user: req.user._id };
    
    if (status) {
      query.status = status;
    }
    
    const options = {
      sort: { createdAt: -1 },
      skip: (parseInt(page) - 1) * parseInt(limit),
      limit: parseInt(limit)
    };
    
    const transactions = await Transaction.find(query, null, options);
    const total = await Transaction.countDocuments(query);
    
    res.status(200).json({
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
};