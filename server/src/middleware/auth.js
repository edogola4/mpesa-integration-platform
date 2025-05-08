//server/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/user.model');
const AppError = require('../utils/appError');
const config = require('../config/config');

/**
 * Middleware to protect routes - requires authentication
 */
exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Check if token exists
    if (!token) {
      return next(new AppError('You are not logged in. Please log in to get access.', 401));
    }
    
    // Verify token
    const decoded = await promisify(jwt.verify)(token, config.jwtSecret);
    
    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }
    
    // Check if user changed password after token was issued
    if (user.changedPasswordAfter(decoded.iat)) {
      return next(new AppError('User recently changed password. Please log in again.', 401));
    }
    
    // Add user to request
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware to restrict access to specific roles
 * @param {...string} roles - Allowed roles
 * @returns {Function} - Middleware function
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

/**
 * Middleware to validate API key
 */
exports.validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return next(new AppError('API key is required', 401));
    }
    
    // Find business by API key
    const business = await Business.findOne({ 'apiKeys.key': apiKey, 'apiKeys.isActive': true });
    
    if (!business) {
      return next(new AppError('Invalid API key', 401));
    }
    
    // Add business to request
    req.business = business;
    
    // Find the specific API key used
    const apiKeyObj = business.apiKeys.find(key => key.key === apiKey);
    req.apiKey = apiKeyObj;
    
    next();
  } catch (err) {
    next(err);
  }
};