import { createDatabaseConnection } from "../../config/databaseConnection.js";

/**
 * Create a login attempt record.
 *
 * This repository is responsible only for storing login-attempt
 * information in the auth_login_attempt table.
 *
 * Business decisions such as:
 * - account lock
 * - failed attempt threshold
 * - password verification
 *
 * Repository ka kaam nahi hai.
 *
 * Ye logic Auth Service me rahega.
 */
export const createLoginAttempt = async ({
    userId = null,
    attemptedIdentity,
    status,
    failureReason = null,

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

    sessionId = null,
    requestId = null,
    correlationId = null,
}) => {

    // ----------------------------------------------------------
    // Create database connection
    // ----------------------------------------------------------

    const connection = await createDatabaseConnection("laundry_core");

    try {

        // --------------------------------------------------------
        // Insert login attempt
        // --------------------------------------------------------

        const [result] = await connection.execute(
            `
      INSERT INTO auth_login_attempt (
          id,
          user_id,
          attempted_identity,
          status,
          failure_reason,

          device_id,
          device_type,
          device_manufacturer,
          device_model,

          operating_system,
          operating_system_version,

          browser,
          browser_version,

          screen_width,
          screen_height,
          device_pixel_ratio,

          user_agent,

          ip_address,
          forwarded_for,

          latitude,
          longitude,
          location_accuracy,

          session_id,
          request_id,
          correlation_id
      )
      VALUES (
          UUID(),
          ?,
          ?,
          ?,
          ?,

          ?,
          ?,
          ?,
          ?,

          ?,
          ?,

          ?,
          ?,

          ?,
          ?,
          ?,

          ?,

          ?,
          ?,

          ?,
          ?,
          ?,

          ?,
          ?,
          ?
      )
      `,
            [
                userId,
                attemptedIdentity,
                status,
                failureReason,

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

                sessionId,
                requestId,
                correlationId,
            ]
        );

        return {
            success: true,
            id: result.insertId,
        };

    } finally {

        // --------------------------------------------------------
        // Always close database connection.
        // --------------------------------------------------------

        await connection.end();
    }
}; import { createDatabaseConnection } from "../../config/databaseConnection.js";

/**
 * Create a login attempt record.
 *
 * This repository is responsible only for storing login-attempt
 * information in the auth_login_attempt table.
 *
 * Business decisions such as:
 * - account lock
 * - failed attempt threshold
 * - password verification
 *
 * Repository ka kaam nahi hai.
 *
 * Ye logic Auth Service me rahega.
 */
export const createLoginAttempt = async ({
    userId = null,
    attemptedIdentity,
    status,
    failureReason = null,

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

    sessionId = null,
    requestId = null,
    correlationId = null,
}) => {

    // ----------------------------------------------------------
    // Create database connection
    // ----------------------------------------------------------

    const connection = await createDatabaseConnection("laundry_core");

    try {

        // --------------------------------------------------------
        // Insert login attempt
        // --------------------------------------------------------

        const [result] = await connection.execute(
            `
      INSERT INTO auth_login_attempt (
          id,
          user_id,
          attempted_identity,
          status,
          failure_reason,

          device_id,
          device_type,
          device_manufacturer,
          device_model,

          operating_system,
          operating_system_version,

          browser,
          browser_version,

          screen_width,
          screen_height,
          device_pixel_ratio,

          user_agent,

          ip_address,
          forwarded_for,

          latitude,
          longitude,
          location_accuracy,

          session_id,
          request_id,
          correlation_id
      )
      VALUES (
          UUID(),
          ?,
          ?,
          ?,
          ?,

          ?,
          ?,
          ?,
          ?,

          ?,
          ?,

          ?,
          ?,

          ?,
          ?,
          ?,

          ?,

          ?,
          ?,

          ?,
          ?,
          ?,

          ?,
          ?,
          ?
      )
      `,
            [
                userId,
                attemptedIdentity,
                status,
                failureReason,

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

                sessionId,
                requestId,
                correlationId,
            ]
        );

        return {
            success: true,
            id: result.insertId,
        };

    } finally {

        // --------------------------------------------------------
        // Always close database connection.
        // --------------------------------------------------------

        await connection.end();
    }
}; import { createDatabaseConnection } from "../../config/databaseConnection.js";

