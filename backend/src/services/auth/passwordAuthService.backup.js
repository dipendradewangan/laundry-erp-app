/**
 * ============================================================
 * Laundry ERP - Password Authentication Service
 * ============================================================
 *
 * File:
 * -----
 * src/services/auth/passwordAuthService.js
 *
 * Purpose:
 * --------
 * Email/phone + password authentication handle karna.
 *
 * Responsibilities:
 * -----------------
 * 1. User identity lookup.
 * 2. Account status validation.
 * 3. Password verification.
 * 4. Failed login attempt tracking.
 * 5. Temporary account locking.
 * 6. Authentication session creation.
 * 7. Centralized audit logging.
 *
 * Security:
 * ---------
 * - Password/password hash audit log mein store nahi hoga.
 * - Access/refresh tokens audit log mein store nahi honge.
 * - Invalid credentials ke liye generic response use hota hai.
 * - Audit logging centralized audit service se hoti hai.
 * ============================================================
 */

import bcrypt from "bcrypt";

import {
  findUserByIdentity,
  incrementFailedLoginAttempts,
  lockUserAccount,
  resetFailedLoginAttempts,
  updateLastLogin,
} from "../../repositories/auth/userRepository.js";

import {
  createLoginAttempt,
} from "../../repositories/auth/loginAttemptRepository.js";

import {
  createAuthSession,
} from "./authSessionService.js";

import {
  recordAuditEvent,
} from "../audit/auditService.js";


/**
 * Maximum consecutive failed login attempts before locking.
 */
const MAX_FAILED_LOGIN_ATTEMPTS = 5;

/**
 * Temporary account lock duration in minutes.
 */
const LOCK_DURATION_MINUTES = 15;


/**
 * ============================================================
 * Record Password Authentication Audit Event
 * ============================================================
 *
 * Common helper to avoid repeating audit payload construction.
 *
 * IMPORTANT:
 * Never pass password, password hash, access token,
 * refresh token, or their hashes into this function.
 *
 * @param {Object} params
 * @returns {Promise<Object>}
 */
const recordPasswordLoginAudit = async ({
  action,
  status,

  userId = null,
  sessionId = null,
  attemptedIdentity = null,

  failureReason = null,

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

  requestId = null,
  correlationId = null,

  metadata = null,
}) => {
  return recordAuditEvent({
    action,
    module: "AUTH",

    entity: "master_user",
    entityId: userId,

    userId,
    sessionId,
    attemptedIdentity,

    operatingSystem: osName,
    operatingSystemVersion: osVersion,

    deviceId,
    deviceType,
    deviceManufacturer,
    deviceModel,

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

    requestId,
    correlationId,

    status,
    failureReason,

    metadata: {
      provider: "PASSWORD",
      ...(metadata || {}),
    },
  });
};


/**
 * ============================================================
 * Record Login Attempt
 * ============================================================
 *
 * Writes the existing authentication-attempt record.
 *
 * The centralized audit event is recorded separately.
 */
const recordPasswordLoginAttempt = async ({
  userId = null,
  attemptedIdentity,
  status,
  failureReason = null,

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

  sessionId = null,
  requestId = null,
  correlationId = null,
}) => {
  return createLoginAttempt({
    userId,
    attemptedIdentity,
    status,
    failureReason,

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

    sessionId,
    requestId,
    correlationId,
  });
};


/**
 * ============================================================
 * Login With Password
 * ============================================================
 *
 * Supported identities:
 * - Email
 * - Phone number
 *
 * Username is not supported.
 */
