// server/src/config/config.js
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  // Server configuration
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  
  // Database configuration
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/mpesa-platform',
  mongodbUriTest: process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/mpesa-platform-test',
  
  // JWT configuration
  jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_key_here',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your_refresh_secret_key_here',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  
  // Security
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100, // 100 requests per window
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'debug',
  
  // M-Pesa configurations
  mpesa: {
    kenya: {
      consumerKey: process.env.MPESA_KENYA_CONSUMER_KEY,
      consumerSecret: process.env.MPESA_KENYA_CONSUMER_SECRET,
      passkey: process.env.MPESA_KENYA_PASSKEY,
      shortCode: process.env.MPESA_KENYA_SHORT_CODE,
      environment: process.env.MPESA_KENYA_ENVIRONMENT || 'sandbox',
      sandboxBaseUrl: 'https://sandbox.safaricom.co.ke',
      productionBaseUrl: 'https://api.safaricom.co.ke',
      get baseUrl() {
        return this.environment === 'production' ? this.productionBaseUrl : this.sandboxBaseUrl;
      }
    },
    tanzania: {
      apiKey: process.env.MPESA_TANZANIA_API_KEY,
      apiSecret: process.env.MPESA_TANZANIA_API_SECRET,
      serviceProviderCode: process.env.MPESA_TANZANIA_SERVICE_PROVIDER_CODE,
      environment: process.env.MPESA_TANZANIA_ENVIRONMENT || 'sandbox',
      sandboxBaseUrl: 'https://openapi.m-pesa.com/sandbox',
      productionBaseUrl: 'https://openapi.m-pesa.com/openapi',
      get baseUrl() {
        return this.environment === 'production' ? this.productionBaseUrl : this.sandboxBaseUrl;
      }
    },
    // Add configurations for other countries (Uganda, Rwanda, etc.)
  },
  
  // Email configuration
  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || 'noreply@mpesa-platform.com'
  },
  
  // Two-Factor Authentication
  twoFactorAppName: process.env.TWO_FACTOR_APP_NAME || 'MPesaPlatform'
};