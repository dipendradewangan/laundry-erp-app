import { createDatabaseConnection } from "../../config/databaseConnection.js";

/**
 * Find a user using email OR phone number.
 *
 * This replaces the old username/email/phone based lookup.
 *
 * @param {string} identity - User's email or mobile number.
 * @returns {object|null} User record or null.
 */
export const findUserByIdentity = async (identity) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    const [rows] = await connection.execute(
      `
        SELECT
          id,
          email,
          phone,
          first_name,
          middle_name,
          last_name,
          password_hash,
          is_login_enabled,
          last_login_at,
          failed_login_attempts,
          locked_until,
          is_active,
          created_at,
          updated_at,
          deleted_at
        FROM master_user
        WHERE
          (email = ? OR phone = ?)
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [identity, identity]
    );

    return rows[0] || null;
  } finally {
    await connection.end();
  }
};

/**
 * Increment failed login attempts for a user.
 *
 * The actual lock decision is handled by the authentication service.
 *
 * @param {string} userId
 */
export const incrementFailedLoginAttempts = async (userId) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    await connection.execute(
      `
        UPDATE master_user
        SET failed_login_attempts = failed_login_attempts + 1
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      [userId]
    );
  } finally {
    await connection.end();
  }
};

/**
 * Lock a user account until a specific time.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {Date} params.lockedUntil
 */
export const lockUserAccount = async ({ userId, lockedUntil }) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    await connection.execute(
      `
        UPDATE master_user
        SET locked_until = ?
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      [lockedUntil, userId]
    );
  } finally {
    await connection.end();
  }
};

/**
 * Reset failed login attempts after successful authentication.
 *
 * @param {string} userId
 */
export const resetFailedLoginAttempts = async (userId) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    await connection.execute(
      `
        UPDATE master_user
        SET
          failed_login_attempts = 0,
          locked_until = NULL
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      [userId]
    );
  } finally {
    await connection.end();
  }
};

/**
 * Update the last successful login timestamp.
 *
 * @param {string} userId
 */
export const updateLastLogin = async (userId) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    await connection.execute(
      `
        UPDATE master_user
        SET last_login_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      [userId]
    );
  } finally {
    await connection.end();
  }
};

/**
 * Find an active user using email.
 *
 * Used mainly for social-login account linking.
 *
 * IMPORTANT:
 * We do not automatically link a Google/Facebook account
 * just because the email matches.
 *
 * The authentication service will require explicit
 * account-linking logic.
 *
 * @param {string} email
 * @returns {object|null}
 */
export const findActiveUserByEmail = async (email) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    const [rows] = await connection.execute(
      `
        SELECT
          id,
          email,
          phone,
          first_name,
          middle_name,
          last_name,
          password_hash,
          is_login_enabled,
          is_active,
          created_at,
          updated_at
        FROM master_user
        WHERE email = ?
          AND is_active = TRUE
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [email]
    );

    return rows[0] || null;
  } finally {
    await connection.end();
  }
};