export const loginWithPassword = async ({
  identity,
  password,

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

  // Request tracing.
  requestId = null,
  correlationId = null,
}) => {
  /**
   * Collect request metadata once.
   *
   * Password and credentials are deliberately excluded.
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

    requestId,
    correlationId,
  };


  /**
   * ----------------------------------------------------------
   * STEP 1: Find user by email or phone.
   * ----------------------------------------------------------
   */
  const user = await findUserByIdentity(identity);


  /**
   * ----------------------------------------------------------
   * STEP 2: User not found.
   * ----------------------------------------------------------
   *
   * Use a generic response to avoid revealing whether
   * an account exists.
   */
  if (!user) {
    await recordPasswordLoginAttempt({
      userId: null,
      attemptedIdentity: identity,
      status: "FAILED",
      failureReason: "INVALID_CREDENTIALS",
      ...requestMetadata,
    });

    await recordPasswordLoginAudit({
      action: "LOGIN_FAILED",
      status: "FAILED",
      attemptedIdentity: identity,
      failureReason: "INVALID_CREDENTIALS",
      ...requestMetadata,
    });

    return {
      success: false,
      reason: "INVALID_CREDENTIALS",
    };
  }


  /**
   * ----------------------------------------------------------
   * STEP 3: Check account status.
   * ----------------------------------------------------------
   */
  if (!user.is_active) {
    await recordPasswordLoginAttempt({
      userId: user.id,
      attemptedIdentity: identity,
      status: "FAILED",
      failureReason: "ACCOUNT_INACTIVE",
      ...requestMetadata,
    });

    await recordPasswordLoginAudit({
      action: "LOGIN_FAILED",
      status: "DENIED",
      userId: user.id,
      attemptedIdentity: identity,
      failureReason: "ACCOUNT_INACTIVE",
      ...requestMetadata,
    });

    return {
      success: false,
      reason: "INVALID_CREDENTIALS",
    };
  }


  /**
   * ----------------------------------------------------------
   * STEP 4: Check whether login is enabled.
   * ----------------------------------------------------------
   */
  if (!user.is_login_enabled) {
    await recordPasswordLoginAttempt({
      userId: user.id,
      attemptedIdentity: identity,
      status: "FAILED",
      failureReason: "LOGIN_DISABLED",
      ...requestMetadata,
    });

    await recordPasswordLoginAudit({
      action: "LOGIN_FAILED",
      status: "DENIED",
      userId: user.id,
      attemptedIdentity: identity,
      failureReason: "LOGIN_DISABLED",
      ...requestMetadata,
    });

    return {
      success: false,
      reason: "INVALID_CREDENTIALS",
    };
  }


  /**
   * ----------------------------------------------------------
   * STEP 5: Check temporary account lock.
   * ----------------------------------------------------------
   */
  if (user.locked_until) {
    const lockedUntil = new Date(user.locked_until);

    if (lockedUntil > new Date()) {
      await recordPasswordLoginAttempt({
        userId: user.id,
        attemptedIdentity: identity,
        status: "FAILED",
        failureReason: "ACCOUNT_LOCKED",
        ...requestMetadata,
      });

      await recordPasswordLoginAudit({
        action: "LOGIN_FAILED",
        status: "BLOCKED",
        userId: user.id,
        attemptedIdentity: identity,
        failureReason: "ACCOUNT_LOCKED",
        metadata: {
          lockedUntil: lockedUntil.toISOString(),
        },
        ...requestMetadata,
      });

      return {
        success: false,
        reason: "ACCOUNT_LOCKED",
        lockedUntil,
      };
    }
  }


  /**
   * ----------------------------------------------------------
   * STEP 6: Check local password availability.
   * ----------------------------------------------------------
   *
   * Social-login-only accounts can have password_hash = NULL.
   */
  if (!user.password_hash) {
    await recordPasswordLoginAttempt({
      userId: user.id,
      attemptedIdentity: identity,
      status: "FAILED",
      failureReason: "PASSWORD_LOGIN_NOT_CONFIGURED",
      ...requestMetadata,
    });

    await recordPasswordLoginAudit({
      action: "LOGIN_FAILED",
      status: "DENIED",
      userId: user.id,
      attemptedIdentity: identity,
      failureReason: "PASSWORD_LOGIN_NOT_CONFIGURED",
      ...requestMetadata,
    });

    return {
      success: false,
      reason: "PASSWORD_LOGIN_NOT_CONFIGURED",
    };
  }


  /**
   * ----------------------------------------------------------
   * STEP 7: Verify password.
   * ----------------------------------------------------------
   */
  const passwordMatches = await bcrypt.compare(
    password,
    user.password_hash,
  );


  /**
   * ----------------------------------------------------------
   * STEP 8: Handle incorrect password.
   * ----------------------------------------------------------
   */
  if (!passwordMatches) {
    await incrementFailedLoginAttempts(user.id);

    const nextFailedAttempts =
      Number(user.failed_login_attempts || 0) + 1;

    /**
     * Lock the account after the configured failure threshold.
     */
    if (nextFailedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      const lockedUntil = new Date(
        Date.now() + LOCK_DURATION_MINUTES * 60 * 1000,
      );

      await lockUserAccount({
        userId: user.id,
        lockedUntil,
      });

      await recordPasswordLoginAttempt({
        userId: user.id,
        attemptedIdentity: identity,
        status: "FAILED",
        failureReason: "ACCOUNT_LOCKED_AFTER_FAILED_ATTEMPTS",
        ...requestMetadata,
      });

      await recordPasswordLoginAudit({
        action: "LOGIN_FAILED",
        status: "BLOCKED",
        userId: user.id,
        attemptedIdentity: identity,
        failureReason: "ACCOUNT_LOCKED_AFTER_FAILED_ATTEMPTS",
        metadata: {
          failedAttempts: nextFailedAttempts,
          lockDurationMinutes: LOCK_DURATION_MINUTES,
          lockedUntil: lockedUntil.toISOString(),
        },
        ...requestMetadata,
      });

      return {
        success: false,
        reason: "ACCOUNT_LOCKED",
        lockedUntil,
      };
    }

    await recordPasswordLoginAttempt({
      userId: user.id,
      attemptedIdentity: identity,
      status: "FAILED",
      failureReason: "INVALID_CREDENTIALS",
      ...requestMetadata,
    });

    await recordPasswordLoginAudit({
      action: "LOGIN_FAILED",
      status: "FAILED",
      userId: user.id,
      attemptedIdentity: identity,
      failureReason: "INVALID_CREDENTIALS",
      metadata: {
        failedAttempts: nextFailedAttempts,
      },
      ...requestMetadata,
    });

    return {
      success: false,
      reason: "INVALID_CREDENTIALS",
    };
  }


  /**
   * ----------------------------------------------------------
   * STEP 9: Successful password verification.
   * ----------------------------------------------------------
   */

  // Reset failed attempts and remove any expired lock.
  await resetFailedLoginAttempts(user.id);

  // Update the successful login timestamp.
  await updateLastLogin(user.id);


  /**
   * ----------------------------------------------------------
   * STEP 10: Create authenticated session.
   * ----------------------------------------------------------
   */
  const session = await createAuthSession({
    userId: user.id,

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
  });


  /**
   * ----------------------------------------------------------
   * STEP 11: Record successful login attempt.
   * ----------------------------------------------------------
   */
  await recordPasswordLoginAttempt({
    userId: user.id,
    attemptedIdentity: identity,
    status: "SUCCESS",
    failureReason: null,

    sessionId: session.sessionId,

    ...requestMetadata,
  });


  /**
   * ----------------------------------------------------------
   * STEP 12: Record centralized successful login audit.
   * ----------------------------------------------------------
   */
  await recordPasswordLoginAudit({
    action: "LOGIN",
    status: "SUCCESS",

    userId: user.id,
    sessionId: session.sessionId,

    attemptedIdentity: identity,

    entity: "auth_session",
    entityId: session.sessionId,

    metadata: {
      authenticationType: "PASSWORD",
    },

    ...requestMetadata,
  });


  /**
   * ----------------------------------------------------------
   * STEP 13: Return authenticated user/session.
   * ----------------------------------------------------------
   */
  return {
    success: true,

    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.first_name,
      middleName: user.middle_name,
      lastName: user.last_name,
    },

    session,
  };
};