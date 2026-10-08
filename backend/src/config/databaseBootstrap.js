/**
 * ============================================================
 * Laundry ERP - Database Bootstrap
 * ============================================================
 *
 * Purpose:
 * --------
 * Application start hone par required MySQL databases
 * automatically verify/create karna.
 *
 * Databases:
 * ----------
 * 1. laundry_core
 * 2. laundry_audit
 *
 * IMPORTANT:
 * ----------
 * Ye file TABLES create nahi karti.
 *
 * Database creation:
 *     Database Bootstrap
 *
 * Table/schema creation:
 *     Database Schema Initializer
 *
 * Common MySQL connection:
 *     databaseConnection.js
 * ============================================================
 */

import {
  createServerConnection,
} from "./databaseConnection.js";

/**
 * Required application databases.
 *
 * Ye application ke fixed infrastructure databases hain.
 */
const REQUIRED_DATABASES = [
  "laundry_core",
  "laundry_audit",
];

/**
 * Creates a database if it does not already exist.
 *
 * @param {mysql.Connection} connection
 * @param {string} databaseName
 */
const ensureDatabaseExists = async (
  connection,
  databaseName
) => {
  /**
   * Database name application-controlled constant hai.
   * Isliye SQL injection ka risk nahi hai.
   */
  const safeDatabaseName = `\`${databaseName}\``;

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS ${safeDatabaseName}
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci`
  );

  console.log(`✓ Database verified: ${databaseName}`);
};

/**
 * Main database bootstrap function.
 *
 * Flow:
 * -----
 * MySQL Server
 *     ↓
 * Connect
 *     ↓
 * Check/Create laundry_core
 *     ↓
 * Check/Create laundry_audit
 *     ↓
 * Close connection
 *
 * @returns {Promise<void>}
 */
export const initializeDatabases = async () => {
  let connection;

  try {
    console.log("");
    console.log("==========================================");
    console.log("       Database Bootstrap");
    console.log("==========================================");

    /**
     * Connect to MySQL SERVER.
     *
     * Connection logic databaseConnection.js
     * se aa raha hai.
     */
    connection = await createServerConnection();

    console.log("✓ MySQL server connection successful");

    /**
     * Verify/create all required databases.
     */
    for (const databaseName of REQUIRED_DATABASES) {
      await ensureDatabaseExists(
        connection,
        databaseName
      );
    }

    console.log("==========================================");
    console.log("✓ Database bootstrap completed");
    console.log("==========================================");
    console.log("");
  } catch (error) {
    console.error("");
    console.error("==========================================");
    console.error("❌ DATABASE BOOTSTRAP FAILED");
    console.error("==========================================");
    console.error(error.message);
    console.error("==========================================");
    console.error("");

    /**
     * Invalid database state me application start
     * nahi honi chahiye.
     */
    throw error;
  } finally {
    /**
     * MySQL server connection close.
     */
    if (connection) {
      await connection.end();
    }
  }
};