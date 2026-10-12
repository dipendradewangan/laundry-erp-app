/**
 * ============================================================
 * Laundry ERP - Database Connection
 * ============================================================
 *
 * Purpose:
 * --------
 * Centralized MySQL connection utility.
 *
 * Responsibilities:
 * -----------------
 * 1. Validate MySQL configuration.
 * 2. Create a server-level connection.
 * 3. Create a connection to a specific database.
 * 4. Configure connection timeout.
 * 5. Preserve original errors for debugging.
 *
 * IMPORTANT:
 * ----------
 * Database credentials must never be logged.
 * ============================================================
 */

import mysql from "mysql2/promise";

import { AppError } from "../utils/errors/AppError.js";

import { ERROR_CODES } from "../utils/errors/errorCodes.js";

/**
 * Connection timeout in milliseconds.
 *
 * If MySQL does not respond within this duration,
 * the connection attempt can fail.
 */
const CONNECTION_TIMEOUT = 10000;

/**
 * Validates the shared MySQL configuration.
 *
 * @returns {object} Validated connection configuration.
 */
const getMySqlConfig = () => {
  const host = process.env.MYSQL_HOST || "localhost";

  const port = Number(process.env.MYSQL_PORT || 3306);

  const user = process.env.MYSQL_USER;

  const password = process.env.MYSQL_PASSWORD;

  /**
   * Username is required.
   */
  if (!user || !user.trim()) {
    throw new AppError(
      "MySQL username is not configured",
      500,
      ERROR_CODES.DATABASE_CONNECTION_FAILED
    );
  }

  /**
   * Password must be explicitly configured.
   *
   * Empty passwords are not silently accepted.
   */
  if (typeof password !== "string" || password.length === 0) {
    throw new AppError(
      "MySQL password is not configured",
      500,
      ERROR_CODES.DATABASE_CONNECTION_FAILED
    );
  }

  /**
   * Validate the TCP port.
   */
  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new AppError(
      "MySQL port configuration is invalid",
      500,
      ERROR_CODES.DATABASE_CONNECTION_FAILED
    );
  }

  return {
    host,
    port,
    user,
    password,
    connectTimeout: CONNECTION_TIMEOUT,
  };
};

/**
 * Creates a connection to the MySQL server.
 *
 * Used by:
 * --------
 * databaseBootstrap.js
 *
 * Purpose:
 * --------
 * Create or verify application databases.
 *
 * @returns {Promise<mysql.Connection>}
 */
export const createServerConnection = async () => {
  try {
    const config = getMySqlConfig();

    return await mysql.createConnection(config);
  } catch (error) {
    /**
     * Preserve already-standardized configuration errors.
     */
    if (error instanceof AppError) {
      throw error;
    }

    /**
     * Do not expose credentials or raw driver messages
     * to the API/client.
     *
     * The original error remains available through cause.
     */
    throw new AppError(
      "Unable to connect to the MySQL server",
      503,
      ERROR_CODES.DATABASE_CONNECTION_FAILED,
      {
        cause: error,
        isOperational: true,
      }
    );
  }
};

/**
 * Creates a connection to a specific database.
 *
 * Examples:
 * ---------
 * createDatabaseConnection("laundry_core")
 * createDatabaseConnection("laundry_audit")
 *
 * @param {string} databaseName
 * @returns {Promise<mysql.Connection>}
 */
export const createDatabaseConnection = async (databaseName) => {
  /**
   * Only application-controlled database names should be
   * passed to this function.
   */
  if (
    typeof databaseName !== "string" ||
    !/^[a-zA-Z0-9_]+$/.test(databaseName)
  ) {
    throw new AppError(
      "Database name configuration is invalid",
      500,
      ERROR_CODES.DATABASE_CONNECTION_FAILED
    );
  }

  try {
    const config = getMySqlConfig();

    return await mysql.createConnection({
      ...config,

      database: databaseName,

      /**
       * Multiple SQL statements remain disabled.
       */
      multipleStatements: false,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      `Unable to connect to database: ${databaseName}`,
      503,
      ERROR_CODES.DATABASE_CONNECTION_FAILED,
      {
        cause: error,
        isOperational: true,
      }
    );
  }
};