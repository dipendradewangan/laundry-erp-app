// ============================================================
// Laundry ERP - Region Routes
// File: backend/src/routes/regionRoutes.js
//
// Purpose:
// - Define HTTP endpoints for region operations.
// - Connect routes with region controller functions.
// ============================================================

import { Router } from "express";

import {
    createRegion,
    getAllRegions,
    getRegionById,
    updateRegion,
    updateRegionStatus,
    deleteRegion,
} from "../controllers/region/regionController.js";

const router = Router();

// ------------------------------------------------------------
// Region CRUD routes
// ------------------------------------------------------------

// Create a new region.
router.post("/", createRegion);

// Retrieve regions with pagination and optional filters.
router.get("/", getAllRegions);

// Activate or deactivate a region.
// Keep this route before GET /:id for clarity.
router.patch("/:id/status", updateRegionStatus);

// Retrieve a specific region.
router.get("/:id", getRegionById);

// Update a region.
router.put("/:id", updateRegion);

// Soft-delete a region.
router.delete("/:id", deleteRegion);

export default router;