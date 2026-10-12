// ============================================================
// Laundry ERP - Company Repository
// File: backend/src/repositories/company/companyRepository.js
// Purpose: Execute parameterized SQL queries for master_company.
// ============================================================

import { randomUUID } from "node:crypto";
import { createDatabaseConnection } from "../../config/databaseConnection.js";

// ------------------------------------------------------------
// Create company
// ------------------------------------------------------------

export const createCompany = async (companyData) => {
    const connection = await createDatabaseConnection("laundry_core");

    try {
        const companyId = randomUUID();

        const sql = `
      INSERT INTO master_company (
        id,
        code,
        name,
        legal_name,
        email,
        phone,
        website,
        tax_number
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

        const values = [
            companyId,
            companyData.code,
            companyData.name,
            companyData.legal_name ?? null,
            companyData.email ?? null,
            companyData.phone ?? null,
            companyData.website ?? null,
            companyData.tax_number ?? null,
        ];

        await connection.execute(sql, values);

        return findCompanyById(companyId);
    } finally {
        await connection.end();
    }
};

// ------------------------------------------------------------
// List companies with pagination
// ------------------------------------------------------------

export const findAllCompanies = async ({
    page = 1,
    limit = 10,
    includeInactive = false,
} = {}) => {
    const connection = await createDatabaseConnection("laundry_core");

    try {
        const offset = (page - 1) * limit;

        const conditions = ["deleted_at IS NULL"];
        const values = [];

        if (!includeInactive) {
            conditions.push("is_active = TRUE");
        }

        const whereClause = conditions.join(" AND ");

        const [companies] = await connection.execute(
            `
        SELECT
          id,
          code,
          name,
          legal_name,
          email,
          phone,
          website,
          tax_number,
          is_active,
          created_at,
          updated_at
        FROM master_company
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
            [...values, limit, offset]
        );

        const [[countResult]] = await connection.execute(
            `
        SELECT COUNT(*) AS total
        FROM master_company
        WHERE ${whereClause}
      `,
            values
        );

        return {
            data: companies,
            pagination: {
                page,
                limit,
                total: Number(countResult.total),
                totalPages: Math.ceil(Number(countResult.total) / limit),
            },
        };
    } finally {
        await connection.end();
    }
};

// ------------------------------------------------------------
// Find company by ID
// ------------------------------------------------------------

export const findCompanyById = async (companyId) => {
    const connection = await createDatabaseConnection("laundry_core");

    try {
        const [rows] = await connection.execute(
            `
        SELECT
          id,
          code,
          name,
          legal_name,
          email,
          phone,
          website,
          tax_number,
          is_active,
          created_at,
          updated_at,
          deleted_at
        FROM master_company
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
            [companyId]
        );

        return rows[0] ?? null;
    } finally {
        await connection.end();
    }
};

// ------------------------------------------------------------
// Update company
// ------------------------------------------------------------

export const updateCompany = async (companyId, companyData) => {
    const allowedFields = [
        "code",
        "name",
        "legal_name",
        "email",
        "phone",
        "website",
        "tax_number",
    ];

    const fields = allowedFields.filter((field) =>
        Object.prototype.hasOwnProperty.call(companyData, field)
    );

    if (fields.length === 0) {
        return findCompanyById(companyId);
    }

    const connection = await createDatabaseConnection("laundry_core");

    try {
        const assignments = fields.map((field) => `${field} = ?`).join(", ");
        const values = fields.map((field) => companyData[field] ?? null);

        const [result] = await connection.execute(
            `
        UPDATE master_company
        SET ${assignments}
        WHERE id = ?
          AND deleted_at IS NULL
      `,
            [...values, companyId]
        );

        if (result.affectedRows === 0) {
            return null;
        }

        const [rows] = await connection.execute(
            `
        SELECT
          id,
          code,
          name,
          legal_name,
          email,
          phone,
          website,
          tax_number,
          is_active,
          created_at,
          updated_at,
          deleted_at
        FROM master_company
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
            [companyId]
        );

        return rows[0] ?? null;
    } finally {
        await connection.end();
    }
};

// ------------------------------------------------------------
// Activate or deactivate company
// ------------------------------------------------------------

export const updateCompanyStatus = async (companyId, isActive) => {
    const connection = await createDatabaseConnection("laundry_core");

    try {
        const [result] = await connection.execute(
            `
        UPDATE master_company
        SET is_active = ?
        WHERE id = ?
          AND deleted_at IS NULL
      `,
            [isActive, companyId]
        );

        if (result.affectedRows === 0) {
            return null;
        }

        const [rows] = await connection.execute(
            `
        SELECT
          id,
          code,
          name,
          is_active,
          updated_at
        FROM master_company
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
            [companyId]
        );

        return rows[0] ?? null;
    } finally {
        await connection.end();
    }
};

// ------------------------------------------------------------
// Soft-delete company
// ------------------------------------------------------------

export const softDeleteCompany = async (companyId) => {
    const connection = await createDatabaseConnection("laundry_core");

    try {
        const [result] = await connection.execute(
            `
        UPDATE master_company
        SET deleted_at = CURRENT_TIMESTAMP,
            is_active = FALSE
        WHERE id = ?
          AND deleted_at IS NULL
      `,
            [companyId]
        );

        return result.affectedRows > 0;
    } finally {
        await connection.end();
    }
};