import crypto from "crypto";
import jwt from "jsonwebtoken";

import { createSession } from "../../repositories/auth/sessionRepository.js";

/**
 * Authentication session configuration.
 *
 * IMPORTANT:
 * These values should eventually move to environment/config
 * management so that production policies can be changed
 * without modifying application code.
 */
const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN_DAYS = 30;

/**
 * Generate a cryptographically secure random refresh token.
 *
 * We do NOT use Math.random() for authentication tokens.
 *
 * crypto.randomBytes() provides cryptographically secure
 * random data.
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex");
};

/**
 * Generate a SHA-256 hash of the refresh token.
 *
 * The actual refresh token will be returned to the client,
 * but only its hash will be stored in the database.
 */
const hashRefreshToken = (refreshToken) => {
  return crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
};

/**
 * Create an authentication session after successful login.
 *
 * This function is common for:
 *
 * - Username/password login
 * - Google login
 * - Facebook login
 *
 * All authentication methods eventually use the same
 * session mechanism.
 */
export const createAuthSession = async ({
  userId,

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
}) => {

  // ----------------------------------------------------------
  // 1. Generate unique identifiers
  // ----------------------------------------------------------

  const id = crypto.randomUUID();

  const sessionId = crypto.randomUUID();

  // ----------------------------------------------------------
  // 2. Generate refresh token
  // ----------------------------------------------------------

  const refreshToken = generateRefreshToken();

  // ----------------------------------------------------------
  // 3. Hash refresh token before storing it.
  //
  // IMPORTANT:
  // Plain refresh token is NEVER stored in MySQL.
  // ----------------------------------------------------------

  const refreshTokenHash = hashRefreshToken(refreshToken);

  // ----------------------------------------------------------
  // 4. Calculate refresh-token/session expiry.
  // ----------------------------------------------------------

  const expiresAt = new Date();

  expiresAt.setDate(
    expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS
  );

  // ----------------------------------------------------------
  // 5. Save session in database.
  // ----------------------------------------------------------

  await createSession({
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
  });

  // ----------------------------------------------------------
  // 6. Generate short-lived access token.
  //
  // Access token should contain only the information required
  // by the API for authentication/authorization.
  // ----------------------------------------------------------

  const accessToken = jwt.sign(
    {
      sub: userId,
      sid: sessionId,
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      issuer: "laundry-erp",
      audience: "laundry-erp-api",
    }
  );

  // ----------------------------------------------------------
  // 7. Return authentication credentials.
  // ----------------------------------------------------------

  return {
    accessToken,
    refreshToken,
    sessionId,
    expiresAt,
  };
};