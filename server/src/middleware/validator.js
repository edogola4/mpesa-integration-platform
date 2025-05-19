const { validationResult } = require('express-validator');
const httpStatus = require('http-status');

/**
 * Middleware to validate request data based on defined validation rules
 * Uses express-validator to validate requests
 * @param {Array} validations - Array of express-validator validation rules
 * @returns {Function} Express middleware function
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));
    
    // Get validation errors
    const errors = validationResult(req);
    
    if (errors.isEmpty()) {
      return next();
    }

    // Format validation errors
    const formattedErrors = errors.array().map(error => ({
      field: error.path,
      message: error.msg
    }));

    // Return validation error response
    return res.status(httpStatus.BAD_REQUEST).json({
      status: 'error',
      message: 'Validation error',
      errors: formattedErrors
    });
  };
};

module.exports = {
  validate
};