/**
 * ============================================================
 * Laundry ERP - Google Authentication Service
 * ============================================================
 *
 * File:
 * -----
 * src/services/auth/googleAuthService.js
 *
 * Responsibilities:
 * -----------------
 * 1. Verify Google ID tokens.
 * 2. Authenticate existing Google users.
 * 3. Register new Google users.
 * 4. Create authentication sessions.
 * 5. Prevent automatic account linking.
 * 6. Record Google authentication audit events.
 *
 * Database:
 * ---------
 * Business data:
 *   laundry_core
 *
 * Audit data:
 *   laundry_audit
 *
 * Important:
 * ----------
 * - Google identity is verified by the backend.
 * - Google identity is never trusted directly from frontend data.
 * - Existing accounts are not automatically linked.
 * - Refresh tokens are stored as SHA-256 hashes in the database.
 * - Authentication credentials are never written to audit logs.
 * ============================================================
 */

import crypto from "node:crypto";

import jwt from "jsonwebtoken";

import { googleOAuthClient } from "../../config/googleAuth.js";

import { executeTransaction } from "../../config/databaseTransaction.js";

import {
  findUserIdentity,
} from "../../repositories/auth/userIdentityRepository.js";

import {
  findActiveUserByEmail,
  findUserForGoogleAuthentication,
} from "../../repositories/auth/userRepository.js";

import {
  createCustomerUser,
  createGoogleUserIdentity,
  createGoogleAuthSession,
} from "../../repositories/auth/googleProvisioningRepository.js";

import {
  recordAuditEvent,
} from "../audit/auditService.js";


/**
 * ============================================================
 * 1. Verify Google Identity
 * ============================================================
 *
 * Google ID token verify karta hai.
 *
 * Verification includes:
 * - Token signature
 * - Token audience
 * - Token validity
 *
 * @param {string} googleIdToken
 * @returns {Promise<Object>}
 */
export const verifyGoogleIdentity = async (googleIdToken) => {
  if (
    typeof googleIdToken !== "string" ||
    !googleIdToken.trim()
  ) {
    throw new Error("Google ID token is required.");
  }

  const ticket = await googleOAuthClient.verifyIdToken({
    idToken: googleIdToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.sub) {
    throw new Error("Invalid Google identity.");
  }

  return {
    providerUserId: payload.sub,

    providerEmail: payload.email || null,

    emailVerified: payload.email_verified === true,

    firstName: payload.given_name || null,

    lastName: payload.family_name || null,

    picture: payload.picture || null,
  };
};


/**
 * ============================================================
 * 2. Generate Google Authentication Session
 * ============================================================
 *
 * Creates:
 * - Database session ID
 * - Public session ID
 * - Refresh token
 * - Refresh token SHA-256 hash
 * - Access JWT
 *
 * The plaintext refresh token is returned to the client.
 * Only its SHA-256 hash is persisted in the database.
 *
 * @param {Object} sessionData
 * @returns {Object}
 */
const generateGoogleSessionData = ({
  userId,

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
}) => {
  if (!userId) {
    throw new Error(
      "User ID is required to generate an authentication session.",
    );
  }

  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET is not configured.");
  }

  // Internal primary key for auth_session.
  const id = crypto.randomUUID();

  // Public session identifier used in the access JWT.
  const sessionId = crypto.randomUUID();

  // Generate a cryptographically secure refresh token.
  const refreshToken = crypto.randomBytes(64).toString("hex");

  // Persist only the SHA-256 hash of the refresh token.
  const refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  // Refresh session validity: 30 days.
  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  );

  // Generate a short-lived access token.
  const accessToken = jwt.sign(
    {
      sub: userId,
      sid: sessionId,
      authMethod: "GOOGLE",
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: "15m",
      issuer: "laundry-erp",
      audience: "laundry-erp-api",
    },
  );

  return {
    id,
    sessionId,

    refreshToken,
    refreshTokenHash,

    accessToken,
    expiresAt,

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
  };
};


