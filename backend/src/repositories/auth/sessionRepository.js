/**
 * ============================================================
 * Laundry ERP - Authentication Session Repository
 * ============================================================
 *
 * File:
 * src/repositories/auth/sessionRepository.js
 *
 * Responsibilities:
 * 1. Create authentication sessions.
 * 2. Find active sessions.
 * 3. Rotate refresh tokens atomically.
 * 4. Maintain refresh-token history.
 * 5. Detect reuse of previously rotated refresh tokens.
 * 6. Revoke sessions and their active refresh tokens.
 *
 * Security:
 * - Raw refresh tokens are never stored in MySQL.
 * - Only SHA-256 hashes are stored.
 * - Database transactions protect related updates.
 * - Reuse of a rotated token triggers session revocation.
 *
 * ============================================================
 */

import { createDatabaseConnection } from "../../config/databaseConnection.js";
import { executeTransaction } from "../../config/databaseTransaction.js";


/**
 * ============================================================
 * Create Authentication Session
 * ============================================================
 *
 * Creates:
 * 1. The authentication session.
 * 2. The initial ACTIVE refresh-token history entry.
 *
 * Both inserts occur inside the same transaction.
 */
export const createSession = async ({
    id,
    userId,
    sessionId,
    refreshTokenHash,

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

    expiresAt,
}) => {
    // A refresh-token hash must be a SHA-256 hexadecimal hash.
    if (
        typeof refreshTokenHash !== "string" ||
        !/^[a-f0-9]{64}$/i.test(refreshTokenHash)
    ) {
        throw new Error("A valid refresh-token hash is required.");
    }

    return executeTransaction(async (connection) => {

        /**
         * STEP 1:
         * Create the authentication session.
         */
        await connection.execute(
            `
            INSERT INTO auth_session (
                id,
                user_id,
                session_id,
                refresh_token_hash,

                device_id,
                device_type,
                device_manufacturer,
                device_model,

                os_name,
                os_version,

                browser_name,
                browser_version,

                screen_width,
                screen_height,
                pixel_ratio,

                user_agent,

                ip_address,
                forwarded_for,

                latitude,
                longitude,
                location_accuracy,

                expires_at
            )
            VALUES (
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?,
                ?, ?,
                ?, ?, ?,
                ?,
                ?, ?,
                ?, ?, ?,
                ?
            )
            `,
            [
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
            ]
        );


        /**
         * STEP 2:
         * Record the initial refresh token in history.
         *
         * The foreign key references auth_session(session_id),
         * so the session must be inserted first.
         */
        await connection.execute(
            `
            INSERT INTO auth_refresh_token_history (
                id,
                session_id,
                refresh_token_hash,
                token_status
            )
            VALUES (
                UUID(),
                ?,
                ?,
                'ACTIVE'
            )
            `,
            [
                sessionId,
                refreshTokenHash,
            ]
        );


        return {
            success: true,
            id,
            sessionId,
        };
    });
};


/**
 * ============================================================
 * Find Active Session By Session ID
 * ============================================================
 *
 * Returns only a session that is:
 * - Active.
 * - Not revoked.
 * - Not expired.
 */
export const findActiveSessionBySessionId = async (sessionId) => {
    const connection = await createDatabaseConnection("laundry_core");

    try {
        const [rows] = await connection.execute(
            `
            SELECT
                id,
                user_id,
                session_id,
                refresh_token_hash,

                device_id,
                device_type,
                device_manufacturer,
                device_model,

                os_name,
                os_version,

                browser_name,
                browser_version,

                screen_width,
                screen_height,
                pixel_ratio,

                user_agent,

                ip_address,
                forwarded_for,

                latitude,
                longitude,
                location_accuracy,

                created_at,
                last_activity_at,
                expires_at,
                revoked_at,
                revoke_reason,
                is_active

            FROM auth_session

            WHERE session_id = ?
              AND is_active = TRUE
              AND revoked_at IS NULL
              AND expires_at > CURRENT_TIMESTAMP

            LIMIT 1
            `,
            [sessionId]
        );

        return rows.length > 0 ? rows[0] : null;

    } finally {
        await connection.end();
    }
};


/**
 * ============================================================
 * Find Active Session By Refresh-Token Hash
 * ============================================================
 *
 * The service must pass only the SHA-256 hash.
 * Never query the database using the raw refresh token.
 */
