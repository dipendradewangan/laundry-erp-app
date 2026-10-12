/**
 * ============================================================
 * Laundry ERP - Audit Repository
 * ============================================================
 *
 * File:
 *   src/repositories/audit/auditRepository.js
 *
 * Purpose:
 *   Centralized audit events ko laundry_audit database ke
 *   audit_log table mein insert karna.
 *
 * Responsibilities:
 *   1. Audit database connection create karna.
 *   2. Audit event ke liye UUID generate karna.
 *   3. Actor aur action ki details insert karna.
 *   4. Request, organization, device aur network metadata
 *      store karna.
 *   5. Database connection ko safely close karna.
 *
 * Security:
 *   - SQL queries parameterized hain.
 *   - Passwords, password hashes aur raw tokens ko audit
 *     payload mein store nahi karna hai.
 *   - Audit records ko application repository se update
 *     ya delete nahi kiya jayega.
 * ============================================================
 */

import { randomUUID } from "node:crypto";

import {
  createDatabaseConnection,
} from "../../config/databaseConnection.js";

// ------------------------------------------------------------
// Database configuration
// ------------------------------------------------------------

const AUDIT_DATABASE_NAME = "laundry_audit";
const AUDIT_TABLE_NAME = "audit_log";

/**
 * Insert one audit event.
 *
 * @param {Object} auditData
 * @param {string} auditData.action
 * @param {string} auditData.module
 * @param {string|null} auditData.userId
 * @param {string|null} auditData.actorName
 *
 * @returns {Promise<Object>}
 */
export const createAuditLog = async (auditData) => {
  // ----------------------------------------------------------
  // 1. Validate required input
  // ----------------------------------------------------------

  if (
    !auditData ||
    typeof auditData.action !== "string" ||
    !auditData.action.trim() ||
    typeof auditData.module !== "string" ||
    !auditData.module.trim()
  ) {
    throw new Error(
      "Audit validation failed: action and module are required.",
    );
  }

  // ----------------------------------------------------------
  // 2. Generate audit UUID
  // ----------------------------------------------------------

  const auditId = randomUUID();

  // ----------------------------------------------------------
  // 3. Prepare audit values
  //
  // actorName:
  //   Event perform karne wale actor ka naam.
  //
  // userId:
  //   Actor ki authoritative user UUID.
  //
  // entityId:
  //   Affected record ki UUID.
  //
  // userId aur entityId ka purpose alag hai.
  // ----------------------------------------------------------

  const values = {
    id: auditId,

    request_id: auditData.requestId ?? null,
    correlation_id: auditData.correlationId ?? null,
    session_id: auditData.sessionId ?? null,

    user_id: auditData.userId ?? null,
    actor_name: auditData.actorName ?? null,
    attempted_identity: auditData.attemptedIdentity ?? null,

    company_id: auditData.companyId ?? null,
    region_id: auditData.regionId ?? null,
    zone_id: auditData.zoneId ?? null,
    branch_id: auditData.branchId ?? null,
    department_id: auditData.departmentId ?? null,

    action: auditData.action.trim(),
    module: auditData.module.trim(),
    entity: auditData.entity ?? null,
    entity_id: auditData.entityId ?? null,

    // Sensitive information must never be included here.
    old_values:
      auditData.oldValues == null
        ? null
        : JSON.stringify(auditData.oldValues),

    new_values:
      auditData.newValues == null
        ? null
        : JSON.stringify(auditData.newValues),

    device_id: auditData.deviceId ?? null,
    device_type: auditData.deviceType ?? null,
    device_manufacturer: auditData.deviceManufacturer ?? null,
    device_model: auditData.deviceModel ?? null,

    operating_system: auditData.operatingSystem ?? null,
    operating_system_version:
      auditData.operatingSystemVersion ?? null,

    browser: auditData.browser ?? null,
    browser_version: auditData.browserVersion ?? null,

    screen_width: auditData.screenWidth ?? null,
    screen_height: auditData.screenHeight ?? null,
    device_pixel_ratio: auditData.devicePixelRatio ?? null,

    user_agent: auditData.userAgent ?? null,

    ip_address: auditData.ipAddress ?? null,
    forwarded_for: auditData.forwardedFor ?? null,

    latitude: auditData.latitude ?? null,
    longitude: auditData.longitude ?? null,
    location_accuracy: auditData.locationAccuracy ?? null,

    status: auditData.status ?? "SUCCESS",
    failure_reason: auditData.failureReason ?? null,

    metadata:
      auditData.metadata == null
        ? null
        : JSON.stringify(auditData.metadata),
  };

  // ----------------------------------------------------------
  // 4. Create dedicated audit database connection
  // ----------------------------------------------------------

  const connection = await createDatabaseConnection(
    AUDIT_DATABASE_NAME,
  );

  try {
    // --------------------------------------------------------
    // 5. Insert audit event
    //
    // actor_name is now explicitly included in the INSERT.
    // Column order and parameter order must remain identical.
    // --------------------------------------------------------

    const query = `
      INSERT INTO ${AUDIT_TABLE_NAME} (
        id,
        request_id,
        correlation_id,
        session_id,

        user_id,
        actor_name,
        attempted_identity,

        company_id,
        region_id,
        zone_id,
        branch_id,
        department_id,

        action,
        module,
        entity,
        entity_id,

        old_values,
        new_values,

        device_id,
        device_type,
        device_manufacturer,
        device_model,

        operating_system,
        operating_system_version,
        browser,
        browser_version,

        screen_width,
        screen_height,
        device_pixel_ratio,
        user_agent,

        ip_address,
        forwarded_for,

        latitude,
        longitude,
        location_accuracy,

        status,
        failure_reason,

        metadata
      )
      VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?
      )
    `;

    // --------------------------------------------------------
    // 6. Prepare parameters in the exact SQL column order
    // --------------------------------------------------------

    const parameters = [
      values.id,
      values.request_id,
      values.correlation_id,
      values.session_id,

      values.user_id,
      values.actor_name,
      values.attempted_identity,

      values.company_id,
      values.region_id,
      values.zone_id,
      values.branch_id,
      values.department_id,

      values.action,
      values.module,
      values.entity,
      values.entity_id,

      values.old_values,
      values.new_values,

      values.device_id,
      values.device_type,
      values.device_manufacturer,
      values.device_model,

      values.operating_system,
      values.operating_system_version,
      values.browser,
      values.browser_version,

      values.screen_width,
      values.screen_height,
      values.device_pixel_ratio,
      values.user_agent,

      values.ip_address,
      values.forwarded_for,

      values.latitude,
      values.longitude,
      values.location_accuracy,

      values.status,
      values.failure_reason,

      values.metadata,
    ];

    // --------------------------------------------------------
    // 7. Execute INSERT
    // --------------------------------------------------------

    await connection.execute(query, parameters);

    // --------------------------------------------------------
    // 8. Return non-sensitive confirmation
    // --------------------------------------------------------

    return {
      id: auditId,
      action: values.action,
      module: values.module,
      userId: values.user_id,
      actorName: values.actor_name,
      status: values.status,
    };
  } finally {
    // --------------------------------------------------------
    // 9. Always close the connection
    // --------------------------------------------------------

    await connection.end();
  }
};