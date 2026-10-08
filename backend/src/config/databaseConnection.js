/**
 * ============================================================
 * Laundry ERP - Database Connection
 * ============================================================
 *
 * Purpose:
 * --------
 * MySQL connection create karne ke liye common utility.
 *
 * Ye file kisi specific database ka business logic handle
 * nahi karti.
 *
 * Iska kaam sirf MySQL connection provide karna hai.
 *
 * Used by:
 * --------
 * 1. databaseBootstrap.js
 * 2. databaseSchemaInitializer.js
 * 3. Future database-related utilities
 * ============================================================
 */

import mysql from "mysql2/promise";

/**
 * Creates a connection to the MySQL SERVER.
 *
 * Is connection me database name intentionally nahi diya gaya
 * kyunki database exist na bhi kar sakta hai.
 *
 * Used for:
 * --------
 * CREATE DATABASE IF NOT EXISTS
 *
 * @returns {Promise<mysql.Connection>}
 */
export const createServerConnection = async () => {
  return mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",

    port: Number(process.env.MYSQL_PORT || 3306),

    user: process.env.MYSQL_USER,

    password: process.env.MYSQL_PASSWORD,
  });
};

/**
 * Creates a connection to a specific MySQL database.
 *
 * Example:
 *
 * createDatabaseConnection("laundry_core")
 *
 * createDatabaseConnection("laundry_audit")
 *
 * @param {string} databaseName
 * @returns {Promise<mysql.Connection>}
 */
export const createDatabaseConnection = async (databaseName) => {
  return mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",

    port: Number(process.env.MYSQL_PORT || 3306),

    user: process.env.MYSQL_USER,

    password: process.env.MYSQL_PASSWORD,

    database: databaseName,

    /**
     * Multiple statements intentionally disabled.
     *
     * Har SQL file ko controlled way me execute karenge.
     */
    multipleStatements: false,
  });
};