export const findActiveSessionByRefreshTokenHash = async (
    refreshTokenHash
) => {
    const connection = await createDatabaseConnection("laundry_core");

    try {
        const [rows] = await connection.execute(
            `
            SELECT
                id,
                user_id,
                session_id,
                refresh_token_hash,
                expires_at,
                revoked_at,
                is_active

            FROM auth_session

            WHERE refresh_token_hash = ?
              AND is_active = TRUE
              AND revoked_at IS NULL
              AND expires_at > CURRENT_TIMESTAMP

            LIMIT 1
            `,
            [refreshTokenHash]
        );

        return rows.length > 0 ? rows[0] : null;

    } finally {
        await connection.end();
    }
};


/**
 * ============================================================
 * Rotate Refresh Token By Hash
 * ============================================================
 *
 * Token rotation and history updates are atomic.
 *
 * Successful rotation:
 * 1. Lock the active session.
 * 2. Mark the previous token ROTATED.
 * 3. Replace the session's current token hash.
 * 4. Insert the new token hash as ACTIVE.
 *
 * Reuse detection:
 * 1. If the token is not current, check its history.
 * 2. If the token was previously ROTATED, identify its session.
 * 3. Revoke the associated active session.
 * 4. Mark any currently ACTIVE token-history entry REVOKED.
 *
 * IMPORTANT:
 * Only token hashes are accepted by this function.
 */
