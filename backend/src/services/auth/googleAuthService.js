/**
 * ============================================================
 * Laundry ERP - Google Authentication Service
 * ============================================================
 *
 * File:
 *   backend/src/services/auth/googleAuthService.js
 *
 * Responsibilities:
 *   1. Verify Google ID tokens.
 *   2. Authenticate existing Google users.
 *   3. Register new Google users.
 *   4. Create authentication sessions.
 *   5. Prevent automatic account linking.
 *   6. Record Google authentication audit events.
 *
 * Databases:
 *   Core  : laundry_core
 *   Audit : laundry_audit
 *
 * Security:
 *   - Verify Google credentials on the backend.
 *   - Never trust identity details supplied by the frontend.
 *   - Never automatically link existing local accounts.
 *   - Store only refresh-token hashes in the database.
 *   - Never write credentials or authentication tokens to audit.
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
 */
export const verifyGoogleIdentity = async (googleIdToken) => {
  if (
    typeof googleIdToken !== "string" ||
    !googleIdToken.trim()
  ) {
    throw new Error("Google ID token is required.");
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured.");
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
 * 2. Generate Google Authentication Session Data
 * ============================================================
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

  // Internal auth_session primary key.
  const id = crypto.randomUUID();

  // Public session ID used in the access JWT.
  const sessionId = crypto.randomUUID();

  // Generate a secure refresh token.
  const refreshToken = crypto.randomBytes(64).toString("hex");

  // Store only the SHA-256 hash in the database.
  const refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  // Fixed refresh-token lifetime: 30 days.
  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  );

  // Generate a short-lived access JWT.
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
 * 3. Persist Authentication Session
 * ============================================================
 *
 * The caller supplies the active core DB transaction.
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
 * 4. Google Authentication Audit Helper
 * ============================================================
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
 */
export const loginWithGoogle = async ({
  googleCredential,

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
  // Collect request metadata once for audit events.
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


  // ----------------------------------------------------------
  // STEP 1: Validate the Google credential.
  // ----------------------------------------------------------

  if (
    typeof googleCredential !== "string" ||
    !googleCredential.trim()
  ) {
    await recordGoogleAudit({
      action: "LOGIN_FAILED",
      status: "FAILED",
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


  // ----------------------------------------------------------
  // STEP 2: Verify the Google ID token.
  // ----------------------------------------------------------

  const googleIdentity = await verifyGoogleIdentity(
    googleCredential,
  );


  // ----------------------------------------------------------
  // STEP 3: Require a verified Google email.
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // STEP 4: Require an available Google email.
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // STEP 5: Find an existing Google identity.
  // ----------------------------------------------------------

  const existingIdentity = await findUserIdentity({
    provider: "GOOGLE",
    providerUserId: googleIdentity.providerUserId,
  });


  // ==========================================================
  // CASE A: Existing Google identity.
  // ==========================================================

  if (existingIdentity) {
    // STEP A1: Reject a disabled Google identity.

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


    // STEP A2: Load the linked user.

    const linkedUser = await findUserForGoogleAuthentication(
      existingIdentity.user_id,
    );


    // STEP A3: Reject a missing or deleted user.

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


    // STEP A4: Reject an inactive account.

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


    // STEP A5: Reject accounts where login is disabled.

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


    // STEP A6: Reject an account that is still locked.

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


    // STEP A7: Generate session data for the linked user.

    const sessionData = generateGoogleSessionData({
      userId: linkedUser.id,
      ...requestMetadata,
    });


    // STEP A8: Persist the session in the core database.

    const transactionResult = await executeTransaction(
      async (connection) => {
        const session = await persistGoogleSession(
          connection,
          sessionData,
          linkedUser.id,
        );

        return {
          session,
        };
      },
    );


    // STEP A9: Record the successful login.

    await recordGoogleAudit({
      action: "LOGIN",
      status: "SUCCESS",

      userId: linkedUser.id,
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


    // STEP A10: Return the linked user's details and tokens.

    return {
      success: true,
      status: "EXISTING_IDENTITY",

      userId: linkedUser.id,

      user: {
        id: linkedUser.id,
        email: linkedUser.email ?? null,
        phone: linkedUser.phone ?? null,

        firstName:
          linkedUser.first_name ??
          linkedUser.firstName ??
          null,

        middleName:
          linkedUser.middle_name ??
          linkedUser.middleName ??
          null,

        lastName:
          linkedUser.last_name ??
          linkedUser.lastName ??
          null,
      },

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


  // ==========================================================
  // CASE B: No Google identity exists.
  // ==========================================================

  // Check whether a local account already uses this email.

  const existingUser = await findActiveUserByEmail(
    googleIdentity.providerEmail,
  );


  // ----------------------------------------------------------
  // CASE B1: Existing local account.
  // ----------------------------------------------------------
  //
  // Never automatically link a Google identity to a local
  // account. Explicit account linking must be implemented
  // as a separate authenticated workflow.
  // ----------------------------------------------------------

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


  // ==========================================================
  // CASE C: Completely new Google user.
  // ==========================================================
  //
  // All core database operations are executed in one
  // transaction:
  //
  // 1. Create the user.
  // 2. Create the Google identity.
  // 3. Generate authentication session data.
  // 4. Create the authentication session.
  //
  // If any operation fails, the transaction should roll back.
  // ==========================================================

  const transactionResult = await executeTransaction(
    async (connection) => {
      // STEP C1: Create the local user.

      const customer = await createCustomerUser(
        connection,
        {
          email: googleIdentity.providerEmail,
          firstName: googleIdentity.firstName,
          lastName: googleIdentity.lastName,
        },
      );


      // STEP C2: Create the Google identity.

      const identity = await createGoogleUserIdentity(
        connection,
        {
          userId: customer.id,
          providerUserId: googleIdentity.providerUserId,
          providerEmail: googleIdentity.providerEmail,
        },
      );


      // STEP C3: Generate authentication session data.

      const sessionData = generateGoogleSessionData({
        userId: customer.id,
        ...requestMetadata,
      });


      // STEP C4: Persist the session.

      const session = await persistGoogleSession(
        connection,
        sessionData,
        customer.id,
      );


      // Return all required transaction results.

      return {
        customer,
        identity,
        session,
        sessionData,
      };
    },
  );


  // ----------------------------------------------------------
  // STEP C5: Record successful registration.
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // STEP C6: Return the newly registered user.
  // ----------------------------------------------------------

  return {
    success: true,
    status: "NEW_GOOGLE_USER",

    userId: transactionResult.customer.id,

    user: {
      id: transactionResult.customer.id,
      email: transactionResult.customer.email ?? null,
      phone: transactionResult.customer.phone ?? null,

      firstName:
        transactionResult.customer.firstName ??
        transactionResult.customer.first_name ??
        null,

      lastName:
        transactionResult.customer.lastName ??
        transactionResult.customer.last_name ??
        null,
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
      sessionId: transactionResult.session.sessionId,
      expiresAt: transactionResult.sessionData.expiresAt,
    },

    accessToken: transactionResult.sessionData.accessToken,
    refreshToken: transactionResult.sessionData.refreshToken,
  };
};