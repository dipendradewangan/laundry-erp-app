import { OAuth2Client } from "google-auth-library";

/**
 * Google OAuth client.
 *
 * GOOGLE_CLIENT_ID comes from the Google Cloud project.
 */
export const googleOAuthClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);