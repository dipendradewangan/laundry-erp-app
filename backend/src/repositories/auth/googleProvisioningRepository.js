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
 * ============================================================
 * Create Google Authentication Session
 * ============================================================
 *
 * Responsibilities:
 * 1. Create an authentication session.
 * 2. Insert the initial refresh-token hash into token history.
 * 3. Mark the initial refresh token as ACTIVE.
 *
 * IMPORTANT:
 * Both records are inserted using the same transaction
 * connection. If either insert fails, the caller's transaction
 * should roll back both operations.
 *
 * The plaintext refresh token is never stored in the database.
 * ============================================================
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
  // ----------------------------------------------------------
  // STEP 1: Validate required authentication session data.
  // ----------------------------------------------------------

  if (!id || !sessionId || !userId || !expiresAt) {
    throw new Error(
      "Required Google authentication session data is missing."
    );
  }

  // Only a valid 64-character SHA-256 hash is accepted.
  if (
    typeof refreshTokenHash !== "string" ||
    !/^[a-f0-9]{64}$/i.test(refreshTokenHash)
  ) {
    throw new Error(
      "A valid refresh-token SHA-256 hash is required."
    );
  }

  // ----------------------------------------------------------
  // STEP 2: Insert the authentication session.
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // STEP 3: Insert the initial refresh-token history record.
  // ----------------------------------------------------------
  //
  // The initial token must be ACTIVE so that
  // rotateRefreshTokenByHash() can rotate it successfully.
  //
  // Use the same session_id and hash as auth_session.
  // ----------------------------------------------------------

  await connection.execute(
    `
      INSERT INTO auth_refresh_token_history (
        id,
        session_id,
        refresh_token_hash,
        token_status,
        created_at
      )
      VALUES (
        UUID(),
        ?,
        ?,
        'ACTIVE',
        CURRENT_TIMESTAMP
      )
    `,
    [
      sessionId,
      refreshTokenHash,
    ]
  );

  // ----------------------------------------------------------
  // STEP 4: Return the session information.
  // ----------------------------------------------------------

  return {
    id,
    sessionId,
    userId,
    expiresAt,
  };
};