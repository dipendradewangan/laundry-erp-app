// ============================================================
// Laundry ERP - Region Controller
// File: backend/src/controllers/region/regionController.js
//
// Purpose:
// - Handle HTTP requests for region operations.
// - Validate request data using Zod.
// - Call the region service.
// - Return standardized JSON responses.
// - Forward errors to centralized error middleware.
// ============================================================

import {
    createRegionSchema,
    updateRegionSchema,
    regionIdSchema,
    updateRegionStatusSchema,
} from "../../validators/region/regionValidator.js";

import {
    createRegion as createRegionService,
    getAllRegions as getAllRegionsService,
    getRegionById as getRegionByIdService,
    updateRegion as updateRegionService,
    updateRegionStatus as updateRegionStatusService,
    deleteRegion as deleteRegionService,
} from "../../services/region/regionService.js";

// ------------------------------------------------------------
// Common validation helper
// ------------------------------------------------------------

// Validate data using a Zod schema.
// If validation fails, forward a readable error to middleware.
const validateRequest = (schema, data) => {
    const result = schema.safeParse(data);

    if (!result.success) {
        const error = new Error(
            result.error.issues
                .map((issue) => issue.message)
                .join(", ")
        );

        error.statusCode = 400;
        throw error;
    }

    return result.data;
};

// ------------------------------------------------------------
// Create region
// POST /api/regions
// ------------------------------------------------------------

export const createRegion = async (req, res, next) => {
    try {
        const regionData = validateRequest(
            createRegionSchema,
            req.body
        );

        const region = await createRegionService(regionData);

        return res.status(201).json({
            success: true,
            message: "Region created successfully.",
            data: region,
        });
    } catch (error) {
        return next(error);
    }
};

// ------------------------------------------------------------
// List regions
// GET /api/regions
// ------------------------------------------------------------

export const getAllRegions = async (req, res, next) => {
    try {
        // Parse and validate pagination parameters.
        const page = Number(req.query.page ?? 1);
        const limit = Number(req.query.limit ?? 10);

        if (
            !Number.isInteger(page) ||
            page < 1 ||
            !Number.isInteger(limit) ||
            limit < 1 ||
            limit > 100
        ) {
            const error = new Error(
                "Page must be a positive integer and limit must be between 1 and 100."
            );

            error.statusCode = 400;
            throw error;
        }

        // Validate an optional company UUID.
        let companyId;

        if (req.query.companyId !== undefined) {
            companyId = validateRequest(
                regionIdSchema,
                req.query.companyId
            );
        }

        // Accept only true or false for includeInactive.
        let includeInactive = false;

        if (req.query.includeInactive !== undefined) {
            if (req.query.includeInactive === "true") {
                includeInactive = true;
            } else if (req.query.includeInactive !== "false") {
                const error = new Error(
                    "includeInactive must be true or false."
                );

                error.statusCode = 400;
                throw error;
            }
        }

        const result = await getAllRegionsService({
            companyId,
            page,
            limit,
            includeInactive,
        });

        return res.status(200).json({
            success: true,
            message: "Regions retrieved successfully.",
            ...result,
        });
    } catch (error) {
        return next(error);
    }
};

// ------------------------------------------------------------
// Get region by ID
// GET /api/regions/:id
// ------------------------------------------------------------

export const getRegionById = async (req, res, next) => {
    try {
        const regionId = validateRequest(
            regionIdSchema,
            req.params.id
        );

        const region = await getRegionByIdService(regionId);

        return res.status(200).json({
            success: true,
            message: "Region retrieved successfully.",
            data: region,
        });
    } catch (error) {
        return next(error);
    }
};

// ------------------------------------------------------------
// Update region
// PUT /api/regions/:id
// ------------------------------------------------------------

export const updateRegion = async (req, res, next) => {
    try {
        const regionId = validateRequest(
            regionIdSchema,
            req.params.id
        );

        const regionData = validateRequest(
            updateRegionSchema,
            req.body
        );

        const region = await updateRegionService(
            regionId,
            regionData
        );

        return res.status(200).json({
            success: true,
            message: "Region updated successfully.",
            data: region,
        });
    } catch (error) {
        return next(error);
    }
};

// ------------------------------------------------------------
// Activate / deactivate region
// PATCH /api/regions/:id/status
// ------------------------------------------------------------

export const updateRegionStatus = async (req, res, next) => {
    try {
        const regionId = validateRequest(
            regionIdSchema,
            req.params.id
        );

        const statusData = validateRequest(
            updateRegionStatusSchema,
            req.body
        );

        const region = await updateRegionStatusService(
            regionId,
            statusData.is_active
        );

        return res.status(200).json({
            success: true,
            message: "Region status updated successfully.",
            data: region,
        });
    } catch (error) {
        return next(error);
    }
};

// ------------------------------------------------------------
// Soft-delete region
// DELETE /api/regions/:id
// ------------------------------------------------------------

export const deleteRegion = async (req, res, next) => {
    try {
        const regionId = validateRequest(
            regionIdSchema,
            req.params.id
        );

        const result = await deleteRegionService(regionId);

        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                id: result.id,
            },
        });
    } catch (error) {
        return next(error);
    }
};