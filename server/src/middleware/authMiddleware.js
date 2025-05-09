// server/src/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/user');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

// Middleware to protect routes that require authentication
exports.protect = async (req, res, next) => {
  try {
    // 1) Get token and check if it exists
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      // Token from Authorization header
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
      // Token from cookie
      token = req.cookies.jwt;
    }

    if (!token) {
      return next(
        new AppError('You are not logged in. Please log in to get access.', 401)
      );
    }

    // 2) Verify token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(
        new AppError('The user belonging to this token no longer exists.', 401)
      );
    }

    // 4) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(
        new AppError('User recently changed password! Please log in again.', 401)
      );
    }

    // 5) Check if user is verified
    if (!currentUser.isVerified) {
      return next(
        new AppError('Please verify your email address to access this resource.', 403)
      );
    }

    // 6) Check if user is active
    if (!currentUser.active) {
      return next(
        new AppError('This account has been deactivated. Please contact support.', 403)
      );
    }

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    res.locals.user = currentUser;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return next(new AppError('Authentication failed. Please log in again.', 401));
  }
};

// Middleware to restrict access to certain roles
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'business', 'developer']
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

// Middleware to verify API key for public endpoints
exports.verifyApiKey = async (req, res, next) => {
  try {
    // 1) Get API key from header
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return next(new AppError('API key is required', 401));
    }

    // 2) Find business with this API key
    const Business = require('../models/business');
    const business = await Business.findOne({
      'apiKeys.key': apiKey,
      'apiKeys.isActive': true
    });

    if (!business) {
      return next(new AppError('Invalid or inactive API key', 401));
    }

    // 3) Add business to request object
    req.business = business;
    next();
  } catch (error) {
    logger.error('API key verification error:', error);
    return next(new AppError('Authentication failed', 401));
  }
};

// Middleware to check if user is logged in (for rendered pages)
exports.isLoggedIn = async (req, res, next) => {
  try {
    if (req.cookies.jwt) {
      // 1) Verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    }
    next();
  } catch (error) {
    // If error, just continue (user is not logged in)
    next();
  }
};