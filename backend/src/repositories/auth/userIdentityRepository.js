import { createDatabaseConnection } from "../../config/databaseConnection.js";

/**
 * Find an external authentication identity.
 *
 * Example:
 * provider = GOOGLE
 * providerUserId = "109283746..."
 *
 * Repository ka kaam:
 * - Database se identity find karna.
 *
 * Business logic yahan nahi rakhenge.
 */
export const findUserIdentity = async ({
  provider,
  providerUserId,
}) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    const [rows] = await connection.execute(
      `
      SELECT
          id,
          user_id,
          provider,
          provider_user_id,
          provider_email,
          is_active,
          created_at,
          updated_at
      FROM auth_user_identity
      WHERE provider = ?
        AND provider_user_id = ?
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [provider, providerUserId]
    );

    return rows.length > 0 ? rows[0] : null;
  } finally {
    await connection.end();
  }
};

/**
 * Find all external identities linked to a local user.
 *
 * Useful when:
 * - User profile shows connected accounts.
 * - User wants to see Google/Facebook connections.
 * - Security page displays linked login methods.
 */
export const findUserIdentitiesByUserId = async (userId) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    const [rows] = await connection.execute(
      `
      SELECT
          id,
          user_id,
          provider,
          provider_user_id,
          provider_email,
          is_active,
          created_at,
          updated_at
      FROM auth_user_identity
      WHERE user_id = ?
        AND deleted_at IS NULL
      ORDER BY created_at ASC
      `,
      [userId]
    );

    return rows;
  } finally {
    await connection.end();
  }
};

/**
 * Create/link an external authentication identity.
 *
 * Example:
 * A local user connects their Google account.
 */
export const createUserIdentity = async ({
  id,
  userId,
  provider,
  providerUserId,
  providerEmail = null,
}) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    await connection.execute(
      `
      INSERT INTO auth_user_identity (
          id,
          user_id,
          provider,
          provider_user_id,
          provider_email
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        id,
        userId,
        provider,
        providerUserId,
        providerEmail,
      ]
    );

    return {
      success: true,
      id,
    };
  } finally {
    await connection.end();
  }
};

/**
 * Deactivate an external authentication identity.
 *
 * We use soft delete instead of physically deleting the record.
 * This preserves historical/security information.
 */
export const deactivateUserIdentity = async ({
  userId,
  provider,
}) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    const [result] = await connection.execute(
      `
      UPDATE auth_user_identity
      SET
          is_active = FALSE,
          deleted_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
        AND provider = ?
        AND deleted_at IS NULL
      `,
      [
        userId,
        provider,
      ]
    );

    return {
      success: true,
      affectedRows: result.affectedRows,
    };
  } finally {
    await connection.end();
  }
};