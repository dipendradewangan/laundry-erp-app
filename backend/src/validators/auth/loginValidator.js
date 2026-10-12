import { z } from "zod";

/**
 * Validates email/mobile and password for password login.
 */
export const loginSchema = z
    .object({
        identity: z
            .string()
            .trim()
            .min(1, "Email or mobile number is required.")
            .max(150, "Email or mobile number is too long."),

        password: z
            .string()
            .min(1, "Password is required.")
            .max(72, "Password is too long."),
    })
    .strict();

/**
 * Validates account selection when multiple accounts share a phone number.
 */
export const selectPhoneAccountSchema = z
    .object({
        phone: z
            .string()
            .trim()
            .min(1, "Mobile number is required.")
            .max(20, "Mobile number is too long."),

        email: z
            .string()
            .trim()
            .email("A valid account email is required.")
            .max(255, "Email must not exceed 255 characters.")
            .transform((value) => value.toLowerCase()),

        password: z
            .string()
            .min(1, "Password is required.")
            .max(72, "Password is too long."),
    })
    .strict();