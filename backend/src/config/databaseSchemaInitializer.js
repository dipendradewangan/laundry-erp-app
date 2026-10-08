/**
 * ============================================================
 * Laundry ERP - Database Schema Initializer
 * ============================================================
 *
 * Purpose:
 * --------
 * Application start hone par required SQL schema files
 * automatically execute karna.
 *
 * Core database:
 *     laundry_core
 *
 * Audit database:
 *     laundry_audit
 *
 * SQL files:
 * ----------
 * backend/database/core/
 * backend/database/audit/
 *
 * IMPORTANT:
 * ----------
 * Ye Prisma use nahi karta.
 *
 * Database structure completely MySQL SQL files ke through
 * manage hota hai.
 *
 * Example:
 *
 * CREATE TABLE IF NOT EXISTS company_master (...);
 *
 * Agar table already exist karta hai:
 *     MySQL safely skip karega.
 *
 * Agar table exist nahi karta:
 *     MySQL table create karega.
 *
 * Common MySQL connection:
 *     databaseConnection.js
 * ============================================================
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDatabaseConnection,
} from "./databaseConnection.js";

/**
 * Current file ka absolute path.
 */
const __filename = fileURLToPath(import.meta.url);

/**
 * Current config directory ka absolute path.
 */
const __dirname = path.dirname(__filename);

/**
 * Backend root directory.
 *
 * Structure:
 *
 * backend/
 * ├── database/
 * └── src/
 *     └── config/
 *
 * config se ../.. karne par backend milta hai.
 */
const BACKEND_ROOT = path.resolve(
  __dirname,
  "../.."
);

/**
 * Core database SQL directory.
 */
const CORE_DATABASE_PATH = path.join(
  BACKEND_ROOT,
  "database",
  "core"
);

/**
 * Audit database SQL directory.
 */
const AUDIT_DATABASE_PATH = path.join(
  BACKEND_ROOT,
  "database",
  "audit"
);

/**
 * Reads all SQL files from a directory.
 *
 * Only .sql files are loaded.
 *
 * Files alphabetically sort honge.
 *
 * Example:
 *
 * 001_create_master_company.sql
 * 002_create_master_region.sql
 * 003_create_master_zone.sql
 *
 * Isi order me execute honge.
 *
 * @param {string} directoryPath
 * @returns {Promise<string[]>}
 */
const getSqlFiles = async (directoryPath) => {
  const files = await fs.readdir(directoryPath);

  return files
    .filter((file) =>
      file.toLowerCase().endsWith(".sql")
    )
    .sort();
};

/**
 * Executes all SQL files for one database.
 *
 * @param {string} databaseName
 * @param {string} directoryPath
 * @returns {Promise<void>}
 */
const initializeDatabaseSchema = async (
  databaseName,
  directoryPath
) => {
  let connection;

  try {
    console.log("");
    console.log("------------------------------------------");
    console.log(
      `Schema Initialization: ${databaseName}`
    );
    console.log("------------------------------------------");

    /**
     * Connect to the specific database.
     *
     * Connection logic shared utility se aa raha hai.
     */
    connection = await createDatabaseConnection(
      databaseName
    );

    console.log(
      `✓ Connected to database: ${databaseName}`
    );

    /**
     * Get SQL files in alphabetical/execution order.
     */
    const sqlFiles = await getSqlFiles(
      directoryPath
    );

    /**
     * Agar directory me koi SQL file nahi hai.
     */
    if (sqlFiles.length === 0) {
      console.log("✓ No SQL schema files found");
      return;
    }

    /**
     * Execute SQL files one by one.
     */
    for (const sqlFile of sqlFiles) {
      const filePath = path.join(
        directoryPath,
        sqlFile
      );

      console.log(`→ Checking: ${sqlFile}`);

      /**
       * Read SQL file.
       */
      const sql = await fs.readFile(
        filePath,
        "utf8"
      );

      /**
       * Empty SQL file ko ignore karenge.
       */
      if (!sql.trim()) {
        console.log(
          `  ✓ Skipped empty file: ${sqlFile}`
        );

        continue;
      }

      /**
       * Execute SQL.
       *
       * Example:
       *
       * CREATE TABLE IF NOT EXISTS company_master (...)
       *
       * Table exists:
       *     MySQL skips creation.
       *
       * Table missing:
       *     MySQL creates it.
       */
      await connection.query(sql);

      console.log(
        `  ✓ Verified: ${sqlFile}`
      );
    }

    console.log(
      `✓ Schema initialization completed: ${databaseName}`
    );
  } catch (error) {
    console.error("");
    console.error(
      `❌ SCHEMA INITIALIZATION FAILED: ${databaseName}`
    );
    console.error(error.message);
    console.error("");

    throw error;
  } finally {
    /**
     * Database connection close.
     */
    if (connection) {
      await connection.end();
    }
  }
};

/**
 * Main schema initialization function.
 *
 * Execution order:
 *
 * 1. laundry_core
 * 2. laundry_audit
 *
 * @returns {Promise<void>}
 */
export const initializeDatabaseSchemas = async () => {
  console.log("");
  console.log("==========================================");
  console.log("    Database Schema Initialization");
  console.log("==========================================");

  /**
   * Core database schema.
   */
  await initializeDatabaseSchema(
    "laundry_core",
    CORE_DATABASE_PATH
  );

  /**
   * Audit database schema.
   */
  await initializeDatabaseSchema(
    "laundry_audit",
    AUDIT_DATABASE_PATH
  );

  console.log("==========================================");
  console.log("✓ All database schemas are ready");
  console.log("==========================================");
  console.log("");
};