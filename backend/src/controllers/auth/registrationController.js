/**
 * ============================================================
 * Laundry ERP - Registration Controller
 * ============================================================
 *
 * File:
 *   src/controllers/auth/registrationController.js
 *
 * Purpose:
 *   HTTP registration requests handle karna.
 *
 * Responsibilities:
 *   1. Request validation.
 *   2. Request metadata collect karna.
 *   3. Registration service call karna.
 *   4. Consistent HTTP responses return karna.
 *
 * Business logic service layer mein rahega.
 * ============================================================
 */

import { registerSchema } from "../../validators/auth/registerValidator.js";

import {
  registerUser,
} from "../../services/auth/registrationService.js";


/**
 * ============================================================
 * POST /api/auth/register
 * ============================================================
 *
 * Expected request body:
 *
 * {
 *   "email": "user@example.com",
 *   "phone": "9876543210",
 *   "firstName": "Dipendra",
 *   "middleName": "",
 *   "lastName": "Dewangan",
 *   "password": "StrongPassword123"
 * }
 *
 * Phone and middleName are optional.
 */
export const register = async (req, res) => {
  try {
    // --------------------------------------------------------
    // STEP 1: Validate request body.
    // --------------------------------------------------------

    const validationResult = registerSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        reason: "VALIDATION_ERROR",
        errors: validationResult.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const {
      email,
      phone,
      firstName,
      middleName,
      lastName,
      password,
    } = validationResult.data;

    // --------------------------------------------------------
    // STEP 2: Collect safe request metadata.
    // --------------------------------------------------------

    const requestMetadata = {
      requestId: req.requestId || req.headers["x-request-id"] || null,

      correlationId:
        req.headers["x-correlation-id"] || null,

      ipAddress: req.ip || null,

      forwardedFor:
        req.headers["x-forwarded-for"] || null,

      userAgent:
        req.headers["user-agent"] || null,
    };

    // --------------------------------------------------------
    // STEP 3: Register user.
    // --------------------------------------------------------

    const result = await registerUser({
      email,
      phone,
      firstName,
      middleName,
      lastName,
      password,
      requestMetadata,
    });

    // --------------------------------------------------------
    // STEP 4: Handle duplicate email.
    // --------------------------------------------------------

    if (!result.success) {
      if (result.reason === "EMAIL_ALREADY_REGISTERED") {
        return res.status(409).json({
          success: false,
          reason: "EMAIL_ALREADY_REGISTERED",
          message: "This email address is already registered.",
        });
      }

      return res.status(400).json({
        success: false,
        reason: result.reason || "REGISTRATION_FAILED",
        message: "Registration could not be completed.",
      });
    }

    // --------------------------------------------------------
    // STEP 5: Return successful response.
    // --------------------------------------------------------

    return res.status(201).json({
      success: true,
      message: "Registration successful.",
      user: result.user,
    });

  } catch (error) {
    // --------------------------------------------------------
    // STEP 6: Handle unexpected errors.
    // --------------------------------------------------------

    console.error(
      "Registration controller error:",
      error.message,
    );

    return res.status(500).json({
      success: false,
      reason: "REGISTRATION_FAILED",
      message: "Registration could not be completed.",
    });
  }
};