import bcrypt from "bcrypt";

import {
    findUserByIdentity,
    findUsersByPhone,
    incrementFailedLoginAttempts,
    lockUserAccount,
    resetFailedLoginAttempts,
    updateLastLogin,
} from "../../repositories/auth/userRepository.js";

import { createLoginAttempt } from "../../repositories/auth/loginAttemptRepository.js";
import { createAuthSession } from "./authSessionService.js";
import { recordAuditEvent } from "../audit/auditService.js";

// Maximum failed password attempts allowed before locking the account.
const MAX_FAILED_LOGIN_ATTEMPTS = 5;

// Account lock duration in minutes.
const LOCK_DURATION_MINUTES = 15;

/**
 * Masks an email address before showing it during account selection.
 *
 * Example:
 * dipendra@example.com -> d******a@example.com
 */
const maskEmail = (email) => {
    if (!email || typeof email !== "string") {
        return null;
    }

    const [localPart, domain] = email.split("@");

    if (!localPart || !domain) {
        return null;
    }

    if (localPart.length <= 2) {
        return `${localPart[0]}***@${domain}`;
    }

    return `${localPart[0]}${"*".repeat(
        Math.min(localPart.length - 2, 8)
    )}${localPart[localPart.length - 1]}@${domain}`;
};

/**
 * Determines whether an identity looks like an email address.
 * Email is unique in master_user; phone numbers may be duplicated.
 */
const isEmailIdentity = (identity) => {
    return typeof identity === "string" && identity.includes("@");
};

/**
 * Records a password-login attempt.
 *
 * Repository field names are used consistently so device metadata
 * is not silently discarded.
 */
const recordPasswordLoginAttempt = async ({
    userId = null,
    identity,
    status,
    failureReason = null,
    metadata = {},
    sessionId = null,
}) => {
    return createLoginAttempt({
        userId,
        attemptedIdentity: identity,
        status,
        failureReason,

        deviceId: metadata.deviceId ?? null,
        deviceType: metadata.deviceType ?? null,
        deviceManufacturer: metadata.deviceManufacturer ?? null,
        deviceModel: metadata.deviceModel ?? null,

        operatingSystem: metadata.operatingSystem ?? metadata.osName ?? null,
        operatingSystemVersion:
            metadata.operatingSystemVersion ?? metadata.osVersion ?? null,

        browser: metadata.browser ?? metadata.browserName ?? null,
        browserVersion: metadata.browserVersion ?? null,

        screenWidth: metadata.screenWidth ?? null,
        screenHeight: metadata.screenHeight ?? null,
        devicePixelRatio: metadata.devicePixelRatio ?? metadata.pixelRatio ?? null,

        userAgent: metadata.userAgent ?? null,
        ipAddress: metadata.ipAddress ?? null,
        forwardedFor: metadata.forwardedFor ?? null,

        latitude: metadata.latitude ?? null,
        longitude: metadata.longitude ?? null,
        locationAccuracy: metadata.locationAccuracy ?? null,

        sessionId,
        requestId: metadata.requestId ?? null,
        correlationId: metadata.correlationId ?? null,
    });
};

/**
 * Records password-login audit events.
 *
 * Audit failures are logged without converting an otherwise successful
 * authentication into a failed login.
 */
const recordPasswordLoginAudit = async ({
    action,
    status,
    userId = null,
    identity,
    reason = null,
    sessionId = null,
    metadata = {},
    entity = "master_user",
    entityId = userId,
}) => {
    try {
        await recordAuditEvent({
            action,
            status,
            module: "AUTH",
            entity,
            entityId,
            userId,
            sessionId,

            ipAddress: metadata.ipAddress ?? null,
            userAgent: metadata.userAgent ?? null,
            requestId: metadata.requestId ?? null,
            correlationId: metadata.correlationId ?? null,

            reason,
            metadata: {
                provider: "PASSWORD",
                attemptedIdentity: identity,
                deviceId: metadata.deviceId ?? null,
                deviceType: metadata.deviceType ?? null,
                deviceManufacturer: metadata.deviceManufacturer ?? null,
                deviceModel: metadata.deviceModel ?? null,
                operatingSystem:
                    metadata.operatingSystem ?? metadata.osName ?? null,
                operatingSystemVersion:
                    metadata.operatingSystemVersion ?? metadata.osVersion ?? null,
                browser: metadata.browser ?? metadata.browserName ?? null,
                browserVersion: metadata.browserVersion ?? null,
                screenWidth: metadata.screenWidth ?? null,
                screenHeight: metadata.screenHeight ?? null,
                devicePixelRatio:
                    metadata.devicePixelRatio ?? metadata.pixelRatio ?? null,
                forwardedFor: metadata.forwardedFor ?? null,
                latitude: metadata.latitude ?? null,
                longitude: metadata.longitude ?? null,
                locationAccuracy: metadata.locationAccuracy ?? null,
            },
        });
    } catch (error) {
        // Authentication should not be reversed just because audit storage
        // is temporarily unavailable. The error must still be observable.
        console.error("Password login audit failed:", error.message);
    }
};