export const rotateRefreshTokenByHash = async ({
    currentRefreshTokenHash,
    newRefreshTokenHash,
}) => {

    /**
     * STEP 1:
     * Validate both hashes before accessing the database.
     */
    if (
        typeof currentRefreshTokenHash !== "string" ||
        !/^[a-f0-9]{64}$/i.test(currentRefreshTokenHash) ||
        typeof newRefreshTokenHash !== "string" ||
        !/^[a-f0-9]{64}$/i.test(newRefreshTokenHash)
    ) {
        throw new Error("Valid refresh-token hashes are required.");
    }

    if (currentRefreshTokenHash === newRefreshTokenHash) {
        throw new Error(
            "The new refresh-token hash must be different."
        );
    }


    return executeTransaction(async (connection) => {

        /**
         * STEP 2:
         * Find and lock the session whose CURRENT refresh-token
         * hash matches the supplied hash.
         *
         * Locking serializes concurrent requests for this session.
         */
        const [sessionRows] = await connection.execute(
            `
            SELECT
                id,
                user_id,
                session_id,
                refresh_token_hash,
                expires_at

            FROM auth_session

            WHERE refresh_token_hash = ?
              AND is_active = TRUE
              AND revoked_at IS NULL
              AND expires_at > CURRENT_TIMESTAMP

            LIMIT 1
            FOR UPDATE
            `,
            [currentRefreshTokenHash]
        );


        /**
         * STEP 3:
         * If no current session matches, inspect token history.
         *
         * A previously ROTATED token may indicate token reuse.
         */
        if (sessionRows.length === 0) {

            const [historyRows] = await connection.execute(
                `
                SELECT
                    history.id AS history_id,
                    history.session_id,
                    history.token_status,
                    session.is_active,
                    session.revoked_at

                FROM auth_refresh_token_history AS history

                INNER JOIN auth_session AS session
                    ON session.session_id = history.session_id

                WHERE history.refresh_token_hash = ?

                LIMIT 1
                FOR UPDATE
                `,
                [currentRefreshTokenHash]
            );


            /**
             * STEP 4:
             * Only a token previously marked ROTATED is treated
             * as a confirmed refresh-token reuse event.
             */
            if (
                historyRows.length > 0 &&
                historyRows[0].token_status === "ROTATED"
            ) {
                const reusedToken = historyRows[0];


                /**
                 * Revoke the associated session if it is still active.
                 *
                 * The transaction will commit these changes even
                 * though the result below indicates failure.
                 */
                if (
                    reusedToken.is_active &&
                    reusedToken.revoked_at === null
                ) {
                    await connection.execute(
                        `
                        UPDATE auth_session

                        SET
                            is_active = FALSE,
                            revoked_at = CURRENT_TIMESTAMP,
                            revoke_reason = 'REFRESH_TOKEN_REUSE'

                        WHERE session_id = ?
                          AND is_active = TRUE
                          AND revoked_at IS NULL
                        `,
                        [reusedToken.session_id]
                    );


                    /**
                     * Revoke any current ACTIVE token-history
                     * entry associated with the same session.
                     */
                    await connection.execute(
                        `
                        UPDATE auth_refresh_token_history

                        SET
                            token_status = 'REVOKED',
                            revoked_at = CURRENT_TIMESTAMP

                        WHERE session_id = ?
                          AND token_status = 'ACTIVE'
                        `,
                        [reusedToken.session_id]
                    );
                }


                /**
                 * Returning a failure result does not throw.
                 * Therefore executeTransaction commits the revocation.
                 */
                return {
                    success: false,
                    rotated: false,
                    reason: "REFRESH_TOKEN_REUSE_DETECTED",
                    sessionId: reusedToken.session_id,
                };
            }


            /**
             * No confirmed reuse event:
             * token may be invalid, expired, or unknown.
             */
            return {
                success: false,
                rotated: false,
                reason: "INVALID_REFRESH_TOKEN",
            };
        }


        const session = sessionRows[0];


        /**
         * STEP 5:
         * Mark the existing token as ROTATED.
         *
         * This must happen before inserting the new ACTIVE token.
         */
        const [historyUpdate] = await connection.execute(
            `
            UPDATE auth_refresh_token_history

            SET
                token_status = 'ROTATED',
                consumed_at = CURRENT_TIMESTAMP

            WHERE session_id = ?
              AND refresh_token_hash = ?
              AND token_status = 'ACTIVE'
            `,
            [
                session.session_id,
                currentRefreshTokenHash,
            ]
        );


        /**
         * Every current token must have an ACTIVE history entry.
         *
         * If it is missing, abort the transaction rather than
         * rotating without maintaining a reliable history.
         */
        if (historyUpdate.affectedRows !== 1) {
            throw new Error(
                "Refresh-token history is inconsistent. Rotation aborted."
            );
        }


        /**
         * STEP 6:
         * Replace the current refresh-token hash.
         *
         * The session expiry is deliberately unchanged.
         */
        const [sessionUpdate] = await connection.execute(
            `
            UPDATE auth_session

            SET
                refresh_token_hash = ?,
                last_activity_at = CURRENT_TIMESTAMP

            WHERE id = ?
              AND refresh_token_hash = ?
              AND is_active = TRUE
              AND revoked_at IS NULL
              AND expires_at > CURRENT_TIMESTAMP
            `,
            [
                newRefreshTokenHash,
                session.id,
                currentRefreshTokenHash,
            ]
        );


        /**
         * The locked session should still match.
         * Abort if the conditional update unexpectedly fails.
         */
        if (sessionUpdate.affectedRows !== 1) {
            throw new Error(
                "Session changed during refresh-token rotation."
            );
        }


        /**
         * STEP 7:
         * Insert the replacement token into history as ACTIVE.
         */
        await connection.execute(
            `
            INSERT INTO auth_refresh_token_history (
                id,
                session_id,
                refresh_token_hash,
                token_status
            )
            VALUES (
                UUID(),
                ?,
                ?,
                'ACTIVE'
            )
            `,
            [
                session.session_id,
                newRefreshTokenHash,
            ]
        );


        /**
         * STEP 8:
         * Return the session information to the service.
         */
        return {
            success: true,
            rotated: true,

            session: {
                id: session.id,
                userId: session.user_id,
                sessionId: session.session_id,
                expiresAt: session.expires_at,
            },
        };
    });
};


/**
 * ============================================================
 * Legacy Rotation Method
 * ============================================================
 *
 * Preserved for compatibility with existing callers.
 *
 * New refresh-token operations should use
 * rotateRefreshTokenByHash().
 */