/**
 * ============================================================
 * 3. Create Authentication Session Record
 * ============================================================
 *
 * Common repository call for creating an authentication session.
 *
 * This helper does not start a transaction itself.
 * The caller supplies the active transaction connection.
 *
 * @param {Object} connection
 * @param {Object} sessionData
 * @param {string} userId
 * @returns {Promise<Object>}
 */
const persistGoogleSession = async (
  connection,
  sessionData,
  userId,
) => {
  return createGoogleAuthSession(connection, {
    id: sessionData.id,

    sessionId: sessionData.sessionId,

    userId,

    refreshTokenHash: sessionData.refreshTokenHash,

    deviceId: sessionData.deviceId,
    deviceType: sessionData.deviceType,
    deviceManufacturer: sessionData.deviceManufacturer,
    deviceModel: sessionData.deviceModel,

    osName: sessionData.osName,
    osVersion: sessionData.osVersion,

    browserName: sessionData.browserName,
    browserVersion: sessionData.browserVersion,

    screenWidth: sessionData.screenWidth,
    screenHeight: sessionData.screenHeight,
    pixelRatio: sessionData.pixelRatio,

    userAgent: sessionData.userAgent,
    ipAddress: sessionData.ipAddress,
    forwardedFor: sessionData.forwardedFor,

    latitude: sessionData.latitude,
    longitude: sessionData.longitude,
    locationAccuracy: sessionData.locationAccuracy,

    expiresAt: sessionData.expiresAt,
  });
};


/**
 * ============================================================
 * 4. Record Google Authentication Audit Event
 * ============================================================
 *
 * Reusable audit helper.
 *
 * The audit repository uses a separate connection to
 * laundry_audit.
 *
 * IMPORTANT:
 * ----------
 * Do not add passwords, Google credentials, access tokens,
 * refresh tokens, or their hashes to this payload.
 *
 * @param {Object} params
 * @returns {Promise<Object>}
 */
const recordGoogleAudit = async ({
  action,
  status,

  userId = null,
  sessionId = null,
  attemptedIdentity = null,

  entity = null,
  entityId = null,

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

  failureReason = null,
  metadata = null,
}) => {
  return recordAuditEvent({
    action,

    module: "AUTH",

    entity,
    entityId,

    userId,
    sessionId,
    attemptedIdentity,

    deviceId,
    deviceType,
    deviceManufacturer,
    deviceModel,

    operatingSystem: osName,
    operatingSystemVersion: osVersion,

    browser: browserName,
    browserVersion,

    screenWidth,
    screenHeight,
    devicePixelRatio: pixelRatio,

    userAgent,
    ipAddress,
    forwardedFor,

    latitude,
    longitude,
    locationAccuracy,

    status,
    failureReason,

    metadata,
  });
};


/**
 * ============================================================
 * 5. Login With Google
 * ============================================================
 *
 * Scenarios:
 *
 * A. Existing Google identity:
 *    - Create a new session.
 *    - Record LOGIN audit event.
 *
 * B. Existing local account:
 *    - Do not automatically link Google.
 *    - Return ACCOUNT_LINKING_REQUIRED.
 *
 * C. New Google user:
 *    - Create user.
 *    - Create Google identity.
 *    - Create session.
 *    - Record REGISTER audit event.
 *
 * D. Invalid or rejected Google identity:
 *    - Return an appropriate failure reason.
 *    - Record a corresponding audit event where applicable.
 *
 * @param {Object} params
 * @returns {Promise<Object>}
 */
