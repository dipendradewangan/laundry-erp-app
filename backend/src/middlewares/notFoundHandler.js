/**
 * ============================================================
 * Laundry ERP - 404 Not Found Handler
 * ============================================================
 *
 * File:
 *     backend/src/middlewares/notFoundHandler.js
 *
 * Purpose:
 * --------
 * Unknown API routes ko handle karna.
 *
 * Example:
 * --------
 * GET /api/unknown
 *
 * Response:
 * ---------
 * HTTP 404 Not Found
 *
 * IMPORTANT:
 * ----------
 * Ye middleware error response khud generate karta hai.
 * Isko global error handler se pehle register karna hai.
 * ============================================================
 */

import { AppError } from "../utils/errors/AppError.js";

import { ERROR_CODES } from "../utils/errors/errorCodes.js";

/**
 * Handles requests for routes that do not exist.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {function} next - Express next middleware.
 */
export const notFoundHandler = (req, res, next) => {
  /**
   * Unknown route ko centralized error handler tak bhejte hain.
   *
   * Isse 404 response bhi hamare standard JSON format mein
   * return hoga.
   */
  next(
    new AppError(
      `API endpoint not found: ${req.method} ${req.originalUrl}`,
      404,
      ERROR_CODES.ROUTE_NOT_FOUND
    )
  );
};