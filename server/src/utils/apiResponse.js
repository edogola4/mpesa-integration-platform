// server/ src/ utils/ apiResponse.js
/**
 * Standard API response format
 */
class ApiResponse {
    /**
     * Creates a success response
     * @param {object} data - Data to include in the response
     * @param {string} message - Success message
     * @param {number} statusCode - HTTP status code
     * @returns {object} Response object
     */
    static success(data = null, message = 'Operation successful', statusCode = 200) {
      return {
        status: 'success',
        message,
        data,
        statusCode
      };
    }
  
    /**
     * Creates an error response
     * @param {string} message - Error message
     * @param {number} statusCode - HTTP status code
     * @param {object|null} errors - Additional error details
     * @returns {object} Response object
     */
    static error(message = 'An error occurred', statusCode = 500, errors = null) {
      return {
        status: 'error',
        message,
        errors,
        statusCode
      };
    }
  
    /**
     * Creates a response for paginated data
     * @param {Array} data - Array of data items
     * @param {number} page - Current page number
     * @param {number} limit - Items per page
     * @param {number} total - Total number of items
     * @param {string} message - Success message
     * @returns {object} Response object with pagination info
     */
    static paginated(data, page, limit, total, message = 'Data retrieved successfully') {
      const totalPages = Math.ceil(total / limit);
      
      return {
        status: 'success',
        message,
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        statusCode: 200
      };
    }
  }
  
  module.exports = ApiResponse;