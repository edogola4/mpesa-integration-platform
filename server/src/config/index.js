// server / src / config / index.js

const dotenv = require('dotenv');

// Load env vars
dotenv.config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/mpesa-platform',
  jwt: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret_key',
    expire: process.env.JWT_EXPIRE || '30d',
    cookieExpire: parseInt(process.env.JWT_COOKIE_EXPIRE || '30', 10)
  },
  mpesa: {
    kenya: {
      consumerKey: process.env.MPESA_CONSUMER_KEY,
      consumerSecret: process.env.MPESA_CONSUMER_SECRET,
      passkey: process.env.MPESA_PASSKEY,
      shortcode: process.env.MPESA_SHORTCODE,
      environment: process.env.MPESA_ENVIRONMENT || 'sandbox'
    },
    // Add configurations for other countries
    tanzania: {
      consumerKey: process.env.MPESA_TZ_CONSUMER_KEY,
      consumerSecret: process.env.MPESA_TZ_CONSUMER_SECRET,
      // Add other Tanzania-specific configurations
    },
    // Additional countries would be added here
  }
};

module.exports = config;