/**
 * ============================================================
 * Laundry ERP - Standard Error Response
 * ============================================================
 *
 * File:
 *     backend/src/utils/errors/errorResponse.js
 *
 * Purpose:
 * --------
 * API errors ke liye consistent JSON response structure
 * provide karna.
 *
 * Responsibilities:
 * -----------------
 * 1. Standard error response create karna.
 * 2. Request ID include karna.
 * 3. Validation errors support karna.
 * 4. Production mein internal details expose hone se rokna.
 *
 * IMPORTANT:
 * ----------
 * Ye file HTTP response send nahi karti.
 * Ye sirf response payload create karti hai.
 * HTTP response errorHandler.js send karega.
 * ============================================================
 */

/**
 * Creates a standardized error response payload.
 *
 * @param {object} options
 * @param {string} options.message
 * @param {string} options.errorCode
 * @param {string|null} options.requestId
 * @param {Array|null} options.errors
 *
 * @returns {object}
 */
export const createErrorResponse = ({
  message = "An unexpected error occurred",
  errorCode = "INTERNAL_SERVER_ERROR",
  requestId = null,
  errors = null,
} = {}) => {
  /**
   * Standard response structure.
   */
  const response = {
    success: false,
    message,
    errorCode,
  };

  /**
   * Request ID debugging aur log correlation mein help
   * karta hai.
   */
  if (requestId) {
    response.requestId = requestId;
  }

  /**
   * Validation errors jaise field-level details ke liye.
   *
   * Sensitive information is array mein kabhi include
   * nahi karni chahiye.
   */
  if (Array.isArray(errors) && errors.length > 0) {
    response.errors = errors;
  }

  return response;
};