export const loginWithGoogle = async ({
  googleCredential,

  // Device information.
  deviceId = null,
  deviceType = null,
  deviceManufacturer = null,
  deviceModel = null,

  // Operating system.
  osName = null,
  osVersion = null,

  // Browser.
  browserName = null,
  browserVersion = null,

  // Screen.
  screenWidth = null,
  screenHeight = null,
  pixelRatio = null,

  // Network.
  userAgent = null,
  ipAddress = null,
  forwardedFor = null,

  // Location.
  latitude = null,
  longitude = null,
  locationAccuracy = null,
}) => {
  /**
   * Collect metadata once so the same information can be used
   * for successful and rejected authentication events.
   */
  const requestMetadata = {
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
  };

  /**
   * ----------------------------------------------------------
   * STEP 1: Validate Google credential
   * ----------------------------------------------------------
   */
  if (
    typeof googleCredential !== "string" ||
    !googleCredential.trim()
  ) {
    await recordGoogleAudit({
      action: "LOGIN_FAILED",
      status: "FAILED",
      attemptedIdentity: null,
      failureReason: "GOOGLE_CREDENTIAL_REQUIRED",
      metadata: {
        provider: "GOOGLE",
      },
      ...requestMetadata,
    });

    return {
      success: false,
      reason: "GOOGLE_CREDENTIAL_REQUIRED",
    };
  }

  /**
   * ----------------------------------------------------------
   * STEP 2: Verify Google identity
   * ----------------------------------------------------------
   *
   * Google token verification errors are handled by the
   * controller's error handler.
   *
   * The raw credential is never written to the audit log.
   */
  const googleIdentity = await verifyGoogleIdentity(
    googleCredential,
  );

  /**
   * ----------------------------------------------------------
   * STEP 3: Require verified Google email
   * ----------------------------------------------------------
   */
  if (!googleIdentity.emailVerified) {
    await recordGoogleAudit({
      action: "LOGIN_FAILED",
      status: "DENIED",

      attemptedIdentity: googleIdentity.providerEmail,

      failureReason: "GOOGLE_EMAIL_NOT_VERIFIED",

      metadata: {
        provider: "GOOGLE",
      },

      ...requestMetadata,
    });

    return {
      success: false,
      reason: "GOOGLE_EMAIL_NOT_VERIFIED",
    };
  }

  /**
   * ----------------------------------------------------------
   * STEP 4: Require Google email
   * ----------------------------------------------------------
   */
  if (!googleIdentity.providerEmail) {
    await recordGoogleAudit({
      action: "LOGIN_FAILED",
      status: "DENIED",

      failureReason: "GOOGLE_EMAIL_NOT_AVAILABLE",

      metadata: {
        provider: "GOOGLE",
      },

      ...requestMetadata,
    });

    return {
      success: false,
      reason: "GOOGLE_EMAIL_NOT_AVAILABLE",
    };
  }

  /**
   * ----------------------------------------------------------
   * STEP 5: Find existing Google identity
   * ----------------------------------------------------------
   */
  const existingIdentity = await findUserIdentity({
    provider: "GOOGLE",
    providerUserId: googleIdentity.providerUserId,
  });

  /**
   * ==========================================================
   * CASE A: Existing Google identity
   * ==========================================================
   */
  if (existingIdentity) {
    /**
     * Reject disabled Google identities.
     */
    // --------------------------------------------------------
    // STEP A: Check whether the Google identity is enabled.
    // --------------------------------------------------------

    if (!existingIdentity.is_active) {
      await recordGoogleAudit({
        action: "LOGIN_FAILED",
        status: "DENIED",

        userId: existingIdentity.user_id,

        attemptedIdentity: googleIdentity.providerEmail,

        failureReason: "GOOGLE_IDENTITY_DISABLED",

        metadata: {
          provider: "GOOGLE",
        },

        ...requestMetadata,
      });

      return {
        success: false,
        reason: "GOOGLE_IDENTITY_DISABLED",
      };
    }

    // --------------------------------------------------------
    // STEP B: Retrieve the linked user's current account status.
    // --------------------------------------------------------

    const linkedUser = await findUserForGoogleAuthentication(
      existingIdentity.user_id,
    );

    // --------------------------------------------------------
    // STEP C: Reject missing or deleted accounts.
    // --------------------------------------------------------

    if (!linkedUser) {
      await recordGoogleAudit({
        action: "LOGIN_FAILED",
        status: "DENIED",

        userId: existingIdentity.user_id,

        attemptedIdentity: googleIdentity.providerEmail,

        failureReason: "USER_ACCOUNT_NOT_FOUND",

        metadata: {
          provider: "GOOGLE",
        },

        ...requestMetadata,
      });

      return {
        success: false,
        reason: "USER_ACCOUNT_NOT_FOUND",
      };
    }

    // --------------------------------------------------------
    // STEP D: Reject inactive user accounts.
    // --------------------------------------------------------

    if (!linkedUser.is_active) {
      await recordGoogleAudit({
        action: "LOGIN_FAILED",
        status: "DENIED",

        userId: linkedUser.id,

        attemptedIdentity: googleIdentity.providerEmail,

        failureReason: "USER_ACCOUNT_INACTIVE",

        metadata: {
          provider: "GOOGLE",
        },

        ...requestMetadata,
      });

      return {
        success: false,
        reason: "USER_ACCOUNT_INACTIVE",
      };
    }

    // --------------------------------------------------------
    // STEP E: Reject users whose login has been disabled.
    // --------------------------------------------------------

    if (!linkedUser.is_login_enabled) {
      await recordGoogleAudit({
        action: "LOGIN_FAILED",
        status: "DENIED",

        userId: linkedUser.id,

        attemptedIdentity: googleIdentity.providerEmail,

        failureReason: "USER_LOGIN_DISABLED",

        metadata: {
          provider: "GOOGLE",
        },

        ...requestMetadata,
      });

      return {
        success: false,
        reason: "USER_LOGIN_DISABLED",
      };
    }

    // --------------------------------------------------------
    // STEP F: Reject accounts that are still locked.
    // --------------------------------------------------------

    if (
      linkedUser.locked_until &&
      new Date(linkedUser.locked_until).getTime() > Date.now()
    ) {
      await recordGoogleAudit({
        action: "LOGIN_FAILED",
        status: "BLOCKED",

        userId: linkedUser.id,

        attemptedIdentity: googleIdentity.providerEmail,

        failureReason: "USER_ACCOUNT_LOCKED",

        metadata: {
          provider: "GOOGLE",
          lockedUntil: linkedUser.locked_until,
        },

        ...requestMetadata,
      });

      return {
        success: false,
        reason: "USER_ACCOUNT_LOCKED",
      };
    }

    /**
     * Generate session data for the existing user.
     */
    const sessionData = generateGoogleSessionData({
      userId: existingIdentity.user_id,
      ...requestMetadata,
    });

    /**
     * Create the session in the core database transaction.
     *
     * User and Google identity are not recreated.
     */
    const transactionResult = await executeTransaction(
      async (connection) => {
        const session = await persistGoogleSession(
          connection,
          sessionData,
          existingIdentity.user_id,
        );

        return {
          session,
        };
      },
    );

    /**
     * Record successful Google login.
     *
     * This audit write occurs after the core transaction
     * has committed.
     */
    await recordGoogleAudit({
      action: "LOGIN",
      status: "SUCCESS",

      userId: existingIdentity.user_id,

      sessionId: sessionData.sessionId,

      attemptedIdentity: googleIdentity.providerEmail,

      entity: "auth_session",
      entityId: sessionData.id,

      metadata: {
        provider: "GOOGLE",
        authenticationType: "EXISTING_IDENTITY",
      },

      ...requestMetadata,
    });

    return {
      success: true,

      status: "EXISTING_IDENTITY",

      userId: existingIdentity.user_id,

      identity: {
        provider: "GOOGLE",

        providerUserId: googleIdentity.providerUserId,

        providerEmail: googleIdentity.providerEmail,

        emailVerified: googleIdentity.emailVerified,
      },

      session: {
        sessionId: transactionResult.session.sessionId,
        expiresAt: sessionData.expiresAt,
      },

      accessToken: sessionData.accessToken,

      refreshToken: sessionData.refreshToken,
    };
  }

  /**
   * ==========================================================
   * CASE B: Google identity does not exist
   * ==========================================================
   *
   * Check whether an active local account already uses
   * this email address.
   */
  const existingUser = await findActiveUserByEmail(
    googleIdentity.providerEmail,
  );

  /**
   * ==========================================================
   * CASE B1: Existing local account
   * ==========================================================
   *
   * Do not automatically link the Google identity.
   * Explicit account linking must be implemented separately.
   */
  if (existingUser) {
    await recordGoogleAudit({
      action: "ACCOUNT_LINKING_REQUIRED",
      status: "DENIED",

      userId: existingUser.id,

      attemptedIdentity: googleIdentity.providerEmail,

      entity: "master_user",
      entityId: existingUser.id,

      failureReason: "ACCOUNT_LINKING_REQUIRED",

      metadata: {
        provider: "GOOGLE",
        emailVerified: googleIdentity.emailVerified,
      },

      ...requestMetadata,
    });

    return {
      success: false,

      reason: "ACCOUNT_LINKING_REQUIRED",

      userId: existingUser.id,

      identity: {
        provider: "GOOGLE",

        providerUserId: googleIdentity.providerUserId,

        providerEmail: googleIdentity.providerEmail,

        emailVerified: googleIdentity.emailVerified,
      },
    };
  }

  /**
   * ==========================================================
   * CASE C: Completely new Google user
   * ==========================================================
   *
   * All core database operations execute in one transaction:
   *
   * 1. Create customer.
   * 2. Create Google identity.
   * 3. Generate session data.
   * 4. Create authentication session.
   *
   * The transaction commits only when all operations succeed.
   */
  const transactionResult = await executeTransaction(
    async (connection) => {
      /**
       * STEP C1: Create local customer.
       */
      const customer = await createCustomerUser(
        connection,
        {
          email: googleIdentity.providerEmail,

          firstName: googleIdentity.firstName,

          lastName: googleIdentity.lastName,
        },
      );

      /**
       * STEP C2: Create Google identity.
       */
      const identity = await createGoogleUserIdentity(
        connection,
        {
          userId: customer.id,

          providerUserId: googleIdentity.providerUserId,

          providerEmail: googleIdentity.providerEmail,
        },
      );

      /**
       * STEP C3: Generate authentication session data.
       */
      const sessionData = generateGoogleSessionData({
        userId: customer.id,
        ...requestMetadata,
      });

      /**
       * STEP C4: Create authentication session.
       */
      const session = await persistGoogleSession(
        connection,
        sessionData,
        customer.id,
      );

      /**
       * Return transaction results.
       */
      return {
        customer,
        identity,
        session,
        sessionData,
      };
    },
  );

  /**
   * ----------------------------------------------------------
   * STEP C5: Record successful registration
   * ----------------------------------------------------------
   *
   * This event is written only after the core transaction
   * completes successfully.
   *
   * Never include the Google credential or authentication
   * tokens in the audit payload.
   */
  await recordGoogleAudit({
    action: "REGISTER",
    status: "SUCCESS",

    userId: transactionResult.customer.id,

    sessionId: transactionResult.sessionData.sessionId,

    attemptedIdentity: googleIdentity.providerEmail,

    entity: "master_user",
    entityId: transactionResult.customer.id,

    metadata: {
      provider: "GOOGLE",
      registrationType: "NEW_USER",
      emailVerified: googleIdentity.emailVerified,
    },

    ...requestMetadata,
  });

  /**
   * ----------------------------------------------------------
   * STEP C6: Return registration response
   * ----------------------------------------------------------
   */
  return {
    success: true,

    status: "NEW_GOOGLE_USER",

    user: {
      id: transactionResult.customer.id,

      email: transactionResult.customer.email,

      phone: transactionResult.customer.phone,

      firstName: transactionResult.customer.firstName,

      lastName: transactionResult.customer.lastName,
    },

    identity: {
      provider: "GOOGLE",

      providerUserId:
        transactionResult.identity.providerUserId,

      providerEmail:
        transactionResult.identity.providerEmail,

      emailVerified: googleIdentity.emailVerified,
    },

    session: {
      sessionId:
        transactionResult.session.sessionId,

      expiresAt:
        transactionResult.sessionData.expiresAt,
    },

    accessToken:
      transactionResult.sessionData.accessToken,

    refreshToken:
      transactionResult.sessionData.refreshToken,
  };
};