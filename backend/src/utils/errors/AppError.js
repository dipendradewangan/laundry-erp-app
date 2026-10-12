/**
 * ============================================================
 * Laundry ERP - Application Error
 * ============================================================
 *
 * Purpose:
 * --------
 * Application ke predictable errors ko standard format
 * mein represent karna.
 *
 * Examples:
 * ---------
 * - Validation errors
 * - Authentication errors
 * - Authorization errors
 * - Resource not found
 * - Duplicate resource
 * - Business rule violations
 *
 * IMPORTANT:
 * ----------
 * Is class ka kaam error represent karna hai.
 * HTTP response bhejne ka kaam centralized error handler karega.
 * ============================================================
 */

export class AppError extends Error {
  /**
   * Creates a standardized application error.
   *
   * @param {string} message - Safe, user-facing error message.
   * @param {number} statusCode - HTTP status code.
   * @param {string} errorCode - Application-specific error code.
   * @param {object} options - Additional error configuration.
   */
  constructor(
    message,
    statusCode = 500,
    errorCode = "INTERNAL_SERVER_ERROR",
    options = {}
  ) {
    super(message, {
      cause: options.cause,
    });

    this.name = "AppError";

    this.statusCode = statusCode;

    this.errorCode = errorCode;

    /**
     * Operational errors expected by the application.
     *
     * Example:
     * USER_NOT_FOUND
     * INVALID_CREDENTIALS
     *
     * Unexpected programming errors should not be marked
     * operational automatically.
     */
    this.isOperational = options.isOperational ?? true;

    /**
     * Optional structured validation details.
     *
     * Sensitive information must never be placed here.
     */
    this.errors = options.errors;

    /**
     * Capture stack trace without including unnecessary
     * constructor details.
     */
    Error.captureStackTrace(this, AppError);
  }
}