/**
 * Returns a safe user object for the API response.
 *
 * Password hashes and internal security fields are never returned.
 */
const buildPublicUser = (user) => ({
    id: user.id,
    email: user.email,
    phone: user.phone,
    firstName: user.first_name,
    middleName: user.middle_name,
    lastName: user.last_name,
});

/**
 * Performs the common checks and password verification for one account.
 *
 * This function does not select an account; callers must first resolve
 * the identity to exactly one user.
 */
const authenticateSelectedUser = async ({
    user,
    identity,
    password,
    metadata = {},
}) => {
    if (!user) {
        return {
            success: false,
            reason: "INVALID_CREDENTIALS",
        };
    }

    if (!user.is_active) {
        await recordPasswordLoginAttempt({
            userId: user.id,
            identity,
            status: "FAILED",
            failureReason: "ACCOUNT_INACTIVE",
            metadata,
        });

        await recordPasswordLoginAudit({
            action: "PASSWORD_LOGIN_FAILED",
            status: "FAILED",
            userId: user.id,
            identity,
            reason: "ACCOUNT_INACTIVE",
            metadata,
        });

        return {
            success: false,
            reason: "ACCOUNT_INACTIVE",
        };
    }

    if (!user.is_login_enabled) {
        await recordPasswordLoginAttempt({
            userId: user.id,
            identity,
            status: "FAILED",
            failureReason: "LOGIN_DISABLED",
            metadata,
        });

        await recordPasswordLoginAudit({
            action: "PASSWORD_LOGIN_FAILED",
            status: "FAILED",
            userId: user.id,
            identity,
            reason: "LOGIN_DISABLED",
            metadata,
        });

        return {
            success: false,
            reason: "LOGIN_DISABLED",
        };
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
        await recordPasswordLoginAttempt({
            userId: user.id,
            identity,
            status: "FAILED",
            failureReason: "ACCOUNT_LOCKED",
            metadata,
        });

        await recordPasswordLoginAudit({
            action: "PASSWORD_LOGIN_FAILED",
            status: "FAILED",
            userId: user.id,
            identity,
            reason: "ACCOUNT_LOCKED",
            metadata,
        });

        return {
            success: false,
            reason: "ACCOUNT_LOCKED",
            lockedUntil: user.locked_until,
        };
    }

    // Accounts without a password hash cannot use password authentication.
    if (!user.password_hash) {
        await recordPasswordLoginAttempt({
            userId: user.id,
            identity,
            status: "FAILED",
            failureReason: "PASSWORD_LOGIN_UNAVAILABLE",
            metadata,
        });

        return {
            success: false,
            reason: "INVALID_CREDENTIALS",
        };
    }

    const passwordMatched = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!passwordMatched) {
        // Increment the failed-login counter for this specific account.
        await incrementFailedLoginAttempts(user.id);

        // Check the latest count after incrementing.
        const failedAttempts = Number(user.failed_login_attempts ?? 0) + 1;

        let failureReason = "INVALID_CREDENTIALS";

        if (failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
            const lockedUntil = new Date(
                Date.now() + LOCK_DURATION_MINUTES * 60 * 1000
            );

            await lockUserAccount({
                userId: user.id,
                lockedUntil,
            });

            failureReason = "ACCOUNT_LOCKED";
        }

        await recordPasswordLoginAttempt({
            userId: user.id,
            identity,
            status: "FAILED",
            failureReason,
            metadata,
        });

        await recordPasswordLoginAudit({
            action: "PASSWORD_LOGIN_FAILED",
            status: "FAILED",
            userId: user.id,
            identity,
            reason: failureReason,
            metadata,
        });

        return {
            success: false,
            reason: failureReason,
        };
    }

    // Clear previous failed attempts after successful password verification.
    await resetFailedLoginAttempts(user.id);

    await updateLastLogin(user.id);

    // Map metadata to the exact property names expected by authSessionService.
    const session = await createAuthSession({
        userId: user.id,

        deviceId: metadata.deviceId ?? null,
        deviceType: metadata.deviceType ?? null,
        deviceManufacturer: metadata.deviceManufacturer ?? null,
        deviceModel: metadata.deviceModel ?? null,

        operatingSystem:
            metadata.operatingSystem ?? metadata.osName ?? null,
        operatingSystemVersion:
            metadata.operatingSystemVersion ?? metadata.osVersion ?? null,

        browser: metadata.browser ?? metadata.browserName ?? null,
        browserVersion: metadata.browserVersion ?? null,

        userAgent: metadata.userAgent ?? null,
        ipAddress: metadata.ipAddress ?? null,
        forwardedFor: metadata.forwardedFor ?? null,

        latitude: metadata.latitude ?? null,
        longitude: metadata.longitude ?? null,
        locationAccuracy: metadata.locationAccuracy ?? null,
    });

    await recordPasswordLoginAttempt({
        userId: user.id,
        identity,
        status: "SUCCESS",
        metadata,
        sessionId: session.sessionId,
    });

    await recordPasswordLoginAudit({
        action: "PASSWORD_LOGIN_SUCCESS",
        status: "SUCCESS",
        userId: user.id,
        identity,
        sessionId: session.sessionId,
        entity: "auth_session",
        entityId: session.sessionId,
        metadata,
    });

    return {
        success: true,
        user: buildPublicUser(user),
        session,
    };
};

