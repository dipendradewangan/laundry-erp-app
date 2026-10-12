/**
 * ============================================================
 * Laundry ERP - Registration Validator
 * ============================================================
 *
 * File:
 *   src/validators/auth/registerValidator.js
 *
 * Purpose:
 *   Validate registration request using Zod.
 *
 * Business Rules:
 *   1. Email is mandatory and must be valid.
 *   2. Mobile number is optional.
 *   3. Duplicate mobile numbers are allowed.
 *   4. Username is not supported.
 *   5. Password must contain at least 8 characters.
 * ============================================================
 */

import { z } from "zod";

export const registerSchema = z
  .object({
    // Email is required and normalized to lowercase.
    email: z
      .string()
      .trim()
      .min(1, "Email is required.")
      .max(255, "Email must not exceed 255 characters.")
      .email("Please enter a valid email address.")
      .transform((value) => value.toLowerCase()),

    // Mobile is optional; multiple users may share it.
    phone: z
      .union([
        z.string().trim().max(
          20,
          "Mobile number must not exceed 20 characters."
        ),
        z.literal(""),
      ])
      .optional()
      .transform((value) => {
        if (!value) return null;

        if (!/^\+?[0-9]{7,15}$/.test(value)) {
          return undefined;
        }

        return value;
      }),

    // User's first name.
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required.")
      .max(100, "First name must not exceed 100 characters."),

    // Middle name is optional.
    middleName: z
      .string()
      .trim()
      .max(100, "Middle name must not exceed 100 characters.")
      .optional()
      .or(z.literal(""))
      .transform((value) => value || null),

    // User's last name.
    lastName: z
      .string()
      .trim()
      .min(1, "Last name is required.")
      .max(100, "Last name must not exceed 100 characters."),

    // bcrypt supports a maximum of 72 input bytes.
    password: z
      .string()
      .min(8, "Password must contain at least 8 characters.")
      .max(72, "Password must not exceed 72 characters.")
      .refine(
        (value) => Buffer.byteLength(value, "utf8") <= 72,
        "Password must not exceed 72 bytes."
      ),
  })
  .strict();