/**
 * Create a login attempt record.
 *
 * This repository is responsible only for storing login-attempt
 * information in the auth_login_attempt table.
 *
 * Business decisions such as:
 * - account lock
 * - failed attempt threshold
 * - password verification
 *
 * Repository ka kaam nahi hai.
 *
 * Ye logic Auth Service me rahega.
 */
export const createLoginAttempt = async ({
    userId = null,
    attemptedIdentity,
    status,
    failureReason = null,

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

    sessionId = null,
    requestId = null,
    correlationId = null,
}) => {

    // ----------------------------------------------------------
    // Create database connection
    // ----------------------------------------------------------

    const connection = await createDatabaseConnection("laundry_core");

    try {

        // --------------------------------------------------------
        // Insert login attempt
        // --------------------------------------------------------

        const [result] = await connection.execute(
            `
      INSERT INTO auth_login_attempt (
          id,
          user_id,
          attempted_identity,
          status,
          failure_reason,

          device_id,
          device_type,
          device_manufacturer,
          device_model,

          operating_system,
          operating_system_version,

          browser,
          browser_version,

          screen_width,
          screen_height,
          device_pixel_ratio,

          user_agent,

          ip_address,
          forwarded_for,

          latitude,
          longitude,
          location_accuracy,

          session_id,
          request_id,
          correlation_id
      )
      VALUES (
          UUID(),
          ?,
          ?,
          ?,
          ?,

          ?,
          ?,
          ?,
          ?,

          ?,
          ?,

          ?,
          ?,

          ?,
          ?,
          ?,

          ?,

          ?,
          ?,

          ?,
          ?,
          ?,

          ?,
          ?,
          ?
      )
      `,
            [
                userId,
                attemptedIdentity,
                status,
                failureReason,

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

                sessionId,
                requestId,
                correlationId,
            ]
        );

        return {
            success: true,
            id: result.insertId,
        };

    } finally {

        // --------------------------------------------------------
        // Always close database connection.
        // --------------------------------------------------------

        await connection.end();
    }
}; import { createDatabaseConnection } from "../../config/databaseConnection.js";

/**
 * Create a login attempt record.
 *
 * This repository is responsible only for storing login-attempt
 * information in the auth_login_attempt table.
 *
 * Business decisions such as:
 * - account lock
 * - failed attempt threshold
 * - password verification
 *
 * Repository ka kaam nahi hai.
 *
 * Ye logic Auth Service me rahega.
 */
export const createLoginAttempt = async ({
    userId = null,
    attemptedIdentity,
    status,
    failureReason = null,

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

    sessionId = null,
    requestId = null,
    correlationId = null,
}) => {

    // ----------------------------------------------------------
    // Create database connection
    // ----------------------------------------------------------

    const connection = await createDatabaseConnection("laundry_core");

    try {

        // --------------------------------------------------------
        // Insert login attempt
        // --------------------------------------------------------

        const [result] = await connection.execute(
            `
      INSERT INTO auth_login_attempt (
          id,
          user_id,
          attempted_identity,
          status,
          failure_reason,

          device_id,
          device_type,
          device_manufacturer,
          device_model,

          operating_system,
          operating_system_version,

          browser,
          browser_version,

          screen_width,
          screen_height,
          device_pixel_ratio,

          user_agent,

          ip_address,
          forwarded_for,

          latitude,
          longitude,
          location_accuracy,

          session_id,
          request_id,
          correlation_id
      )
      VALUES (
          UUID(),
          ?,
          ?,
          ?,
          ?,

          ?,
          ?,
          ?,
          ?,

          ?,
          ?,

          ?,
          ?,

          ?,
          ?,
          ?,

          ?,

          ?,
          ?,

          ?,
          ?,
          ?,

          ?,
          ?,
          ?
      )
      `,
            [
                userId,
                attemptedIdentity,
                status,
                failureReason,

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

                sessionId,
                requestId,
                correlationId,
            ]
        );

        return {
            success: true,
            id: result.insertId,
        };

    } finally {

        // --------------------------------------------------------
        // Always close database connection.
        // --------------------------------------------------------

        await connection.end();
    }
}; import { createDatabaseConnection } from "../../config/databaseConnection.js";

