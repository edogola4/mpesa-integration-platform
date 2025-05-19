// server/src/middleware/validator.js
const { validationResult } = require('express-validator');
const httpStatus = require('http-status');

/**
 * Factory: pass in an array of express-validator chains,
 * get back a middleware function.
 */
function validateRequest(validations) {
  return async (req, res, next) => {
    await Promise.all(validations.map((v) => v.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();

    const formatted = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));
    return res.status(httpStatus.BAD_REQUEST).json({
      status: 'error',
      message: 'Validation error',
      errors: formatted,
    });
  };
}

module.exports = {
  validateRequest,
};
