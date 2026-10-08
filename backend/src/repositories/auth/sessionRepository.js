import { createDatabaseConnection } from "../../config/databaseConnection.js";

/**
 * Create a new authentication session.
 *
 * This repository only handles database operations for
 * auth_session.
 *
 * Business logic such as:
 * - token generation
 * - expiry calculation
 * - session policy
 *
 * Service layer me rahega.
 */
export const createSession = async ({
  id,
  userId,
  sessionId,
  refreshTokenHash,

  deviceId = null,
  deviceType = null,
  deviceManufacturer = null,
  deviceModel = null,

  operatingSystem = null,
  operatingSystemVersion = null,

  browser = null,
  browserVersion = null,

  userAgent = null,

  ipAddress = null,
  forwardedFor = null,

  latitude = null,
  longitude = null,
  locationAccuracy = null,

  expiresAt,
}) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    await connection.execute(
      `
      INSERT INTO auth_session (
          id,
          user_id,
          session_id,
          refresh_token_hash,

          device_id,
          device_type,
          device_manufacturer,
          device_model,

          operating_system,
          operating_system_version,

          browser,
          browser_version,

          user_agent,

          ip_address,
          forwarded_for,

          latitude,
          longitude,
          location_accuracy,

          expires_at
      )
      VALUES (
          ?, ?, ?, ?,

          ?, ?, ?, ?,

          ?, ?,

          ?, ?,

          ?,

          ?, ?,

          ?, ?, ?,

          ?
      )
      `,
      [
        id,
        userId,
        sessionId,
        refreshTokenHash,

        deviceId,
        deviceType,
        deviceManufacturer,
        deviceModel,

        operatingSystem,
        operatingSystemVersion,

        browser,
        browserVersion,

        userAgent,

        ipAddress,
        forwardedFor,

        latitude,
        longitude,
        locationAccuracy,

        expiresAt,
      ]
    );

    return {
      success: true,
      id,
      sessionId,
    };
  } finally {
    await connection.end();
  }
};


/**
 * Find an active session by session ID.
 */
export const findActiveSessionBySessionId = async (sessionId) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    const [rows] = await connection.execute(
      `
      SELECT
          id,
          user_id,
          session_id,
          refresh_token_hash,

          device_id,
          device_type,
          device_manufacturer,
          device_model,

          operating_system,
          operating_system_version,

          browser,
          browser_version,

          user_agent,

          ip_address,
          forwarded_for,

          latitude,
          longitude,
          location_accuracy,

          created_at,
          last_activity_at,
          expires_at,
          revoked_at,
          revoke_reason,
          is_active

      FROM auth_session

      WHERE session_id = ?
        AND is_active = TRUE
        AND revoked_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP

      LIMIT 1
      `,
      [sessionId]
    );

    return rows.length > 0 ? rows[0] : null;
  } finally {
    await connection.end();
  }
};


/**
 * Update the last activity time of an active session.
 */
export const updateSessionActivity = async (sessionId) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    const [result] = await connection.execute(
      `
      UPDATE auth_session

      SET last_activity_at = CURRENT_TIMESTAMP

      WHERE session_id = ?
        AND is_active = TRUE
        AND revoked_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
      `,
      [sessionId]
    );

    return {
      success: true,
      affectedRows: result.affectedRows,
    };
  } finally {
    await connection.end();
  }
};


/**
 * Revoke a session.
 *
 * Used during:
 * - Logout
 * - Security action
 * - Password change
 * - Suspicious activity
 * - Admin forced logout
 */
export const revokeSession = async ({
  sessionId,
  revokeReason,
}) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    const [result] = await connection.execute(
      `
      UPDATE auth_session

      SET
          is_active = FALSE,
          revoked_at = CURRENT_TIMESTAMP,
          revoke_reason = ?

      WHERE session_id = ?
        AND is_active = TRUE
      `,
      [
        revokeReason,
        sessionId,
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