/**
 * Create a login attempt record.
 *
 * This repository is responsible only for storing login-attempt
 * information in the auth_login_attempt table.
 *
 * Business decisions such as:
 * - account lock
 * - failed attempt threshold
 * - password verification
 *
 * Repository ka kaam nahi hai.
 *
 * Ye logic Auth Service me rahega.
 */
export const createLoginAttempt = async ({
    userId = null,
    attemptedIdentity,
    status,
    failureReason = null,

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

    sessionId = null,
    requestId = null,
    correlationId = null,
}) => {

    // ----------------------------------------------------------
    // Create database connection
    // ----------------------------------------------------------

    const connection = await createDatabaseConnection("laundry_core");

    try {

        // --------------------------------------------------------
        // Insert login attempt
        // --------------------------------------------------------

        const [result] = await connection.execute(
            `
      INSERT INTO auth_login_attempt (
          id,
          user_id,
          attempted_identity,
          status,
          failure_reason,

          device_id,
          device_type,
          device_manufacturer,
          device_model,

          operating_system,
          operating_system_version,

          browser,
          browser_version,

          screen_width,
          screen_height,
          device_pixel_ratio,

          user_agent,

          ip_address,
          forwarded_for,

          latitude,
          longitude,
          location_accuracy,

          session_id,
          request_id,
          correlation_id
      )
      VALUES (
          UUID(),
          ?,
          ?,
          ?,
          ?,

          ?,
          ?,
          ?,
          ?,

          ?,
          ?,

          ?,
          ?,

          ?,
          ?,
          ?,

          ?,

          ?,
          ?,

          ?,
          ?,
          ?,

          ?,
          ?,
          ?
      )
      `,
            [
                userId,
                attemptedIdentity,
                status,
                failureReason,

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

                sessionId,
                requestId,
                correlationId,
            ]
        );

        return {
            success: true,
            id: result.insertId,
        };

    } finally {

        // --------------------------------------------------------
        // Always close database connection.
        // --------------------------------------------------------

        await connection.end();
    }
}; import { createDatabaseConnection } from "../../config/databaseConnection.js";

/**
 * Create a login attempt record.
 *
 * This repository is responsible only for storing login-attempt
 * information in the auth_login_attempt table.
 *
 * Business decisions such as:
 * - account lock
 * - failed attempt threshold
 * - password verification
 *
 * Repository ka kaam nahi hai.
 *
 * Ye logic Auth Service me rahega.
 */
export const createLoginAttempt = async ({
    userId = null,
    attemptedIdentity,
    status,
    failureReason = null,

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

    sessionId = null,
    requestId = null,
    correlationId = null,
}) => {

    // ----------------------------------------------------------
    // Create database connection
    // ----------------------------------------------------------

    const connection = await createDatabaseConnection("laundry_core");

    try {

        // --------------------------------------------------------
        // Insert login attempt
        // --------------------------------------------------------

        const [result] = await connection.execute(
            `
      INSERT INTO auth_login_attempt (
          id, user_id, attempted_identity, status, failure_reason, device_id, device_type, device_manufacturer, device_model, operating_system, operating_system_version, browser, browser_version, screen_width, screen_height, device_pixel_ratio, user_agent, ip_address, forwarded_for, latitude, longitude, location_accuracy, session_id, request_id, correlation_id
      )
      VALUES (
          UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      `,
            [userId, attemptedIdentity, status, failureReason, deviceId, deviceType, deviceManufacturer, deviceModel, operatingSystem, operatingSystemVersion, browser, browserVersion, screenWidth, screenHeight, devicePixelRatio, userAgent, ipAddress, forwardedFor, latitude, longitude, locationAccuracy, sessionId, requestId, correlationId]
        );

        return {
            success: true,
            id: result.insertId,
        };

    } finally {

        // --------------------------------------------------------
        // Always close database connection.
        // --------------------------------------------------------

        await connection.end();
    }
};