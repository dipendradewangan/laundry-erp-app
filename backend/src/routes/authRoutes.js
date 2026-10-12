/**
 * ============================================================
 * Laundry ERP - Authentication Routes
 * ============================================================
 *
 * File:
 *   src/routes/authRoutes.js
 *
 * Purpose:
 *   Authentication-related API routes register karna.
 *
 * Routes:
 *   POST /api/auth/register
 *   POST /api/auth/google
 *   POST /api/auth/login
 *   POST /api/auth/login/select-account
 * ============================================================
 */

import express from "express";

import {
  googleLogin,
} from "../controllers/auth/googleAuthController.js";

import {
  register,
} from "../controllers/auth/registrationController.js";

import {
  passwordLogin,
  selectPhoneLoginAccount,
} from "../controllers/auth/passwordAuthController.js";

import {
  loginSchema,
  selectPhoneAccountSchema,
} from "../validators/auth/loginValidator.js";

import {
  refreshToken
} from "../controllers/auth/refreshTokenController.js";

import {
  refreshTokenSchema
} from "../validators/auth/refreshTokenValidator.js"; 


import { logout } from "../controllers/auth/logoutController.js";

import {
    authenticationMiddleware,
} from "../middlewares/authenticationMiddleware.js";




const router = express.Router();


/**
 * ============================================================
 * Request Validation Middleware
 * ============================================================
 *
 * Purpose:
 *   Zod schema ke through incoming request body validate karna.
 *
 * Behaviour:
 *   1. Invalid request par HTTP 400 return hoga.
 *   2. Validation errors ke saath field aur message milega.
 *   3. Validated aur transformed data controller ko milega.
 */
const validateRequest = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    // Controller ko sirf validated data provide karna.
    req.body = result.data;

    next();
  };
};


/**
 * ============================================================
 * User Registration
 * ============================================================
 *
 * POST /api/auth/register
 *
 * Creates a new user account using email and password.
 * Phone number is optional and can be shared by users.
 */
router.post(
  "/register",
  register,
);


/**
 * ============================================================
 * Google Login
 * ============================================================
 *
 * POST /api/auth/google
 *
 * Existing Google authentication route.
 */
router.post(
  "/google",
  googleLogin,
);


/**
 * ============================================================
 * Password Login
 * ============================================================
 *
 * POST /api/auth/login
 *
 * Purpose:
 *   Email ya mobile number aur password ke through login karna.
 *
 * Behaviour:
 *   1. Request body Zod schema se validate hoga.
 *   2. Email unique hone par us account ko authenticate kiya jayega.
 *   3. Mobile number multiple accounts se linked hone par
 *      account selection ke options return honge.
 *   4. Successful authentication par session aur tokens milenge.
 */
router.post(
  "/login",
  validateRequest(loginSchema),
  passwordLogin,
);



// Refresh authentication tokens.
router.post(
  "/refresh",
  validateRequest(refreshTokenSchema),
  refreshToken
);




/**
 * ============================================================
 * Select Account for Mobile Login
 * ============================================================
 *
 * POST /api/auth/login/select-account
 *
 * Purpose:
 *   Jab ek mobile number multiple user accounts se linked ho,
 *   tab selected email aur password ke through login complete karna.
 *
 * Security:
 *   Selected email aur submitted mobile number ka relationship
 *   verify karne ke baad hi password authentication hogi.
 */
router.post(
  "/login/select-account",
  validateRequest(selectPhoneAccountSchema),
  selectPhoneLoginAccount,
);



/**
 * ============================================================
 * Logout
 * ============================================================
 *
 * POST /api/auth/logout
 *
 * Requires a valid access token.
 * Revokes only the current authenticated session.
 */
router.post(
    "/logout",
    authenticationMiddleware,
    logout,
);


export default router;