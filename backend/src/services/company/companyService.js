// ============================================================
// Laundry ERP - Company Service
// File: backend/src/services/company/companyService.js
//
// Purpose:
// - Apply company business rules.
// - Coordinate repository operations.
// - Record audit events for company operations.
// ============================================================

import {
  createCompany as createCompanyRecord,
  findAllCompanies as findAllCompanyRecords,
  findCompanyById as findCompanyRecordById,
  updateCompany as updateCompanyRecord,
  updateCompanyStatus as updateCompanyStatusRecord,
  softDeleteCompany as softDeleteCompanyRecord,
} from "../../repositories/company/companyRepository.js";

import { recordAuditEvent } from "../../services/audit/auditService.js";

// ------------------------------------------------------------
// Audit helper
// ------------------------------------------------------------

// Records company-related actions in the separate audit database.
// Property names must match the camelCase keys expected by
// auditRepository.js.

const recordCompanyAudit = async ({
  action,
  entityId,
  oldValues = null,
  newValues = null,
  status = "SUCCESS",
  failureReason = null,
}) => {
  await recordAuditEvent({
    // Action performed: CREATE, UPDATE, or DELETE.
    action,

    // Module where the action occurred.
    module: "COMPANY",

    // Database entity affected by the action.
    entity: "master_company",

    // IMPORTANT: auditRepository.js expects camelCase keys.
    entityId,
    oldValues,
    newValues,
    failureReason,

    // Result of the operation.
    status,
  });
};



// ------------------------------------------------------------
// Create company
// ------------------------------------------------------------

export const createCompany = async (companyData) => {
  const company = await createCompanyRecord(companyData);

  await recordCompanyAudit({
    action: "CREATE",
    entityId: company.id,
    newValues: company,
  });

  return company;
};

// ------------------------------------------------------------
// List companies
// ------------------------------------------------------------

export const getAllCompanies = async (paginationOptions) => {
  return findAllCompanyRecords(paginationOptions);
};

// ------------------------------------------------------------
// Get company by ID
// ------------------------------------------------------------

export const getCompanyById = async (companyId) => {
  const company = await findCompanyRecordById(companyId);

  if (!company) {
    const error = new Error("Company not found.");
    error.statusCode = 404;
    throw error;
  }

  return company;
};

// ------------------------------------------------------------
// Update company
// ------------------------------------------------------------

export const updateCompany = async (companyId, companyData) => {
  // Fetch existing values for audit history.
  const existingCompany = await findCompanyRecordById(companyId);

  if (!existingCompany) {
    const error = new Error("Company not found.");
    error.statusCode = 404;
    throw error;
  }

  const updatedCompany = await updateCompanyRecord(companyId, companyData);

  if (!updatedCompany) {
    const error = new Error("Company could not be updated.");
    error.statusCode = 404;
    throw error;
  }

  await recordCompanyAudit({
    action: "UPDATE",
    entityId: companyId,
    oldValues: existingCompany,
    newValues: updatedCompany,
  });

  return updatedCompany;
};

// ------------------------------------------------------------
// Activate / deactivate company
// ------------------------------------------------------------

export const updateCompanyStatus = async (companyId, isActive) => {
  const existingCompany = await findCompanyRecordById(companyId);

  if (!existingCompany) {
    const error = new Error("Company not found.");
    error.statusCode = 404;
    throw error;
  }

  const updatedCompany = await updateCompanyStatusRecord(
    companyId,
    isActive
  );

  if (!updatedCompany) {
    const error = new Error("Company status could not be updated.");
    error.statusCode = 404;
    throw error;
  }

  await recordCompanyAudit({
    action: "UPDATE",
    entityId: companyId,
    oldValues: {
      is_active: existingCompany.is_active,
    },
    newValues: {
      is_active: updatedCompany.is_active,
    },
  });

  return updatedCompany;
};

// ------------------------------------------------------------
// Soft-delete company
// ------------------------------------------------------------

export const deleteCompany = async (companyId) => {
  const existingCompany = await findCompanyRecordById(companyId);

  if (!existingCompany) {
    const error = new Error("Company not found.");
    error.statusCode = 404;
    throw error;
  }

  const deleted = await softDeleteCompanyRecord(companyId);

  if (!deleted) {
    const error = new Error("Company could not be deleted.");
    error.statusCode = 404;
    throw error;
  }

  await recordCompanyAudit({
    action: "DELETE",
    entityId: companyId,
    oldValues: existingCompany,
    newValues: {
      deleted_at: new Date().toISOString(),
      is_active: false,
    },
  });

  return {
    id: companyId,
    message: "Company soft-deleted successfully.",
  };
};