/**
 * ============================================================
 * Laundry ERP - Centralized Error Codes
 * ============================================================
 *
 * Purpose:
 * --------
 * Application ke errors ke liye standardized error codes
 * maintain karna.
 *
 * Benefits:
 * ---------
 * 1. Consistent error codes across modules.
 * 2. Easy frontend error handling.
 * 3. Avoid duplicate string literals.
 * 4. Easier logging and debugging.
 *
 * IMPORTANT:
 * ----------
 * Error codes stable aur unique hone chahiye.
 * Naye modules ke liye naye codes add karna.
 * ============================================================
 */

export const ERROR_CODES = Object.freeze({
  // ==========================================================
  // GENERAL ERRORS
  // ==========================================================

  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",

  VALIDATION_ERROR: "VALIDATION_ERROR",

  INVALID_REQUEST: "INVALID_REQUEST",

  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",

  ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND",

  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",

  DUPLICATE_RESOURCE: "DUPLICATE_RESOURCE",

  BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",

  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",

  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // ==========================================================
  // AUTHENTICATION ERRORS
  // ==========================================================

  AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED",

  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",

  INVALID_TOKEN: "INVALID_TOKEN",

  TOKEN_EXPIRED: "TOKEN_EXPIRED",

  REFRESH_TOKEN_INVALID: "REFRESH_TOKEN_INVALID",

  SESSION_EXPIRED: "SESSION_EXPIRED",

  SESSION_REVOKED: "SESSION_REVOKED",

  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",

  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",

  EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS",

  PHONE_ALREADY_EXISTS: "PHONE_ALREADY_EXISTS",

  PASSWORD_RESET_TOKEN_INVALID: "PASSWORD_RESET_TOKEN_INVALID",

  PASSWORD_RESET_TOKEN_EXPIRED: "PASSWORD_RESET_TOKEN_EXPIRED",

  PASSWORD_POLICY_VIOLATION: "PASSWORD_POLICY_VIOLATION",

  GOOGLE_AUTHENTICATION_FAILED: "GOOGLE_AUTHENTICATION_FAILED",

  // ==========================================================
  // AUTHORIZATION ERRORS
  // ==========================================================

  UNAUTHORIZED: "UNAUTHORIZED",

  FORBIDDEN: "FORBIDDEN",

  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",

  ROLE_NOT_FOUND: "ROLE_NOT_FOUND",

  PERMISSION_NOT_FOUND: "PERMISSION_NOT_FOUND",

  // ==========================================================
  // ORGANIZATION MASTER ERRORS
  // ==========================================================

  COMPANY_NOT_FOUND: "COMPANY_NOT_FOUND",

  COMPANY_CODE_ALREADY_EXISTS: "COMPANY_CODE_ALREADY_EXISTS",

  REGION_NOT_FOUND: "REGION_NOT_FOUND",

  REGION_CODE_ALREADY_EXISTS: "REGION_CODE_ALREADY_EXISTS",

  ZONE_NOT_FOUND: "ZONE_NOT_FOUND",

  ZONE_CODE_ALREADY_EXISTS: "ZONE_CODE_ALREADY_EXISTS",

  BRANCH_NOT_FOUND: "BRANCH_NOT_FOUND",

  BRANCH_CODE_ALREADY_EXISTS: "BRANCH_CODE_ALREADY_EXISTS",

  DEPARTMENT_NOT_FOUND: "DEPARTMENT_NOT_FOUND",

  DEPARTMENT_CODE_ALREADY_EXISTS: "DEPARTMENT_CODE_ALREADY_EXISTS",

  // ==========================================================
  // DATABASE ERRORS
  // ==========================================================

  DATABASE_CONNECTION_FAILED: "DATABASE_CONNECTION_FAILED",

  DATABASE_QUERY_FAILED: "DATABASE_QUERY_FAILED",

  DATABASE_CONSTRAINT_VIOLATION: "DATABASE_CONSTRAINT_VIOLATION",

  DATABASE_INITIALIZATION_FAILED: "DATABASE_INITIALIZATION_FAILED",

  DATABASE_MIGRATION_FAILED: "DATABASE_MIGRATION_FAILED",

  // ==========================================================
  // AUDIT ERRORS
  // ==========================================================

  AUDIT_LOG_WRITE_FAILED: "AUDIT_LOG_WRITE_FAILED",
});