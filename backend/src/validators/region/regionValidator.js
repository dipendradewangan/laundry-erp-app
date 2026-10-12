// ============================================================
// Laundry ERP - Region Validator
// File: backend/src/validators/region/regionValidator.js
//
// Purpose:
// - Validate region creation requests.
// - Validate partial region updates.
// - Validate region UUIDs.
// - Validate region activation/deactivation requests.
// - Reject unexpected request fields using strict schemas.
// ============================================================

import { z } from "zod";

// ------------------------------------------------------------
// Company ID validation
// ------------------------------------------------------------

// Every region must belong to a company.
// The company ID must be a valid UUID.
const companyIdSchema = z
    .string()
    .uuid("Invalid company ID. A valid UUID is required.");

// ------------------------------------------------------------
// Region code validation
// ------------------------------------------------------------

// Region code is trimmed and converted to uppercase.
// Examples: CG, MH, MP.
const regionCodeSchema = z
    .string()
    .trim()
    .min(1, "Region code is required.")
    .max(50, "Region code cannot exceed 50 characters.")
    .transform((value) => value.toUpperCase());

// ------------------------------------------------------------
// Region name validation
// ------------------------------------------------------------

// Region name cannot be empty.
const regionNameSchema = z
    .string()
    .trim()
    .min(1, "Region name is required.")
    .max(150, "Region name cannot exceed 150 characters.");

// ------------------------------------------------------------
// Optional description validation
// ------------------------------------------------------------

// Description can be omitted, NULL, or an empty string.
// Empty strings are normalized to NULL.
const optionalDescriptionSchema = z
    .string()
    .trim()
    .max(500, "Region description cannot exceed 500 characters.")
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

// ------------------------------------------------------------
// Create region schema
// ------------------------------------------------------------

// Required fields:
// - company_id
// - code
// - name
//
// Description is optional.
export const createRegionSchema = z
    .object({
        company_id: companyIdSchema,
        code: regionCodeSchema,
        name: regionNameSchema,
        description: optionalDescriptionSchema,
    })
    .strict();

// ------------------------------------------------------------
// Update region schema
// ------------------------------------------------------------

// All fields are optional because partial updates are supported.
// Omitted fields must remain unchanged in the database.
export const updateRegionSchema = z
    .object({
        company_id: companyIdSchema.optional(),
        code: regionCodeSchema.optional(),
        name: regionNameSchema.optional(),
        description: optionalDescriptionSchema,
    })
    .strict()
    .refine(
        (data) => Object.keys(data).length > 0,
        {
            message: "At least one field is required for an update.",
        }
    );

// ------------------------------------------------------------
// Region ID validation
// ------------------------------------------------------------

// Validate the region ID received through URL parameters.
export const regionIdSchema = z
    .string()
    .uuid("Invalid region ID. A valid UUID is required.");

// ------------------------------------------------------------
// Update region status schema
// ------------------------------------------------------------

// Only boolean values are accepted.
// Valid examples: true, false.
export const updateRegionStatusSchema = z
    .object({
        is_active: z.boolean({
            error: "is_active must be true or false.",
        }),
    })
    .strict();