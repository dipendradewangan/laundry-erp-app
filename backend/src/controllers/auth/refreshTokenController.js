import { refreshAuthSession } from "../../services/auth/authSessionService.js";

/**
 * Refresh authentication tokens.
 *
 * Accepts a refresh token and returns a new access token
 * along with a rotated refresh token.
 */
export const refreshToken = async (req, res, next) => {
  try {
    const result = await refreshAuthSession({
      refreshToken: req.body.refreshToken,
    });

    if (!result.success) {
      return res.status(401).json({
        success: false,
        code: result.code,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Authentication tokens refreshed successfully.",
      session: {
        sessionId: result.sessionId,
        expiresAt: result.expiresAt,
      },
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};