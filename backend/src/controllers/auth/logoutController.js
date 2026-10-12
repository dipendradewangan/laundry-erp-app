/**
 * ============================================================
 * Laundry ERP - Logout Controller
 * ============================================================
 *
 * File:
 *   src/controllers/auth/logoutController.js
 *
 * Purpose:
 *   Current authenticated session ko revoke karna.
 *
 * Security:
 *   Authentication middleware se verified session ID hi use hogi.
 *   Client se session ID accept nahi ki jayegi.
 * ============================================================
 */

import { revokeSession } from "../../repositories/auth/sessionRepository.js";

/**
 * Logout the current authenticated session.
 */
export const logout = async (req, res, next) => {
    try {
        await revokeSession({
            sessionId: req.user.sessionId,
            revokeReason: "USER_LOGOUT",
        });

        return res.status(200).json({
            success: true,
            message: "Logged out successfully.",
        });
    } catch (error) {
        return next(error);
    }
};