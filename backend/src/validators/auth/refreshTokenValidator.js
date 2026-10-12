import { z } from "zod";

/**
 * Validate refresh-token requests.
 *
 * Our refresh tokens are generated as 128 hexadecimal
 * characters using crypto.randomBytes(64).toString("hex").
 */
export const refreshTokenSchema = z
  .object({
    refreshToken: z
      .string()
      .regex(/^[a-f0-9]{128}$/i, "Invalid refresh token format."),
  })
  .strict();