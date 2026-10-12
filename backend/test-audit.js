/**
 * ============================================================
 * FILE: backend/test-audit.js
 * PURPOSE: Verify centralized audit logging and actor_name.
 * ============================================================
 *
 * IMPORTANT:
 * This is a manual development test.
 * Run it from the backend directory.
 */

import "dotenv/config";

import { recordAuditEvent } from "./src/services/audit/auditService.js";

const runAuditTest = async () => {
  const testActorName = "Audit Test Actor";

  try {
    const result = await recordAuditEvent({
      requestId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),

      // Test actor details.
      userId: null,
      actorName: testActorName,
      attemptedIdentity: "audit-test@example.com",

      action: "AUDIT_ACTOR_NAME_TEST",
      module: "AUDIT",
      entity: "audit_log",

      status: "SUCCESS",

      metadata: {
        test: true,
        purpose: "Verify actor_name mapping",
      },
    });

    console.log("Audit event inserted successfully.");
    console.log("Audit ID:", result.id);
    console.log("Actor name:", result.actorName);
    console.log("Status:", result.status);
  } catch (error) {
    console.error("Audit test failed:", error.message);
    process.exitCode = 1;
  }
};

runAuditTest();