/**
 * Password login using email or mobile number.
 *
 * If a mobile number belongs to multiple accounts, returns masked email
 * options and does not create a session.
 */
export const loginWithPassword = async ({
    identity,
    password,
    ...metadata
}) => {
    const normalizedIdentity =
        typeof identity === "string" ? identity.trim() : "";

    if (!normalizedIdentity || typeof password !== "string" || !password) {
        return {
            success: false,
            reason: "INVALID_INPUT",
        };
    }

    const user = await findUserByIdentity(normalizedIdentity);

    if (!user) {
        await recordPasswordLoginAttempt({
            identity: normalizedIdentity,
            status: "FAILED",
            failureReason: "INVALID_CREDENTIALS",
            metadata,
        });

        await recordPasswordLoginAudit({
            action: "PASSWORD_LOGIN_FAILED",
            status: "FAILED",
            identity: normalizedIdentity,
            reason: "INVALID_CREDENTIALS",
            metadata,
        });

        return {
            success: false,
            reason: "INVALID_CREDENTIALS",
        };
    }

    // Multiple matches are possible for a phone number, but not for email.
    if (user.multipleMatches) {
        const accounts = (user.users ?? [])
            .filter((account) => account.email)
            .map((account) => ({
                email: maskEmail(account.email),
            }));

        if (accounts.length === 0) {
            return {
                success: false,
                reason: "INVALID_CREDENTIALS",
            };
        }

        return {
            success: false,
            reason: "ACCOUNT_SELECTION_REQUIRED",
            accounts,
        };
    }

    // Continue only after resolving the identity to one user.
    return authenticateSelectedUser({
        user,
        identity: normalizedIdentity,
        password,
        metadata,
    });
};

/**
 * Logs in using an account selected from the duplicate-mobile options.
 *
 * The selected email must belong to the submitted phone number.
 * A caller cannot use an arbitrary email to bypass account selection.
 */
export const loginWithSelectedPhoneAccount = async ({
    phone,
    email,
    password,
    ...metadata
}) => {
    const normalizedPhone =
        typeof phone === "string" ? phone.trim() : "";

    const normalizedEmail =
        typeof email === "string" ? email.trim().toLowerCase() : "";

    if (
        !normalizedPhone ||
        !normalizedEmail ||
        !normalizedEmail.includes("@") ||
        typeof password !== "string" ||
        !password
    ) {
        return {
            success: false,
            reason: "INVALID_INPUT",
        };
    }

    // Find the exact account using its unique email.
    const user = await findUserByIdentity(normalizedEmail);

    // A selected email must resolve to exactly one account and match
    // the phone number originally submitted by the user.
    if (
        !user ||
        user.multipleMatches ||
        !isEmailIdentity(user.email) ||
        user.email.toLowerCase() !== normalizedEmail ||
        user.phone !== normalizedPhone
    ) {
        await recordPasswordLoginAttempt({
            identity: normalizedPhone,
            status: "FAILED",
            failureReason: "INVALID_ACCOUNT_SELECTION",
            metadata,
        });

        await recordPasswordLoginAudit({
            action: "PASSWORD_LOGIN_FAILED",
            status: "FAILED",
            identity: normalizedPhone,
            reason: "INVALID_ACCOUNT_SELECTION",
            metadata,
        });

        return {
            success: false,
            reason: "INVALID_CREDENTIALS",
        };
    }

    // Password verification, account status checks, locking and session
    // creation now apply only to the selected account.
    return authenticateSelectedUser({
        user,
        identity: normalizedPhone,
        password,
        metadata,
    });
};