// ============================================================
// Laundry ERP - Region Service
// File: backend/src/services/region/regionService.js
//
// Purpose:
// - Apply region business rules.
// - Coordinate region repository operations.
// - Validate parent company availability.
// - Record region operations in the centralized audit system.
// ============================================================

import {
    createRegion as createRegionRecord,
    findAllRegions as findAllRegionRecords,
    findRegionById as findRegionRecordById,
    updateRegion as updateRegionRecord,
    updateRegionStatus as updateRegionStatusRecord,
    softDeleteRegion as softDeleteRegionRecord,
} from "../../repositories/region/regionRepository.js";

import {
    findCompanyById,
} from "../../repositories/company/companyRepository.js";

import {
    recordAuditEvent,
} from "../../services/audit/auditService.js";

// ------------------------------------------------------------
// Error helper
// ------------------------------------------------------------

// Creates an application error with an HTTP status code.
const createServiceError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

// ------------------------------------------------------------
// Validate parent company
// ------------------------------------------------------------

// A region must belong to an existing, active company.
// Soft-deleted companies are not considered valid parents.
const validateActiveCompany = async (companyId) => {
    const company = await findCompanyById(companyId);

    if (!company) {
        throw createServiceError("Company not found.", 404);
    }

    if (!company.is_active) {
        throw createServiceError(
            "Cannot create or assign a region to an inactive company.",
            409
        );
    }

    return company;
};

// ------------------------------------------------------------
// Audit helper
// ------------------------------------------------------------

// Uses camelCase property names expected by auditRepository.js.
const recordRegionAudit = async ({
    action,
    entityId,
    companyId = null,
    oldValues = null,
    newValues = null,
    status = "SUCCESS",
    failureReason = null,
}) => {
    await recordAuditEvent({
        action,
        module: "REGION",
        entity: "master_region",
        entityId,
        companyId,
        oldValues,
        newValues,
        status,
        failureReason,
    });
};

// ------------------------------------------------------------
// Create region
// ------------------------------------------------------------

export const createRegion = async (regionData) => {
    // Verify that the parent company exists and is active.
    await validateActiveCompany(regionData.company_id);

    // Create the region record.
    const region = await createRegionRecord(regionData);

    // Record the successful creation in the audit database.
    await recordRegionAudit({
        action: "CREATE",
        entityId: region.id,
        companyId: region.company_id,
        newValues: region,
    });

    return region;
};

// ------------------------------------------------------------
// List regions
// ------------------------------------------------------------

export const getAllRegions = async (paginationOptions) => {
    // Filtering and pagination are handled by the repository.
    return findAllRegionRecords(paginationOptions);
};

// ------------------------------------------------------------
// Get region by ID
// ------------------------------------------------------------

export const getRegionById = async (regionId) => {
    const region = await findRegionRecordById(regionId);

    if (!region) {
        throw createServiceError("Region not found.", 404);
    }

    return region;
};

// ------------------------------------------------------------
// Update region
// ------------------------------------------------------------

export const updateRegion = async (regionId, regionData) => {
    // Fetch the current record for validation and audit history.
    const existingRegion = await findRegionRecordById(regionId);

    if (!existingRegion) {
        throw createServiceError("Region not found.", 404);
    }

    // If company_id changes, or a company_id is supplied,
    // validate that the destination company is active.
    if (Object.prototype.hasOwnProperty.call(regionData, "company_id")) {
        await validateActiveCompany(regionData.company_id);
    }

    const updatedRegion = await updateRegionRecord(regionId, regionData);

    if (!updatedRegion) {
        throw createServiceError("Region could not be updated.", 404);
    }

    await recordRegionAudit({
        action: "UPDATE",
        entityId: regionId,
        companyId: updatedRegion.company_id,
        oldValues: existingRegion,
        newValues: updatedRegion,
    });

    return updatedRegion;
};

// ------------------------------------------------------------
// Activate or deactivate region
// ------------------------------------------------------------

export const updateRegionStatus = async (regionId, isActive) => {
    const existingRegion = await findRegionRecordById(regionId);

    if (!existingRegion) {
        throw createServiceError("Region not found.", 404);
    }

    // Do not activate a region if its company is inactive.
    if (isActive) {
        await validateActiveCompany(existingRegion.company_id);
    }

    const updatedRegion = await updateRegionStatusRecord(
        regionId,
        isActive
    );

    if (!updatedRegion) {
        throw createServiceError(
            "Region status could not be updated.",
            404
        );
    }

    await recordRegionAudit({
        action: "UPDATE",
        entityId: regionId,
        companyId: updatedRegion.company_id,
        oldValues: {
            is_active: existingRegion.is_active,
        },
        newValues: {
            is_active: updatedRegion.is_active,
        },
    });

    return updatedRegion;
};

// ------------------------------------------------------------
// Soft-delete region
// ------------------------------------------------------------

export const deleteRegion = async (regionId) => {
    const existingRegion = await findRegionRecordById(regionId);

    if (!existingRegion) {
        throw createServiceError("Region not found.", 404);
    }

    const deleted = await softDeleteRegionRecord(regionId);

    if (!deleted) {
        throw createServiceError("Region could not be deleted.", 404);
    }

    await recordRegionAudit({
        action: "DELETE",
        entityId: regionId,
        companyId: existingRegion.company_id,
        oldValues: existingRegion,
        newValues: {
            is_active: false,
            deleted_at: new Date().toISOString(),
        },
    });

    return {
        id: regionId,
        message: "Region soft-deleted successfully.",
    };
};