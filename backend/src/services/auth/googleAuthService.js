import { googleOAuthClient } from "../../config/googleAuth.js";

import {
  findUserIdentity,
} from "../../repositories/auth/userIdentityRepository.js";

import {
  findActiveUserByEmail,
} from "../../repositories/auth/userRepository.js";

import { executeTransaction } from "../../config/databaseTransaction.js";

import {
  createCustomerUser,
  createGoogleUserIdentity,
  createGoogleAuthSession,
} from "../../repositories/auth/googleProvisioningRepository.js";

import crypto from "node:crypto";

import jwt from "jsonwebtoken";


/**
 * ============================================================
 * FILE: googleAuthService.js
 *
 * PURPOSE:
 *   Handles Google-based authentication.
 *
 * GOOGLE LOGIN FLOW:
 *
 *   Google ID Token
 *        ↓
 *   Verify Google Identity
 *        ↓
 *   Check Google Identity
 *        │
 *        ├── Existing Google Identity
 *        │       ↓
 *        │    Existing User
 *        │       ↓
 *        │    Create Session
 *        │       ↓
 *        │    Login Success
 *        │
 *        └── New Google Identity
 *                 ↓
 *            Check Email
 *                 │
 *          ┌──────┴──────┐
 *          ↓             ↓
 *     Existing        No Account
 *       User               ↓
 *          ↓          Create Customer
 *   Linking Required       ↓
 *                    Create Identity
 *                         ↓
 *                    Create Session
 *                         ↓
 *                       COMMIT
 *
 * IMPORTANT:
 *   Google identity information is never trusted directly
 *   from the frontend.
 *
 *   The backend verifies the Google ID token first.
 * ============================================================
 */


/**
 * ============================================================
 * Verify Google ID Token
 * ============================================================
 *
 * Verifies:
 *
 *   - Google token signature
 *   - Token audience
 *   - Token validity
 *
 * After successful verification, only trusted Google
 * identity information is returned.
 */
export const verifyGoogleIdentity = async (googleIdToken) => {

  // ----------------------------------------------------------
  // 1. Validate Google ID token
  // ----------------------------------------------------------

  if (!googleIdToken) {
    throw new Error("Google ID token is required.");
  }


  // ----------------------------------------------------------
  // 2. Verify token with Google
  // ----------------------------------------------------------

  const ticket = await googleOAuthClient.verifyIdToken({
    idToken: googleIdToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });


  // ----------------------------------------------------------
  // 3. Get verified Google payload
  // ----------------------------------------------------------

  const payload = ticket.getPayload();


  if (!payload) {
    throw new Error("Invalid Google identity.");
  }


  // ----------------------------------------------------------
  // 4. Return only required Google information
  // ----------------------------------------------------------

  return {
    providerUserId: payload.sub,

    providerEmail:
      payload.email || null,

    emailVerified:
      payload.email_verified === true,

    firstName:
      payload.given_name || null,

    lastName:
      payload.family_name || null,

    picture:
      payload.picture || null,
  };
};


/**
 * ============================================================
 * Generate Google Authentication Session
 * ============================================================
 *
 * Creates:
 *
 *   - Session ID
 *   - Refresh token
 *   - Refresh token hash
 *   - Access token
 *
 * The refresh token itself is returned to the client.
 *
 * Only its SHA-256 hash is stored in the database.
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

  // ----------------------------------------------------------
  // Database session primary key
  // ----------------------------------------------------------

  const id = crypto.randomUUID();


  // ----------------------------------------------------------
  // Public/session identifier
  // ----------------------------------------------------------

  const sessionId = crypto.randomUUID();


  // ----------------------------------------------------------
  // Generate secure refresh token
  // ----------------------------------------------------------

  const refreshToken =
    crypto.randomBytes(64).toString("hex");


  // ----------------------------------------------------------
  // Store only SHA-256 hash in database
  // ----------------------------------------------------------

  const refreshTokenHash =
    crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");


  // ----------------------------------------------------------
  // Refresh session expiry
  //
  // Current policy:
  // 30 days
  // ----------------------------------------------------------

  const expiresAt =
    new Date(
      Date.now() +
      30 * 24 * 60 * 60 * 1000
    );


  // ----------------------------------------------------------
  // Generate short-lived access token
  // ----------------------------------------------------------

  const accessToken =
    jwt.sign(
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
      }
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
 * Login With Google
 * ============================================================
 */
