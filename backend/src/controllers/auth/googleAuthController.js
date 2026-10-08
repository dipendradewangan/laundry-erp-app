/**
 * ============================================================
 * FILE: googleAuthController.js
 *
 * PURPOSE:
 *   Handles HTTP requests for Google authentication.
 *
 * RESPONSIBILITY:
 *   - Read request data
 *   - Pass data to Google authentication service
 *   - Return HTTP response
 *
 * BUSINESS LOGIC MUST NOT BE WRITTEN HERE.
 * ============================================================
 */

import { loginWithGoogle } from "../../services/auth/googleAuthService.js";


/**
 * ============================================================
 * POST /api/auth/google
 * ============================================================
 *
 * Expected request body:
 *
 * {
 *   "googleCredential": "GOOGLE_ID_TOKEN"
 * }
 *
 * Optional device/network information can also be supplied.
 */
export const googleLogin = async (req, res) => {

  try {

    // --------------------------------------------------------
    // Read Google credential from request body
    // --------------------------------------------------------

    const {
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

      userAgent,
      ipAddress,
      forwardedFor,

      latitude,
      longitude,
      locationAccuracy,
    } = req.body;


    // --------------------------------------------------------
    // Call Google authentication service
    // --------------------------------------------------------

    const result =
      await loginWithGoogle({

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

        userAgent,
        ipAddress,
        forwardedFor,

        latitude,
        longitude,
        locationAccuracy,
      });


    // --------------------------------------------------------
    // Authentication failed
    // --------------------------------------------------------

    if (!result.success) {

      return res.status(401).json({
        success: false,
        reason: result.reason,
      });
    }


    // --------------------------------------------------------
    // Authentication successful
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,
      status: result.status,

      user: result.user || null,

      userId: result.userId || null,

      identity: result.identity || null,

      session: result.session || null,

      accessToken:
        result.accessToken || null,

      refreshToken:
        result.refreshToken || null,
    });

  } catch (error) {

    // --------------------------------------------------------
    // Unexpected error
    // --------------------------------------------------------

    console.error(
      "Google login error:",
      error
    );

    return res.status(500).json({
      success: false,
      reason: "GOOGLE_LOGIN_FAILED",
      message: "Google authentication failed.",
    });
  }
};