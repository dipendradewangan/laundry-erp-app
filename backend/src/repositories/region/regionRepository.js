// ============================================================
// Laundry ERP - Region Repository
// File: backend/src/repositories/region/regionRepository.js
//
// Purpose:
// - Execute parameterized SQL queries for master_region.
// - Handle region CRUD database operations.
// - Support pagination, status filtering, and soft deletion.
// ============================================================

import { randomUUID } from "node:crypto";
import { createDatabaseConnection } from "../../config/databaseConnection.js";

// ------------------------------------------------------------
// Create region
// ------------------------------------------------------------

export const createRegion = async (regionData) => {
    const connection = await createDatabaseConnection("laundry_core");

    try {
        const regionId = randomUUID();

        const sql = `
            INSERT INTO master_region (
                id,
                company_id,
                code,
                name,
                description
            )
            VALUES (?, ?, ?, ?, ?)
        `;

        const values = [
            regionId,
            regionData.company_id,
            regionData.code,
            regionData.name,
            regionData.description ?? null,
        ];

        await connection.execute(sql, values);

        // Return the newly created region.
        return findRegionById(regionId);
    } finally {
        // Always release the database connection.
        await connection.end();
    }
};

// ------------------------------------------------------------
// List regions with pagination
// ------------------------------------------------------------

export const findAllRegions = async ({
    companyId,
    page = 1,
    limit = 10,
    includeInactive = false,
} = {}) => {
    const connection = await createDatabaseConnection("laundry_core");

    try {
        const offset = (page - 1) * limit;

        // Exclude soft-deleted regions from normal results.
        const conditions = ["deleted_at IS NULL"];
        const values = [];

        // Optionally restrict the results to one company.
        if (companyId) {
            conditions.push("company_id = ?");
            values.push(companyId);
        }

        // By default, return active regions only.
        if (!includeInactive) {
            conditions.push("is_active = TRUE");
        }

        const whereClause = conditions.join(" AND ");

        const [regions] = await connection.execute(
            `
                SELECT
                    id,
                    company_id,
                    code,
                    name,
                    description,
                    is_active,
                    created_at,
                    updated_at
                FROM master_region
                WHERE ${whereClause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `,
            [...values, limit, offset]
        );

        // Retrieve the total number of matching records.
        const [[countResult]] = await connection.execute(
            `
                SELECT COUNT(*) AS total
                FROM master_region
                WHERE ${whereClause}
            `,
            values
        );

        const total = Number(countResult.total);

        return {
            data: regions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    } finally {
        await connection.end();
    }
};

// ------------------------------------------------------------
// Find region by ID
// ------------------------------------------------------------

export const findRegionById = async (regionId) => {
    const connection = await createDatabaseConnection("laundry_core");

    try {
        const [rows] = await connection.execute(
            `
                SELECT
                    id,
                    company_id,
                    code,
                    name,
                    description,
                    is_active,
                    created_at,
                    updated_at,
                    deleted_at
                FROM master_region
                WHERE id = ?
                  AND deleted_at IS NULL
                LIMIT 1
            `,
            [regionId]
        );

        return rows[0] ?? null;
    } finally {
        await connection.end();
    }
};

// ------------------------------------------------------------
// Update region
// ------------------------------------------------------------

export const updateRegion = async (regionId, regionData) => {
    // Only these fields can be updated through this repository.
    const allowedFields = [
        "company_id",
        "code",
        "name",
        "description",
    ];

    // Update only fields explicitly provided by the caller.
    const fields = allowedFields.filter((field) =>
        Object.prototype.hasOwnProperty.call(regionData, field)
    );

    // If no fields were supplied, return the current record.
    if (fields.length === 0) {
        return findRegionById(regionId);
    }

    const connection = await createDatabaseConnection("laundry_core");

    try {
        const assignments = fields
            .map((field) => `${field} = ?`)
            .join(", ");

        const values = fields.map((field) => regionData[field] ?? null);

        const [result] = await connection.execute(
            `
                UPDATE master_region
                SET ${assignments}
                WHERE id = ?
                  AND deleted_at IS NULL
            `,
            [...values, regionId]
        );

        if (result.affectedRows === 0) {
            return null;
        }

        // Fetch the updated record for the service layer.
        const [rows] = await connection.execute(
            `
                SELECT
                    id,
                    company_id,
                    code,
                    name,
                    description,
                    is_active,
                    created_at,
                    updated_at,
                    deleted_at
                FROM master_region
                WHERE id = ?
                  AND deleted_at IS NULL
                LIMIT 1
            `,
            [regionId]
        );

        return rows[0] ?? null;
    } finally {
        await connection.end();
    }
};

// ------------------------------------------------------------
// Activate or deactivate region
// ------------------------------------------------------------

export const updateRegionStatus = async (regionId, isActive) => {
    const connection = await createDatabaseConnection("laundry_core");

    try {
        const [result] = await connection.execute(
            `
                UPDATE master_region
                SET is_active = ?
                WHERE id = ?
                  AND deleted_at IS NULL
            `,
            [isActive, regionId]
        );

        if (result.affectedRows === 0) {
            return null;
        }

        const [rows] = await connection.execute(
            `
                SELECT
                    id,
                    company_id,
                    code,
                    name,
                    is_active,
                    updated_at
                FROM master_region
                WHERE id = ?
                  AND deleted_at IS NULL
                LIMIT 1
            `,
            [regionId]
        );

        return rows[0] ?? null;
    } finally {
        await connection.end();
    }
};

// ------------------------------------------------------------
// Soft-delete region
// ------------------------------------------------------------

export const softDeleteRegion = async (regionId) => {
    const connection = await createDatabaseConnection("laundry_core");

    try {
        const [result] = await connection.execute(
            `
                UPDATE master_region
                SET deleted_at = CURRENT_TIMESTAMP,
                    is_active = FALSE
                WHERE id = ?
                  AND deleted_at IS NULL
            `,
            [regionId]
        );

        // True means the record was soft-deleted successfully.
        return result.affectedRows > 0;
    } finally {
        await connection.end();
    }
};