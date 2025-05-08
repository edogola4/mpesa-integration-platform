//server/src/middleware/notFound.js
const AppError = require('../utils/appError');

/**
 * Middleware for handling 404 Not Found errors
 * This should be placed after all routes
 */
exports.notFound = (req, res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server!`, 404));
};