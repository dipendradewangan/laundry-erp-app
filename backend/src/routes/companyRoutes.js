/**
 * ============================================================
 * Laundry ERP - Company Routes
 * ============================================================
 *
 * File:
 *   backend/src/routes/companyRoutes.js
 *
 * Purpose:
 *   Company Master management API endpoints.
 *
 * Security:
 *   All company routes require a valid access token.
 * ============================================================
 */

import { Router } from "express";

import {
    createCompany,
    getAllCompanies,
    getCompanyById,
    updateCompany,
    updateCompanyStatus,
    deleteCompany,
} from "../controllers/company/companyController.js";

// Authentication middleware.
import {
    authenticationMiddleware,
} from "../middlewares/authenticationMiddleware.js";


const router = Router();


/**
 * ============================================================
 * Authentication Protection
 * ============================================================
 *
 * All routes defined below this middleware require:
 *
 * Authorization: Bearer <access_token>
 *
 * The middleware verifies:
 * 1. JWT signature and expiry.
 * 2. Active authentication session.
 * 3. Current user account status.
 *
 * Unauthenticated requests will be rejected.
 */
router.use(authenticationMiddleware);


/**
 * ============================================================
 * Company Master API Endpoints
 * ============================================================
 */

// Create a new company.
router.post("/", createCompany);

// Get all companies with pagination.
router.get("/", getAllCompanies);

// Activate or deactivate a company.
router.patch("/:id/status", updateCompanyStatus);

// Get one company by UUID.
router.get("/:id", getCompanyById);

// Update company details.
router.put("/:id", updateCompany);

// Soft-delete a company.
router.delete("/:id", deleteCompany);


export default router;