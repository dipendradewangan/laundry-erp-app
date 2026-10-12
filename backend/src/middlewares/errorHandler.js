/**
 * ============================================================
 * Laundry ERP - Global Error Handler
 * ============================================================
 *
 * File:
 *     backend/src/middlewares/errorHandler.js
 *
 * Purpose:
 * --------
 * Express application ke errors ko centrally handle karna.
 *
 * Responsibilities:
 * -----------------
 * 1. Application errors handle karna.
 * 2. Zod validation errors handle karna.
 * 3. JWT errors handle karna.
 * 4. MySQL errors ko safe response mein convert karna.
 * 5. Standard JSON response return karna.
 * 6. Production mein internal details hide karna.
 * ============================================================
 */

import { AppError } from "../utils/errors/AppError.js";

import { ERROR_CODES } from "../utils/errors/errorCodes.js";

import { createErrorResponse } from "../utils/errors/errorResponse.js";

/**
 * ============================================================
 * ERROR LOGGER
 * ============================================================
 *
 * Abhi structured console logging use kar rahe hain.
 *
 * Development:
 *   Original error message aur stack trace log karenge.
 *
 * Production:
 *   Internal details response mein expose nahi hongi.
 */
const logError = (error, req, statusCode, originalError = error) => {
  console.error({
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    requestId: req.requestId || null,
    statusCode,
    errorCode:
      originalError.errorCode ||
      originalError.code ||
      error.errorCode ||
      error.code ||
      null,
    message: originalError.message || error.message,
  });

  // Development environment mein original stack trace bhi dikhao.
  if (process.env.NODE_ENV !== "production") {
    console.error("Original error stack:", originalError.stack);

    // MySQL errors ke additional diagnostic fields.
    if (originalError.sqlMessage) {
      console.error("MySQL error:", originalError.sqlMessage);
    }

    if (originalError.sqlState) {
      console.error("MySQL SQLSTATE:", originalError.sqlState);
    }
  }
};

/**
 * ============================================================
 * ERROR NORMALIZER
 * ============================================================
 *
 * Different error types ko standard AppError mein convert
 * karta hai.
 */
const normalizeError = (error) => {
  // Already standardized application error.
  if (error instanceof AppError) {
    return error;
  }

  // Zod validation error.
  if (error?.name === "ZodError") {
    return new AppError(
      "Validation failed",
      400,
      ERROR_CODES.VALIDATION_ERROR,
      {
        cause: error,
        errors: Array.isArray(error.issues)
          ? error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          }))
          : [],
      }
    );
  }

  // JWT expired token.
  if (error?.name === "TokenExpiredError") {
    return new AppError(
      "Authentication token has expired",
      401,
      ERROR_CODES.TOKEN_EXPIRED,
      { cause: error }
    );
  }

  // Invalid JWT.
  if (error?.name === "JsonWebTokenError") {
    return new AppError(
      "Invalid authentication token",
      401,
      ERROR_CODES.INVALID_TOKEN,
      { cause: error }
    );
  }

  // MySQL duplicate entry.
  if (error?.code === "ER_DUP_ENTRY") {
    return new AppError(
      "A record with the same unique value already exists",
      409,
      ERROR_CODES.DUPLICATE_RESOURCE,
      { cause: error }
    );
  }

  // MySQL foreign key constraint violation.
  if (
    error?.code === "ER_ROW_IS_REFERENCED_2" ||
    error?.code === "ER_NO_REFERENCED_ROW_2"
  ) {
    return new AppError(
      "The operation violates a related record constraint",
      409,
      ERROR_CODES.DATABASE_CONSTRAINT_VIOLATION,
      { cause: error }
    );
  }

  // Express JSON body parsing error.
  if (
    error?.type === "entity.parse.failed" &&
    error?.status === 400
  ) {
    return new AppError(
      "Invalid JSON request body",
      400,
      ERROR_CODES.INVALID_REQUEST,
      { cause: error }
    );
  }

  // Request body exceeds configured limit.
  if (
    error?.type === "entity.too.large" &&
    error?.status === 413
  ) {
    return new AppError(
      "Request body is too large",
      413,
      ERROR_CODES.INVALID_REQUEST,
      { cause: error }
    );
  }

  // Unknown errors remain internal errors.
  return new AppError(
    "An unexpected error occurred",
    500,
    ERROR_CODES.INTERNAL_SERVER_ERROR,
    {
      cause: error,
      isOperational: false,
    }
  );
};

/**
 * ============================================================
 * GLOBAL ERROR HANDLER
 * ============================================================
 *
 * Express error middleware mein exactly 4 parameters hone
 * chahiye: err, req, res, next.
 */
export const errorHandler = (err, req, res, next) => {
  /**
   * Response already send ho chuka ho toh Express ko
   * remaining error handling karne denge.
   */
  if (res.headersSent) {
    return next(err);
  }

  const error = normalizeError(err);

  const isProduction =
    process.env.NODE_ENV === "production";

  /**
   * Unexpected internal errors ko 500 hi return karenge.
   *
   * Operational errors mein configured status code use hoga.
   */
  const statusCode = error.isOperational
    ? error.statusCode
    : 500;

  /**
   * Har error log karenge.
   *
   * Sensitive request body aur headers log nahi kar rahe.
   */
  logError(error, req, statusCode, err);

  /**
   * Internal error details production mein expose nahi honge.
   */
  const message =
    statusCode === 500
      ? "An unexpected error occurred"
      : error.message;

  const response = createErrorResponse({
    message,
    errorCode:
      statusCode === 500
        ? ERROR_CODES.INTERNAL_SERVER_ERROR
        : error.errorCode,
    requestId: req.requestId || null,
    errors:
      statusCode !== 500
        ? error.errors || null
        : null,
  });

  return res.status(statusCode).json(response);
};