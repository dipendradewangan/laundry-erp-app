// ============================================================
// Laundry ERP - Company Validator
// File: backend/src/validators/company/companyValidator.js
//
// Purpose:
// Validate Company Master API request data using Zod.
// ============================================================

import { z } from "zod";

// ------------------------------------------------------------
// Company code validation
// ------------------------------------------------------------

const companyCodeSchema = z
  .string()
  .trim()
  .min(1, "Company code is required.")
  .max(50, "Company code cannot exceed 50 characters.")
  .transform((value) => value.toUpperCase());

// ------------------------------------------------------------
// Company name validation
// ------------------------------------------------------------

const companyNameSchema = z
  .string()
  .trim()
  .min(1, "Company name is required.")
  .max(150, "Company name cannot exceed 150 characters.");

// ------------------------------------------------------------
// Optional text validation
// ------------------------------------------------------------

// Empty string becomes null.
// If the field is omitted, it remains undefined.
// This is important for partial updates.
const optionalText = (maxLength, fieldName) =>
  z
    .string()
    .trim()
    .max(maxLength, `${fieldName} cannot exceed ${maxLength} characters.`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

// ------------------------------------------------------------
// Optional email validation
// ------------------------------------------------------------

// Omitted email remains undefined.
// Empty string or null explicitly clears the email.
const optionalEmail = z
  .union([
    z
      .string()
      .trim()
      .email("Please provide a valid email address.")
      .transform((value) => value),
    z.literal("").transform(() => null),
    z.null(),
  ])
  .optional();

// ------------------------------------------------------------
// Optional website validation
// ------------------------------------------------------------

// Omitted website remains undefined.
// Empty string or null explicitly clears the website.
const optionalWebsite = z
  .union([
    z
      .string()
      .trim()
      .url("Please provide a valid website URL.")
      .transform((value) => value),
    z.literal("").transform(() => null),
    z.null(),
  ])
  .optional();

// ------------------------------------------------------------
// Create company schema
// ------------------------------------------------------------

export const createCompanySchema = z
  .object({
    code: companyCodeSchema,

    name: companyNameSchema,

    legal_name: optionalText(250, "Legal name"),

    email: optionalEmail,

    phone: optionalText(30, "Phone number"),

    website: optionalWebsite,

    tax_number: optionalText(50, "Tax number"),
  })
  .strict();

// ------------------------------------------------------------
// Update company schema
// ------------------------------------------------------------

// Only fields supplied in the request should be updated.
// Omitted fields remain undefined and must not be written
// to the database.
export const updateCompanySchema = z
  .object({
    code: companyCodeSchema.optional(),

    name: companyNameSchema.optional(),

    legal_name: optionalText(250, "Legal name"),

    email: optionalEmail,

    phone: optionalText(30, "Phone number"),

    website: optionalWebsite,

    tax_number: optionalText(50, "Tax number"),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required for an update.",
  });

// ------------------------------------------------------------
// Company ID schema
// ------------------------------------------------------------

export const companyIdSchema = z
  .string()
  .uuid("Invalid company ID. A valid UUID is required.");

// ------------------------------------------------------------
// Company status schema
// ------------------------------------------------------------

export const updateCompanyStatusSchema = z
  .object({
    is_active: z.boolean({
      error: "is_active must be true or false.",
    }),
  })
  .strict();