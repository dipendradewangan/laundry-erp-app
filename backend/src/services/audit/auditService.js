/**
 * ============================================================
 * Laundry ERP - Audit Service
 * ============================================================
 *
 * File:
 * -----
 * src/services/audit/auditService.js
 *
 * Purpose:
 * --------
 * Application ke different modules ke liye reusable
 * audit logging service provide karna.
 *
 * Responsibilities:
 * -----------------
 * 1. Audit event input validate karna.
 * 2. Audit repository ko call karna.
 * 3. Audit success/failure ko consistently handle karna.
 *
 * Used by:
 * --------
 * - Google registration
 * - Google login
 * - Password login
 * - Logout
 * - User management
 * - Role and permission management
 *
 * Security:
 * ---------
 * Passwords, access tokens, refresh tokens aur secrets ko
 * audit payload mein include nahi karna.
 * ============================================================
 */

import { createAuditLog } from "../../repositories/audit/auditRepository.js";

/**
 * Creates an audit event.
 *
 * @param {Object} auditData
 * @param {string} auditData.action
 * @param {string} auditData.module
 *
 * @returns {Promise<Object>}
 *
 * @throws {Error}
 * Audit record create nahi hone par error propagate hoga.
 */
export const recordAuditEvent = async (auditData) => {
  /**
   * Required audit fields validate karo.
   */
  if (!auditData || typeof auditData !== "object") {
    throw new Error("Audit event data is required.");
  }

  if (
    typeof auditData.action !== "string" ||
    !auditData.action.trim()
  ) {
    throw new Error("Audit event action is required.");
  }

  if (
    typeof auditData.module !== "string" ||
    !auditData.module.trim()
  ) {
    throw new Error("Audit event module is required.");
  }

  /**
   * Repository mein validated event pass karo.
   *
   * Repository database insertion aur connection handling
   * ki responsibility rakhta hai.
   */
  return createAuditLog(auditData);
};