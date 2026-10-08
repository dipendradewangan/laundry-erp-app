/**
 * ============================================================
 * Laundry ERP - Application Server
 * ============================================================
 *
 * Startup Flow:
 * -------------
 *
 * 1. Load environment variables
 * 2. Verify/Create required databases
 * 3. Verify/Create database tables using SQL files
 * 4. Start Express application
 *
 * IMPORTANT:
 * ------------
 * Database initialization complete hone ke baad hi
 * Express server start hoga.
 * ============================================================
 */

import "dotenv/config";

import app from "./src/app.js";

import {
  initializeDatabases,
} from "./src/config/databaseBootstrap.js";

import {
  initializeDatabaseSchemas,
} from "./src/config/databaseSchemaInitializer.js";

/**
 * Application port.
 */
const PORT = Number(
  process.env.PORT || 5000
);

/**
 * Starts the application.
 *
 * Database initialization fail hone par
 * application start nahi hogi.
 */
const startServer = async () => {
  try {
    /**
     * ==========================================
     * STEP 1
     * Database Bootstrap
     * ==========================================
     *
     * Required databases:
     *     laundry_core
     *     laundry_audit
     *
     * Database missing:
     *     Create
     *
     * Database exists:
     *     Continue
     */
    await initializeDatabases();

    /**
     * ==========================================
     * STEP 2
     * Database Schema Initialization
     * ==========================================
     *
     * SQL files:
     *
     * database/core/
     * database/audit/
     *
     * Table exists:
     *     Skip
     *
     * Table missing:
     *     Create
     */
    await initializeDatabaseSchemas();

    /**
     * ==========================================
     * STEP 3
     * Start Express Server
     * ==========================================
     */
    app.listen(PORT, () => {
      console.log("");
      console.log("==========================================");
      console.log("       Laundry ERP API Server");
      console.log("==========================================");
      console.log(
        `✓ Server running on: http://localhost:${PORT}`
      );
      console.log(
        `✓ Environment: ${process.env.NODE_ENV || "development"}`
      );
      console.log("==========================================");
      console.log("");
    });
  } catch (error) {
    /**
     * Database initialization ya server startup
     * me koi bhi critical error aaye to application
     * start nahi hogi.
     */
    console.error("");
    console.error("==========================================");
    console.error("❌ APPLICATION STARTUP FAILED");
    console.error("==========================================");
    console.error(error.message);
    console.error("==========================================");
    console.error("");

    process.exit(1);
  }
};

/**
 * Start application.
 */
startServer();