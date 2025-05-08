//server/src/middleware/validation.middleware.js

const { body, validationResult } = require('express-validator');

// Middleware to validate request data
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    return res.status(400).json({
      status: 'error',
      message: 'Validation error',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  };
};

// Validation rules for user registration
const validateRegister = validate([
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),
  body('company')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Company name cannot exceed 100 characters'),
  body('phone')
    .optional()
    .trim()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number')
]);

// Validation rules for user login
const validateLogin = validate([
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
]);

// Validation rules for password reset
const validatePasswordReset = validate([
  body('token')
    .notEmpty()
    .withMessage('Token is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character')
]);

// Validation rules for business creation
const validateBusiness = validate([
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Business name is required')
    .isLength({ max: 100 })
    .withMessage('Business name cannot exceed 100 characters'),
  body('webhookUrl')
    .optional()
    .isURL()
    .withMessage('Please provide a valid URL'),
  body('notificationEmail')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('notificationPhone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number')
]);

// Validation rules for M-Pesa integration
const validateMpesaIntegration = validate([
  body('country')
    .notEmpty()
    .withMessage('Country is required')
    .isIn(['kenya', 'tanzania', 'uganda', 'rwanda', 'mozambique', 'drc'])
    .withMessage('Country must be one of: kenya, tanzania, uganda, rwanda, mozambique, drc'),
  body('shortCode')
    .notEmpty()
    .withMessage('M-Pesa short code is required'),
  body('consumerKey')
    .notEmpty()
    .withMessage('Consumer key is required'),
  body('consumerSecret')
    .notEmpty()
    .withMessage('Consumer secret is required'),
  body('passkey')
    .optional(),
  body('isLive')
    .isBoolean()
    .withMessage('isLive must be a boolean value')
]);

// Validation rules for transaction initiation
const validateTransactionInitiation = validate([
  body('businessId')
    .notEmpty()
    .withMessage('Business ID is required'),
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 1 })
    .withMessage('Amount must be greater than 0'),
  body('phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required'),
  body('currency')
    .notEmpty()
    .withMessage('Currency is required'),
  body('country')
    .notEmpty()
    .withMessage('Country is required')
    .isIn(['kenya', 'tanzania', 'uganda', 'rwanda', 'mozambique', 'drc'])
    .withMessage('Country must be one of: kenya, tanzania, uganda, rwanda, mozambique, drc'),
  body('reference')
    .notEmpty()
    .withMessage('Reference is required'),
  body('description')
    .optional()
]);

module.exports = {
  validateRegister,
  validateLogin,
  validatePasswordReset,
  validateBusiness,
  validateMpesaIntegration,
  validateTransactionInitiation
};