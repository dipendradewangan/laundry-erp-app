import {
    loginWithPassword,
    loginWithSelectedPhoneAccount,
} from "../../services/auth/passwordAuthService.js";

/**
 * POST /api/auth/login
 *
 * Email/mobile number aur password se login karta hai.
 * Agar mobile number multiple accounts se linked hai,
 * to account selection ke options return karta hai.
 */
export const passwordLogin = async (req, res, next) => {
    try {
        const { identity, password } = req.body;

        // Request metadata is collected for security audit and login tracking.
        const metadata = {
            ipAddress: req.ip ?? null,
            forwardedFor: req.headers["x-forwarded-for"] ?? null,
            userAgent: req.headers["user-agent"] ?? null,
            requestId: req.id ?? null,
            correlationId: req.headers["x-correlation-id"] ?? null,

            // These fields can be supplied by trusted frontend/device detection.
            deviceId: req.body.deviceId ?? null,
            deviceType: req.body.deviceType ?? null,
            deviceManufacturer: req.body.deviceManufacturer ?? null,
            deviceModel: req.body.deviceModel ?? null,

            operatingSystem: req.body.operatingSystem ?? null,
            operatingSystemVersion:
                req.body.operatingSystemVersion ?? null,

            browser: req.body.browser ?? null,
            browserVersion: req.body.browserVersion ?? null,

            screenWidth: req.body.screenWidth ?? null,
            screenHeight: req.body.screenHeight ?? null,
            devicePixelRatio: req.body.devicePixelRatio ?? null,

            latitude: req.body.latitude ?? null,
            longitude: req.body.longitude ?? null,
            locationAccuracy: req.body.locationAccuracy ?? null,
        };

        const result = await loginWithPassword({
            identity,
            password,
            ...metadata,
        });

        // Multiple accounts share this phone number.
        // The user must select the intended account before login.
        if (
            !result.success &&
            result.reason === "ACCOUNT_SELECTION_REQUIRED"
        ) {
            return res.status(200).json({
                success: false,
                code: "ACCOUNT_SELECTION_REQUIRED",
                message: "Multiple accounts use this mobile number. Select your account to continue.",
                accounts: result.accounts,
            });
        }

        if (!result.success) {
            const statusCodes = {
                INVALID_INPUT: 400,
                INVALID_CREDENTIALS: 401,
                ACCOUNT_INACTIVE: 403,
                LOGIN_DISABLED: 403,
                ACCOUNT_LOCKED: 423,
            };

            return res.status(statusCodes[result.reason] ?? 401).json({
                success: false,
                code: result.reason,
                message:
                    result.reason === "ACCOUNT_LOCKED"
                        ? "Your account is temporarily locked. Please try again later."
                        : result.reason === "ACCOUNT_INACTIVE"
                          ? "Your account is inactive."
                          : result.reason === "LOGIN_DISABLED"
                            ? "Login is disabled for your account."
                            : result.reason === "INVALID_INPUT"
                              ? "Identity and password are required."
                              : "Invalid email/mobile number or password.",
                ...(result.lockedUntil
                    ? { lockedUntil: result.lockedUntil }
                    : {}),
            });
        }

        // Login succeeded. Return tokens and the safe public user object.
        return res.status(200).json({
            success: true,
            message: "Login successful.",
            user: result.user,
            session: {
                sessionId: result.session.sessionId,
                expiresAt: result.session.expiresAt,
            },
            tokens: {
                accessToken: result.session.accessToken,
                refreshToken: result.session.refreshToken,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/login/select-account
 *
 * Completes login after the user selects an account associated
 * with the submitted mobile number.
 */
export const selectPhoneLoginAccount = async (req, res, next) => {
    try {
        const { phone, email, password } = req.body;

        const metadata = {
            ipAddress: req.ip ?? null,
            forwardedFor: req.headers["x-forwarded-for"] ?? null,
            userAgent: req.headers["user-agent"] ?? null,
            requestId: req.id ?? null,
            correlationId: req.headers["x-correlation-id"] ?? null,

            deviceId: req.body.deviceId ?? null,
            deviceType: req.body.deviceType ?? null,
            deviceManufacturer: req.body.deviceManufacturer ?? null,
            deviceModel: req.body.deviceModel ?? null,

            operatingSystem: req.body.operatingSystem ?? null,
            operatingSystemVersion:
                req.body.operatingSystemVersion ?? null,

            browser: req.body.browser ?? null,
            browserVersion: req.body.browserVersion ?? null,

            screenWidth: req.body.screenWidth ?? null,
            screenHeight: req.body.screenHeight ?? null,
            devicePixelRatio: req.body.devicePixelRatio ?? null,

            latitude: req.body.latitude ?? null,
            longitude: req.body.longitude ?? null,
            locationAccuracy: req.body.locationAccuracy ?? null,
        };

        const result = await loginWithSelectedPhoneAccount({
            phone,
            email,
            password,
            ...metadata,
        });

        if (!result.success) {
            const statusCodes = {
                INVALID_INPUT: 400,
                ACCOUNT_INACTIVE: 403,
                LOGIN_DISABLED: 403,
                ACCOUNT_LOCKED: 423,
            };

            return res.status(statusCodes[result.reason] ?? 401).json({
                success: false,
                code: result.reason,
                message:
                    result.reason === "ACCOUNT_LOCKED"
                        ? "Your account is temporarily locked. Please try again later."
                        : result.reason === "ACCOUNT_INACTIVE"
                          ? "Your account is inactive."
                          : result.reason === "LOGIN_DISABLED"
                            ? "Login is disabled for your account."
                            : result.reason === "INVALID_INPUT"
                              ? "Phone, selected email and password are required."
                              : "Invalid account selection or credentials.",
                ...(result.lockedUntil
                    ? { lockedUntil: result.lockedUntil }
                    : {}),
            });
        }

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            user: result.user,
            session: {
                sessionId: result.session.sessionId,
                expiresAt: result.session.expiresAt,
            },
            tokens: {
                accessToken: result.session.accessToken,
                refreshToken: result.session.refreshToken,
            },
        });
    } catch (error) {
        next(error);
    }
};