export const loginWithGoogle = async ({
  googleCredential,

  // Device information
  deviceId = null,
  deviceType = null,
  deviceManufacturer = null,
  deviceModel = null,

  // Operating system
  osName = null,
  osVersion = null,

  // Browser
  browserName = null,
  browserVersion = null,

  // Screen
  screenWidth = null,
  screenHeight = null,
  pixelRatio = null,

  // Network
  userAgent = null,
  ipAddress = null,
  forwardedFor = null,

  // Location
  latitude = null,
  longitude = null,
  locationAccuracy = null,
}) => {

  // ----------------------------------------------------------
  // 1. Validate Google credential
  // ----------------------------------------------------------

  if (!googleCredential) {
    return {
      success: false,
      reason: "GOOGLE_CREDENTIAL_REQUIRED",
    };
  }


  // ----------------------------------------------------------
  // 2. Verify Google ID token
  // ----------------------------------------------------------

  const googleIdentity =
    await verifyGoogleIdentity(
      googleCredential
    );


  // ----------------------------------------------------------
  // 3. Require verified Google email
  // ----------------------------------------------------------

  if (!googleIdentity.emailVerified) {
    return {
      success: false,
      reason: "GOOGLE_EMAIL_NOT_VERIFIED",
    };
  }


  // ----------------------------------------------------------
  // 4. Google email must exist
  // ----------------------------------------------------------

  if (!googleIdentity.providerEmail) {
    return {
      success: false,
      reason: "GOOGLE_EMAIL_NOT_AVAILABLE",
    };
  }


  // ----------------------------------------------------------
  // 5. Check existing Google identity
  // ----------------------------------------------------------

  const existingIdentity =
    await findUserIdentity({
      provider: "GOOGLE",

      providerUserId:
        googleIdentity.providerUserId,
    });


  // ==========================================================
  // CASE 1:
  // Existing Google identity
  // ==========================================================

  if (existingIdentity) {

    // --------------------------------------------------------
    // Disabled Google identity
    // --------------------------------------------------------

    if (!existingIdentity.is_active) {
      return {
        success: false,
        reason: "GOOGLE_IDENTITY_DISABLED",
      };
    }


    // --------------------------------------------------------
    // Generate new session
    // --------------------------------------------------------

    const sessionData =
      generateGoogleSessionData({
        userId: existingIdentity.user_id,

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
    // Create session
    //
    // Existing user does not need user/identity creation.
    // Only auth_session is created here.
    // --------------------------------------------------------

    const transactionResult =
      await executeTransaction(
        async (connection) => {

          const session =
            await createGoogleAuthSession(
              connection,
              {
                id:
                  sessionData.id,

                sessionId:
                  sessionData.sessionId,

                userId:
                  existingIdentity.user_id,

                refreshTokenHash:
                  sessionData.refreshTokenHash,

                deviceId:
                  sessionData.deviceId,

                deviceType:
                  sessionData.deviceType,

                deviceManufacturer:
                  sessionData.deviceManufacturer,

                deviceModel:
                  sessionData.deviceModel,

                osName:
                  sessionData.osName,

                osVersion:
                  sessionData.osVersion,

                browserName:
                  sessionData.browserName,

                browserVersion:
                  sessionData.browserVersion,

                screenWidth:
                  sessionData.screenWidth,

                screenHeight:
                  sessionData.screenHeight,

                pixelRatio:
                  sessionData.pixelRatio,

                userAgent:
                  sessionData.userAgent,

                ipAddress:
                  sessionData.ipAddress,

                forwardedFor:
                  sessionData.forwardedFor,

                latitude:
                  sessionData.latitude,

                longitude:
                  sessionData.longitude,

                locationAccuracy:
                  sessionData.locationAccuracy,

                expiresAt:
                  sessionData.expiresAt,
              }
            );


          return {
            session,
          };
        }
      );


    // --------------------------------------------------------
    // Existing Google user login success
    // --------------------------------------------------------

    return {
      success: true,

      status: "EXISTING_IDENTITY",

      userId:
        existingIdentity.user_id,

      identity: {
        provider: "GOOGLE",

        providerUserId:
          googleIdentity.providerUserId,

        providerEmail:
          googleIdentity.providerEmail,

        emailVerified:
          googleIdentity.emailVerified,
      },

      session: {
        sessionId:
          transactionResult.session.sessionId,

        expiresAt:
          sessionData.expiresAt,
      },

      accessToken:
        sessionData.accessToken,

      refreshToken:
        sessionData.refreshToken,
    };
  }


  // ==========================================================
  // CASE 2:
  // Google identity is not linked
  // ==========================================================

  const existingUser =
    await findActiveUserByEmail(
      googleIdentity.providerEmail
    );


  // ==========================================================
  // CASE 2A:
  // Local account already exists
  // ==========================================================

  if (existingUser) {

    /**
     * SECURITY:
     *
     * We do NOT automatically link Google merely because
     * the email address matches.
     *
     * Explicit account-linking flow will be required.
     */

    return {
      success: false,

      reason:
        "ACCOUNT_LINKING_REQUIRED",

      userId:
        existingUser.id,

      identity: {
        provider: "GOOGLE",

        providerUserId:
          googleIdentity.providerUserId,

        providerEmail:
          googleIdentity.providerEmail,

        emailVerified:
          googleIdentity.emailVerified,
      },
    };
  }


  // ==========================================================
  // CASE 2B:
  // Completely new Google customer
  // ==========================================================

  const transactionResult =
    await executeTransaction(
      async (connection) => {

        // ----------------------------------------------------
        // Create local customer
        // ----------------------------------------------------

        const customer =
          await createCustomerUser(
            connection,
            {
              email:
                googleIdentity.providerEmail,

              firstName:
                googleIdentity.firstName,

              lastName:
                googleIdentity.lastName,
            }
          );


        // ----------------------------------------------------
        // Create Google identity
        // ----------------------------------------------------

        const identity =
          await createGoogleUserIdentity(
            connection,
            {
              userId:
                customer.id,

              providerUserId:
                googleIdentity.providerUserId,

              providerEmail:
                googleIdentity.providerEmail,
            }
          );


        // ----------------------------------------------------
        // Generate session data
        // ----------------------------------------------------

        const sessionData =
          generateGoogleSessionData({
            userId:
              customer.id,

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


        // ----------------------------------------------------
        // Create authentication session
        // ----------------------------------------------------

        const session =
          await createGoogleAuthSession(
            connection,
            {
              id:
                sessionData.id,

              sessionId:
                sessionData.sessionId,

              userId:
                customer.id,

              refreshTokenHash:
                sessionData.refreshTokenHash,

              deviceId:
                sessionData.deviceId,

              deviceType:
                sessionData.deviceType,

              deviceManufacturer:
                sessionData.deviceManufacturer,

              deviceModel:
                sessionData.deviceModel,

              osName:
                sessionData.osName,

              osVersion:
                sessionData.osVersion,

              browserName:
                sessionData.browserName,

              browserVersion:
                sessionData.browserVersion,

              screenWidth:
                sessionData.screenWidth,

              screenHeight:
                sessionData.screenHeight,

              pixelRatio:
                sessionData.pixelRatio,

              userAgent:
                sessionData.userAgent,

              ipAddress:
                sessionData.ipAddress,

              forwardedFor:
                sessionData.forwardedFor,

              latitude:
                sessionData.latitude,

              longitude:
                sessionData.longitude,

              locationAccuracy:
                sessionData.locationAccuracy,

              expiresAt:
                sessionData.expiresAt,
            }
          );


        // ----------------------------------------------------
        // Return all transaction results
        // ----------------------------------------------------

        return {
          customer,

          identity,

          session,

          sessionData,
        };
      }
    );


  // ----------------------------------------------------------
  // Final response for new Google customer
  // ----------------------------------------------------------

  return {
    success: true,

    status: "NEW_GOOGLE_USER",

    user: {
      id:
        transactionResult.customer.id,

      email:
        transactionResult.customer.email,

      phone:
        transactionResult.customer.phone,

      firstName:
        transactionResult.customer.firstName,

      lastName:
        transactionResult.customer.lastName,
    },

    identity: {
      provider: "GOOGLE",

      providerUserId:
        transactionResult.identity.providerUserId,

      providerEmail:
        transactionResult.identity.providerEmail,

      emailVerified:
        googleIdentity.emailVerified,
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