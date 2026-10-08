import { z } from "zod";

/**
 * Login validation schema.
 *
 * The user can log in using:
 *   1. Email address
 *   2. Mobile/phone number
 *
 * We intentionally keep both inside a single `identity` field
 * so the frontend only needs one login input.
 */
export const loginSchema = z.object({
    identity: z
        .string()
        .trim()
        .min(1, "Email or mobile number is required")
        .max(150, "Email or mobile number is too long"),

    password: z
        .string()
        .min(1, "Password is required")
        .max(255, "Password is too long"),
});