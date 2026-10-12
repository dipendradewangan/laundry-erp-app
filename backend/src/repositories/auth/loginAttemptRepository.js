/**
 * ============================================================
 * Laundry ERP - Login Attempt Repository
 * ============================================================
 *
 * File:
 *   backend/src/repositories/auth/loginAttemptRepository.js
 *
 * Purpose:
 *   Authentication login attempts ko laundry_core database ke
 *   auth_login_attempt table mein store karna.
 *
 * Responsibilities:
 *   1. Login attempt record create karna.
 *   2. User ID aur attempted identity store karna.
 *   3. Success/failure status store karna.
 *   4. Device, browser aur operating system metadata store karna.
 *   5. IP address aur request tracing information store karna.
 *
 * IMPORTANT:
 *   - Password aur password hash store nahi honge.
 *   - Access token aur refresh token store nahi honge.
 *   - Account locking aur password verification ka logic
 *     authentication service mein hi rahega.
 *   - Is repository mein sirf ek createLoginAttempt function hai.
 * ============================================================
 */

import { createDatabaseConnection } from "../../config/databaseConnection.js";

/**
 * ============================================================
 * Create Login Attempt
 * ============================================================
 *
 * Login attempt ka record database mein insert karta hai.
 *
 * @param {Object} params
 * @param {string|null} params.userId
 * @param {string} params.attemptedIdentity
 * @param {string} params.status
 * @param {string|null} params.failureReason
 *
 * @returns {Promise<Object>}
 */
export const createLoginAttempt = async ({
    // User information.
    userId = null,
    attemptedIdentity,
    status,
    failureReason = null,

    // Device information.
    deviceId = null,
    deviceType = null,
    deviceManufacturer = null,
    deviceModel = null,

    // Operating system information.
    operatingSystem = null,
    operatingSystemVersion = null,

    // Browser information.
    browser = null,
    browserVersion = null,

    // Screen information.
    screenWidth = null,
    screenHeight = null,
    devicePixelRatio = null,

    // Request information.
    userAgent = null,

    // Network information.
    ipAddress = null,
    forwardedFor = null,

    // Location information.
    latitude = null,
    longitude = null,
    locationAccuracy = null,

    // Session and request tracing.
    sessionId = null,
    requestId = null,
    correlationId = null,
}) => {
    /*
     * Validate required repository inputs.
     *
     * Business-level authentication validation remains
     * the responsibility of the authentication service.
     */
    if (
        typeof attemptedIdentity !== "string" ||
        !attemptedIdentity.trim()
    ) {
        throw new Error(
            "Login attempt requires a valid attemptedIdentity."
        );
    }

    if (
        typeof status !== "string" ||
        !status.trim()
    ) {
        throw new Error(
            "Login attempt requires a valid status."
        );
    }

    /*
     * Create a connection to the core database.
     */
    const connection = await createDatabaseConnection("laundry_core");

    try {
        /*
         * Insert one login attempt.
         *
         * UUID() generates the primary key inside MySQL.
         * Optional metadata is stored as NULL when unavailable.
         *
         * Never add passwords, password hashes or authentication
         * tokens to this query.
         */
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
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?,
                    ?, ?,
                    ?, ?, ?,
                    ?,
                    ?, ?,
                    ?, ?, ?,
                    ?, ?, ?
                )
            `,
            [
                // User information.
                userId,
                attemptedIdentity.trim(),
                status.trim(),
                failureReason,

                // Device information.
                deviceId,
                deviceType,
                deviceManufacturer,
                deviceModel,

                // Operating system.
                operatingSystem,
                operatingSystemVersion,

                // Browser.
                browser,
                browserVersion,

                // Screen.
                screenWidth,
                screenHeight,
                devicePixelRatio,

                // Request.
                userAgent,

                // Network.
                ipAddress,
                forwardedFor,

                // Location.
                latitude,
                longitude,
                locationAccuracy,

                // Session and tracing.
                sessionId,
                requestId,
                correlationId,
            ]
        );

        /*
         * Return a consistent repository result.
         *
         * Note:
         * UUID() is generated by MySQL, so insertId may not
         * contain the UUID. We return success and affectedRows
         * instead of treating insertId as the UUID.
         */
        return {
            success: true,
            affectedRows: result.affectedRows,
        };
    } finally {
        /*
         * Always close the connection, even if the INSERT fails.
         */
        await connection.end();
    }
};