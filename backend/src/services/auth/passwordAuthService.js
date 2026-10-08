import bcrypt from "bcrypt";

import {
  findUserByIdentity,
  incrementFailedLoginAttempts,
  lockUserAccount,
  resetFailedLoginAttempts,
  updateLastLogin,
} from "../../repositories/auth/userRepository.js";

import { createLoginAttempt } from "../../repositories/auth/loginAttemptRepository.js";

import { createAuthSession } from "./authSessionService.js";

/**
 * Maximum consecutive failed login attempts
 * before the account is temporarily locked.
 */
const MAX_FAILED_LOGIN_ATTEMPTS = 5;

/**
 * Account lock duration in minutes.
 */
const LOCK_DURATION_MINUTES = 15;

/**
 * Password based login service.
 *
 * Supported login identities:
 *   - Email
 *   - Mobile number
 *
 * Username is no longer supported.
 */
export const loginWithPassword = async ({
  identity,
  password,

  // Device information
  deviceId = null,
  deviceType = null,
  deviceManufacturer = null,
  deviceModel = null,

  // Operating system information
  osName = null,
  osVersion = null,

  // Browser information
  browserName = null,
  browserVersion = null,

  // Screen information
  screenWidth = null,
  screenHeight = null,
  pixelRatio = null,

  // Network information
  userAgent = null,
  ipAddress = null,
  forwardedFor = null,

  // Location information
  latitude = null,
  longitude = null,
  locationAccuracy = null,

  // Request/session tracking
  requestId = null,
  correlationId = null,
}) => {
  /**
   * ----------------------------------------------------------
   * 1. Find user using email OR phone
   * ----------------------------------------------------------
   */
  const user = await findUserByIdentity(identity);

  /**
   * Security:
   *
   * Do not reveal whether the email/phone exists.
   *
   * Always return a generic invalid-credentials response.
   */
  if (!user) {
    await createLoginAttempt({
      userId: null,
      attemptedIdentity: identity,
      status: "FAILED",
      failureReason: "INVALID_CREDENTIALS",

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

      sessionId: null,
      requestId,
      correlationId,
    });

    return {
      success: false,
      reason: "INVALID_CREDENTIALS",
    };
  }

  /**
   * ----------------------------------------------------------
   * 2. Check whether account is active
   * ----------------------------------------------------------
   */
  if (!user.is_active) {
    await createLoginAttempt({
      userId: user.id,
      attemptedIdentity: identity,
      status: "FAILED",
      failureReason: "ACCOUNT_INACTIVE",

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

      sessionId: null,
      requestId,
      correlationId,
    });

    return {
      success: false,
      reason: "INVALID_CREDENTIALS",
    };
  }

  /**
   * ----------------------------------------------------------
   * 3. Check whether login is enabled
   * ----------------------------------------------------------
   */
  if (!user.is_login_enabled) {
    await createLoginAttempt({
      userId: user.id,
      attemptedIdentity: identity,
      status: "FAILED",
      failureReason: "LOGIN_DISABLED",

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

      sessionId: null,
      requestId,
      correlationId,
    });

    return {
      success: false,
      reason: "LOGIN_DISABLED",
    };
  }

  /**
   * ----------------------------------------------------------
   * 4. Check temporary account lock
   * ----------------------------------------------------------
   */
  if (user.locked_until) {
    const now = new Date();
    const lockedUntil = new Date(user.locked_until);

    if (lockedUntil > now) {
      await createLoginAttempt({
        userId: user.id,
        attemptedIdentity: identity,
        status: "FAILED",
        failureReason: "ACCOUNT_LOCKED",

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

        sessionId: null,
        requestId,
        correlationId,
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
   * 5. Check local password availability
   * ----------------------------------------------------------
   *
   * Social-login-only users can have:
   *
   *     password_hash = NULL
   *
   * Such users cannot authenticate using password login.
   */
  if (!user.password_hash) {
    await createLoginAttempt({
      userId: user.id,
      attemptedIdentity: identity,
      status: "FAILED",
      failureReason: "PASSWORD_LOGIN_NOT_CONFIGURED",

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

      sessionId: null,
      requestId,
      correlationId,
    });

    return {
      success: false,
      reason: "PASSWORD_LOGIN_NOT_CONFIGURED",
    };
  }

  /**
   * ----------------------------------------------------------
   * 6. Verify password
   * ----------------------------------------------------------
   */
  const passwordMatches = await bcrypt.compare(
    password,
    user.password_hash
  );

  /**
   * ----------------------------------------------------------
   * 7. Wrong password
   * ----------------------------------------------------------
   */
  if (!passwordMatches) {
    await incrementFailedLoginAttempts(user.id);

    const nextFailedAttempts =
      Number(user.failed_login_attempts || 0) + 1;

    /**
     * Lock account after maximum failed attempts.
     */
    if (nextFailedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      const lockedUntil = new Date(
        Date.now() + LOCK_DURATION_MINUTES * 60 * 1000
      );

      await lockUserAccount({
        userId: user.id,
        lockedUntil,
      });

      await createLoginAttempt({
        userId: user.id,
        attemptedIdentity: identity,
        status: "FAILED",
        failureReason: "ACCOUNT_LOCKED_AFTER_FAILED_ATTEMPTS",

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

        sessionId: null,
        requestId,
        correlationId,
      });

      return {
        success: false,
        reason: "ACCOUNT_LOCKED",
        lockedUntil,
      };
    }

    await createLoginAttempt({
      userId: user.id,
      attemptedIdentity: identity,
      status: "FAILED",
      failureReason: "INVALID_CREDENTIALS",

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

      sessionId: null,
      requestId,
      correlationId,
    });

    return {
      success: false,
      reason: "INVALID_CREDENTIALS",
    };
  }

  /**
   * ----------------------------------------------------------
   * 8. Successful password authentication
   * ----------------------------------------------------------
   */

  // Reset previous failed attempts and remove any expired lock.
  await resetFailedLoginAttempts(user.id);

  // Update successful login timestamp.
  await updateLastLogin(user.id);

  /**
   * ----------------------------------------------------------
   * 9. Create authenticated session
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
   * 10. Record successful login attempt
   * ----------------------------------------------------------
   */
  await createLoginAttempt({
    userId: user.id,
    attemptedIdentity: identity,
    status: "SUCCESS",
    failureReason: null,

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

    sessionId: session.sessionId,
    requestId,
    correlationId,
  });

  /**
   * ----------------------------------------------------------
   * 11. Return authenticated user/session
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