export const rotateRefreshToken = async ({
    sessionId,
    currentRefreshTokenHash,
    newRefreshTokenHash,
}) => {

    if (
        typeof sessionId !== "string" ||
        !sessionId.trim() ||
        typeof currentRefreshTokenHash !== "string" ||
        !/^[a-f0-9]{64}$/i.test(currentRefreshTokenHash) ||
        typeof newRefreshTokenHash !== "string" ||
        !/^[a-f0-9]{64}$/i.test(newRefreshTokenHash)
    ) {
        throw new Error(
            "Valid session ID and refresh-token hashes are required."
        );
    }

    if (currentRefreshTokenHash === newRefreshTokenHash) {
        throw new Error(
            "The new refresh-token hash must be different."
        );
    }


    return executeTransaction(async (connection) => {

        const [rows] = await connection.execute(
            `
            SELECT
                id,
                user_id,
                session_id,
                refresh_token_hash,
                expires_at

            FROM auth_session

            WHERE session_id = ?
              AND refresh_token_hash = ?
              AND is_active = TRUE
              AND revoked_at IS NULL
              AND expires_at > CURRENT_TIMESTAMP

            LIMIT 1
            FOR UPDATE
            `,
            [
                sessionId,
                currentRefreshTokenHash,
            ]
        );


        if (rows.length === 0) {
            return {
                success: false,
                rotated: false,
                reason: "INVALID_REFRESH_TOKEN",
            };
        }


        const session = rows[0];


        // Mark the old token as consumed.
        const [historyUpdate] = await connection.execute(
            `
            UPDATE auth_refresh_token_history

            SET
                token_status = 'ROTATED',
                consumed_at = CURRENT_TIMESTAMP

            WHERE session_id = ?
              AND refresh_token_hash = ?
              AND token_status = 'ACTIVE'
            `,
            [
                sessionId,
                currentRefreshTokenHash,
            ]
        );


        if (historyUpdate.affectedRows !== 1) {
            throw new Error(
                "Refresh-token history is inconsistent."
            );
        }


        // Replace the current session token.
        const [sessionUpdate] = await connection.execute(
            `
            UPDATE auth_session

            SET
                refresh_token_hash = ?,
                last_activity_at = CURRENT_TIMESTAMP

            WHERE id = ?
              AND refresh_token_hash = ?
              AND is_active = TRUE
              AND revoked_at IS NULL
              AND expires_at > CURRENT_TIMESTAMP
            `,
            [
                newRefreshTokenHash,
                session.id,
                currentRefreshTokenHash,
            ]
        );


        if (sessionUpdate.affectedRows !== 1) {
            throw new Error(
                "Session changed during refresh-token rotation."
            );
        }


        // Record the replacement token.
        await connection.execute(
            `
            INSERT INTO auth_refresh_token_history (
                id,
                session_id,
                refresh_token_hash,
                token_status
            )
            VALUES (
                UUID(),
                ?,
                ?,
                'ACTIVE'
            )
            `,
            [
                sessionId,
                newRefreshTokenHash,
            ]
        );


        return {
            success: true,
            rotated: true,

            session: {
                id: session.id,
                userId: session.user_id,
                sessionId: session.session_id,
                expiresAt: session.expires_at,
            },
        };
    });
};


/**
 * ============================================================
 * Update Session Activity
 * ============================================================
 *
 * Updates activity only for a valid active session.
 */
export const updateSessionActivity = async (sessionId) => {
    const connection = await createDatabaseConnection("laundry_core");

    try {
        const [result] = await connection.execute(
            `
            UPDATE auth_session

            SET last_activity_at = CURRENT_TIMESTAMP

            WHERE session_id = ?
              AND is_active = TRUE
              AND revoked_at IS NULL
              AND expires_at > CURRENT_TIMESTAMP
            `,
            [sessionId]
        );

        return {
            success: true,
            affectedRows: result.affectedRows,
        };

    } finally {
        await connection.end();
    }
};


/**
 * ============================================================
 * Revoke Session
 * ============================================================
 *
 * Used for:
 * - Logout.
 * - Password change.
 * - Administrative forced logout.
 * - Suspicious activity.
 * - Refresh-token reuse.
 *
 * Session revocation and token-history updates are atomic.
 */
export const revokeSession = async ({
    sessionId,
    revokeReason,
}) => {

    if (
        typeof sessionId !== "string" ||
        !sessionId.trim()
    ) {
        throw new Error("A valid session ID is required.");
    }

    return executeTransaction(async (connection) => {

        const [result] = await connection.execute(
            `
            UPDATE auth_session

            SET
                is_active = FALSE,
                revoked_at = CURRENT_TIMESTAMP,
                revoke_reason = ?

            WHERE session_id = ?
              AND is_active = TRUE
              AND revoked_at IS NULL
            `,
            [
                revokeReason,
                sessionId,
            ]
        );


        /**
         * Mark the session's current token as revoked.
         *
         * Previous ROTATED history entries are preserved for
         * security investigation and reuse detection.  
         */
        await connection.execute(
            `
            UPDATE auth_refresh_token_history

            SET
                token_status = 'REVOKED',
                revoked_at = CURRENT_TIMESTAMP

            WHERE session_id = ?
              AND token_status = 'ACTIVE'
            `,
            [sessionId]
        );


        return {
            success: true,
            affectedRows: result.affectedRows,
        };
    });
};