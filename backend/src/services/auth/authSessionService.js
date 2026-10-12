import crypto from "crypto";
import jwt from "jsonwebtoken";

import {
  createSession,
  rotateRefreshTokenByHash,
} from "../../repositories/auth/sessionRepository.js";

/**
 * Authentication session configuration.
 */
const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN_DAYS = 30;

/**
 * Generate a cryptographically secure refresh token.
 *
 * The raw token is returned to the client.
 * Only its SHA-256 hash is stored in MySQL.
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex");
};

/**
 * Generate a SHA-256 hash of a refresh token.
 */
const hashRefreshToken = (refreshToken) => {
  return crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
};

/**
 * Generate a short-lived access token.
 *
 * The JWT identifies the user and their session.
 */
const generateAccessToken = ({ userId, sessionId }) => {
  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET is not configured.");
  }

  return jwt.sign(
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
};

/**
 * Calculate the refresh-token/session expiry.
 */
const calculateRefreshTokenExpiry = () => {
  const expiresAt = new Date();

  expiresAt.setDate(
    expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS
  );

  return expiresAt;
};

/**
 * Create an authentication session after successful login.
 *
 * Used by supported authentication methods such as:
 * - Email/password login
 * - Google login
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

  screenWidth = null,
  screenHeight = null,
  devicePixelRatio = null,

  userAgent = null,

  ipAddress = null,
  forwardedFor = null,

  latitude = null,
  longitude = null,
  locationAccuracy = null,
}) => {
  // 1. Generate unique session identifiers.
  const id = crypto.randomUUID();
  const sessionId = crypto.randomUUID();

  // 2. Generate a refresh token.
  const refreshToken = generateRefreshToken();

  // 3. Hash the token before storing it.
  const refreshTokenHash = hashRefreshToken(refreshToken);

  // 4. Calculate session expiry.
  const expiresAt = calculateRefreshTokenExpiry();

  // 5. Save the authentication session.
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

    screenWidth,
    screenHeight,
    devicePixelRatio,

    userAgent,

    ipAddress,
    forwardedFor,

    latitude,
    longitude,
    locationAccuracy,

    expiresAt,
  });

  // 6. Generate the access token.
  const accessToken = generateAccessToken({
    userId,
    sessionId,
  });

  // 7. Return credentials to the authentication controller.
  return {
    accessToken,
    refreshToken,
    sessionId,
    expiresAt,
  };
};

/**
 * Refresh an authentication session.
 *
 * Flow:
 * 1. Validate the supplied refresh token.
 * 2. Hash the token.
 * 3. Generate a replacement refresh token.
 * 4. Atomically rotate the token hash in the database.
 * 5. Generate a new access token.
 *
 * The database repository rejects expired, revoked,
 * or already-rotated tokens.
 */
export const refreshAuthSession = async ({ refreshToken }) => {
  // 1. Validate the refresh-token format.
  if (
    typeof refreshToken !== "string" ||
    !/^[a-f0-9]{128}$/i.test(refreshToken)
  ) {
    return {
      success: false,
      code: "INVALID_REFRESH_TOKEN",
      message: "Refresh token is invalid or expired.",
    };
  }

  // 2. Hash the token received from the client.
  const currentRefreshTokenHash = hashRefreshToken(refreshToken);

  // 3. Generate a replacement token.
  const newRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

  // 4. Atomically replace the current token hash.
  const rotationResult = await rotateRefreshTokenByHash({
    currentRefreshTokenHash,
    newRefreshTokenHash,
  });

  // 5. Reject invalid or expired sessions.
  if (!rotationResult.success || !rotationResult.rotated) {
    return {
      success: false,
      code: "INVALID_REFRESH_TOKEN",
      message: "Refresh token is invalid or expired.",
    };
  }

  // 6. Generate the new access token.
  const accessToken = generateAccessToken({
    userId: rotationResult.session.userId,
    sessionId: rotationResult.session.sessionId,
  });

  // 7. Return the new credentials.
  return {
    success: true,
    accessToken,
    refreshToken: newRefreshToken,
    sessionId: rotationResult.session.sessionId,
    expiresAt: rotationResult.session.expiresAt,
  };
};