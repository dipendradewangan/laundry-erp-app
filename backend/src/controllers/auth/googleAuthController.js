/**
 * ============================================================
 * Laundry ERP - Google Authentication Controller
 * ============================================================
 *
 * File:
 *   backend/src/controllers/auth/googleAuthController.js
 *
 * Responsibilities:
 *   1. Receive Google authentication requests.
 *   2. Pass Google credentials to the authentication service.
 *   3. Return user details, session and authentication tokens.
 *   4. Return appropriate responses for rejected authentication.
 *   5. Forward unexpected errors to the Express error handler.
 *
 * Security:
 *   - Never log Google credentials.
 *   - Never log access or refresh tokens.
 *   - Google identity verification is performed by the service.
 * ============================================================
 */

import { loginWithGoogle } from "../../services/auth/googleAuthService.js";

/**
 * ============================================================
 * Google Authentication Controller
 * ============================================================
 *
 * Route:
 *   POST /api/auth/google
 *
 * Expected request body:
 *   {
 *     "googleCredential": "GOOGLE_ID_TOKEN"
 *   }
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
export const googleLogin = async (req, res, next) => {
  try {
    // --------------------------------------------------------
    // STEP 1: Read Google credential from the request body.
    // --------------------------------------------------------

    const {
      googleCredential,

      // Device information.
      deviceId,
      deviceType,
      deviceManufacturer,
      deviceModel,

      // Operating system information.
      osName,
      osVersion,

      // Browser information.
      browserName,
      browserVersion,

      // Screen information.
      screenWidth,
      screenHeight,
      pixelRatio,

      // Network information.
      userAgent,
      ipAddress,
      forwardedFor,

      // Location information.
      latitude,
      longitude,
      locationAccuracy,
    } = req.body ?? {};

    // --------------------------------------------------------
    // STEP 2: Execute Google authentication service.
    // --------------------------------------------------------

    const result = await loginWithGoogle({
      googleCredential,

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

      // Prefer the actual request User-Agent header.
      userAgent: req.get("user-agent") || userAgent || null,

      // Use the direct request IP as the default.
      // Configure Express proxy trust carefully if deployed
      // behind a trusted reverse proxy.
      ipAddress: req.ip || ipAddress || null,

      forwardedFor,

      latitude,
      longitude,
      locationAccuracy,
    });

    // --------------------------------------------------------
    // STEP 3: Handle authentication failures.
    // --------------------------------------------------------

    if (!result.success) {
      const failureStatus = {
        GOOGLE_CREDENTIAL_REQUIRED: 400,
        GOOGLE_EMAIL_NOT_VERIFIED: 401,
        GOOGLE_EMAIL_NOT_AVAILABLE: 401,
        GOOGLE_IDENTITY_DISABLED: 403,
        USER_ACCOUNT_NOT_FOUND: 403,
        USER_ACCOUNT_INACTIVE: 403,
        USER_LOGIN_DISABLED: 403,
        USER_ACCOUNT_LOCKED: 403,
        ACCOUNT_LINKING_REQUIRED: 409,
      };

      return res.status(
        failureStatus[result.reason] || 401,
      ).json({
        success: false,
        reason: result.reason,

        // Include these only when the service explicitly
        // provides them for account-linking workflows.
        ...(result.reason === "ACCOUNT_LINKING_REQUIRED"
          ? {
              userId: result.userId,
              identity: result.identity,
            }
          : {}),
      });
    }

    // --------------------------------------------------------
    // STEP 4: Validate the successful service response.
    // --------------------------------------------------------

    if (!result.userId) {
      return res.status(500).json({
        success: false,
        reason: "GOOGLE_USER_ID_MISSING",
        message: "Google authentication did not return a user ID.",
      });
    }

    if (!result.accessToken || !result.refreshToken) {
      return res.status(500).json({
        success: false,
        reason: "GOOGLE_SESSION_TOKENS_MISSING",
        message: "Google authentication did not return valid session tokens.",
      });
    }

    // --------------------------------------------------------
    // STEP 5: Build a consistent user response.
    // --------------------------------------------------------
    //
    // NEW_GOOGLE_USER:
    //   The service returns the newly created user.
    //
    // EXISTING_IDENTITY:
    //   The service must return the linked user's details.
    //
    // Do not silently treat a missing user object as a
    // successful complete authentication response.
    // --------------------------------------------------------

    const user = result.user ?? null;

    if (!user) {
      return res.status(500).json({
        success: false,
        reason: "GOOGLE_USER_DETAILS_MISSING",
        message: "Google authentication succeeded, but user details were not returned.",
        userId: result.userId,
      });
    }

    // --------------------------------------------------------
    // STEP 6: Return successful authentication response.
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,

      status: result.status,

      user: {
        id: user.id ?? result.userId,
        email: user.email ?? null,
        phone: user.phone ?? null,
        firstName: user.firstName ?? user.first_name ?? null,
        middleName: user.middleName ?? user.middle_name ?? null,
        lastName: user.lastName ?? user.last_name ?? null,
      },

      userId: result.userId,

      identity: result.identity,

      session: result.session,

      accessToken: result.accessToken,

      refreshToken: result.refreshToken,
    });
  } catch (error) {
    // --------------------------------------------------------
    // STEP 7: Forward errors to centralized error handling.
    // --------------------------------------------------------
    //
    // Do not log credentials or authentication tokens.
    // --------------------------------------------------------

    return next(error);
  }
};