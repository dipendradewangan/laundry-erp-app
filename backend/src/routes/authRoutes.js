/**
 * ============================================================
 * FILE: authRoutes.js
 * ============================================================
 */

import express from "express";

import {
  googleLogin,
} from "../controllers/auth/googleAuthController.js";


const router = express.Router();


/**
 * ============================================================
 * Google Login
 * ============================================================
 *
 * POST /api/auth/google
 */
router.post(
  "/google",
  googleLogin
);


export default router;