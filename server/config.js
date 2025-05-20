/**
 * Configuration Module - With Debug Logging
 * Centralized configuration handling with environment variable support
 */
'use strict';

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Debug: Check current directory
console.log('Current directory:', process.cwd());
console.log('Looking for .env file...');

// Try to load .env with different path strategies
let envLoaded = false;

// Try direct .env load first
const result = dotenv.config();
if (result.error) {
  console.log('Failed to load .env directly:', result.error.message);
} else {
  console.log('.env file loaded successfully!');
  envLoaded = true;
}

// If not loaded, try alternative paths
if (!envLoaded) {
  // Check if .env exists in current directory
  if (fs.existsSync(path.join(process.cwd(), '.env'))) {
    console.log('.env file exists in current directory');
    dotenv.config({ path: path.join(process.cwd(), '.env') });
    envLoaded = true;
  } else {
    console.log('.env file NOT found in current directory');
  }
}

// If still not loaded, try parent directory
if (!envLoaded) {
  if (fs.existsSync(path.join(process.cwd(), '..', '.env'))) {
    console.log('.env file exists in parent directory');
    dotenv.config({ path: path.join(process.cwd(), '..', '.env') });
    envLoaded = true;
  } else {
    console.log('.env file NOT found in parent directory');
  }
}

// Debug: Show the MongoDB URI
console.log('MONGODB_URI from env:', process.env.MONGODB_URI);

const config = {
  // Environment settings
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  behindProxy: process.env.BEHIND_PROXY === 'true',
  version: process.env.npm_package_version || '1.0.0',
  
  // CORS configuration
  corsOrigin: process.env.CORS_ORIGIN || '*',
  
  // Database configuration
  mongodbUri: process.env.MONGODB_URI,
  mongodbUriTest: process.env.MONGODB_URI_TEST,

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '90d',
    cookieExpiresIn: parseInt(process.env.JWT_COOKIE_EXPIRES_IN, 10) || 90
  },
  
  // Email configuration
  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    username: process.env.EMAIL_USERNAME,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM
  },
  
  // SMS configuration (Twilio)
  sms: {
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER
  },
  
  // M-Pesa API configuration - Kenya
  mpesaKenya: {
    consumerKey: process.env.MPESA_KENYA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_KENYA_CONSUMER_SECRET,
    passkey: process.env.MPESA_KENYA_PASSKEY,
    shortCode: process.env.MPESA_KENYA_SHORT_CODE,
    environment: process.env.MPESA_KENYA_ENVIRONMENT || 'sandbox'
  },
  
  // M-Pesa API configuration - Tanzania
  mpesaTanzania: {
    apiKey: process.env.MPESA_TANZANIA_API_KEY,
    publicKey: process.env.MPESA_TANZANIA_PUBLIC_KEY,
    environment: process.env.MPESA_TANZANIA_ENVIRONMENT || 'sandbox'
  },
  
  // Webhook configuration
  webhook: {
    baseUrl: process.env.WEBHOOK_BASE_URL || 'http://localhost:5000/api/webhooks'
  },
  
  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false
  }
};

// Debug: Final check
console.log('config.mongodbUri value:', config.mongodbUri);

module.exports = config;