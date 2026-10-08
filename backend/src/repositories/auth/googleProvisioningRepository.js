import { randomUUID } from "node:crypto";

/**
 * Create a new customer user using the existing transaction
 * connection.
 *
 * IMPORTANT:
 * This function does NOT create its own database connection.
 * The connection is supplied by executeTransaction().
 *
 * This allows user + Google identity + session to be created
 * inside one atomic transaction.
 */
export const createCustomerUser = async (
  connection,
  {
    email,
    firstName,
    lastName,
  }
) => {
  const userId = randomUUID();

  /**
   * Customer created through Google authentication does not
   * have a local password initially.
   *
   * Therefore password_hash is explicitly NULL.
   */
  await connection.execute(
    `
      INSERT INTO master_user (
        id,
        email,
        phone,
        first_name,
        middle_name,
        last_name,
        password_hash,
        is_login_enabled,
        failed_login_attempts,
        is_active
      )
      VALUES (?, ?, NULL, ?, NULL, ?, NULL, TRUE, 0, TRUE)
    `,
    [
      userId,
      email,
      firstName || "Customer",
      lastName || null,
    ]
  );

  return {
    id: userId,
    email,
    phone: null,
    firstName: firstName || "Customer",
    lastName: lastName || null,
  };
};

/**
 * Create a Google identity for a user.
 *
 * The Google provider_user_id is the stable Google identifier
 * received from the verified Google ID token.
 */
export const createGoogleUserIdentity = async (
  connection,
  {
    userId,
    providerUserId,
    providerEmail,
  }
) => {
  const identityId = randomUUID();

  await connection.execute(
    `
      INSERT INTO auth_user_identity (
        id,
        user_id,
        provider,
        provider_user_id,
        provider_email,
        is_active
      )
      VALUES (?, ?, 'GOOGLE', ?, ?, TRUE)
    `,
    [
      identityId,
      userId,
      providerUserId,
      providerEmail || null,
    ]
  );

  return {
    id: identityId,
    userId,
    provider: "GOOGLE",
    providerUserId,
    providerEmail: providerEmail || null,
  };
};



/**
 * Create an authentication session using the same
 * transaction connection.
 *
 * IMPORTANT:
 * This function does not create its own connection.
 *
 * The session is created in the same transaction as:
 *
 *   master_user
 *   auth_user_identity
 *   auth_session
 *
 * Therefore, if session creation fails, the complete
 * Google customer provisioning transaction can be rolled back.
 */
export const createGoogleAuthSession = async (
  connection,
  {
    id,
    sessionId,
    userId,
    refreshTokenHash,

    deviceId = null,
    deviceType = null,
    deviceManufacturer = null,
    deviceModel = null,

    osName = null,
    osVersion = null,

    browserName = null,
    browserVersion = null,

    screenWidth = null,
    screenHeight = null,
    pixelRatio = null,

    userAgent = null,
    ipAddress = null,
    forwardedFor = null,

    latitude = null,
    longitude = null,
    locationAccuracy = null,

    expiresAt,
  }
) => {
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

        os_name,
        os_version,

        browser_name,
        browser_version,

        screen_width,
        screen_height,
        pixel_ratio,

        user_agent,
        ip_address,
        forwarded_for,

        latitude,
        longitude,
        location_accuracy,

        created_at,
        last_activity_at,
        expires_at,
        is_active
      )
      VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        ?,
        TRUE
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

      osName,
      osVersion,

      browserName,
      browserVersion,

      screenWidth,
      screenHeight,
      pixelRatio,

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
    id,
    sessionId,
    userId,
    expiresAt,
  };
};