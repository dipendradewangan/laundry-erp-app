import { createDatabaseConnection } from "./databaseConnection.js";

/**
 * Execute multiple database operations inside
 * a single MySQL transaction.
 *
 * Flow:
 *
 * BEGIN
 *   ↓
 * Execute callback
 *   ↓
 * SUCCESS → COMMIT
 *
 * ERROR
 *   ↓
 * ROLLBACK
 *
 * This helper is specifically useful for operations
 * where multiple tables must be updated together.
 */
export const executeTransaction = async (callback) => {
    const connection = await createDatabaseConnection("laundry_core");

    try {
        // Start transaction.
        await connection.beginTransaction();

        try {
            // Execute all operations using the same connection.
            const result = await callback(connection);

            // Everything succeeded.
            await connection.commit();

            return result;
        } catch (error) {
            // Something failed.
            // Undo every database operation performed
            // during this transaction.
            await connection.rollback();

            throw error;
        }
    } finally {
        // Always close the connection.
        await connection.end();
    }
};