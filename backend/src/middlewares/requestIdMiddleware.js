/**
 * ============================================================
 * Laundry ERP - Request ID Middleware
 * ============================================================
 *
 * Purpose:
 * --------
 * Har incoming HTTP request ko unique request ID dena.
 *
 * Benefits:
 * ---------
 * 1. Error logs ko request ke saath correlate karna.
 * 2. API responses mein request ID return karna.
 * 3. Future audit events ko trace karna.
 *
 * Security:
 * ---------
 * Client-provided request IDs ko directly trust nahi karenge.
 * Server apni unique ID generate karega.
 * ============================================================
 */

import { randomUUID } from "node:crypto";

/**
 * Assigns a unique ID to each incoming request.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {function} next - Next middleware.
 */
export const requestIdMiddleware = (req, res, next) => {
  /**
   * Server-generated unique request ID.
   *
   * UUID collisions are extraordinarily unlikely.
   */
  const requestId = randomUUID();

  /**
   * Request ID ko request object par store karte hain,
   * taaki controllers aur error handlers ise access kar saken.
   */
  req.requestId = requestId;

  /**
   * Response header mein request ID return karte hain.
   */
  res.setHeader("X-Request-ID", requestId);

  console.log("Request ID generated:", requestId);

  next();
};