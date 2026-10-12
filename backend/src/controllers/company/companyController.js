// ============================================================
// Laundry ERP - Company Controller
// File: backend/src/controllers/company/companyController.js
//
// Purpose:
// Handle HTTP requests for Company APIs.
// Business logic remains in the Service layer.
// ============================================================

import {
  createCompany as createCompanyService,
  getAllCompanies as getAllCompaniesService,
  getCompanyById as getCompanyByIdService,
  updateCompany as updateCompanyService,
  updateCompanyStatus as updateCompanyStatusService,
  deleteCompany as deleteCompanyService,
} from "../../services/company/companyService.js";

import {
  createCompanySchema,
  updateCompanySchema,
  companyIdSchema,
  updateCompanyStatusSchema,
} from "../../validators/company/companyValidator.js";

// ------------------------------------------------------------
// Helper: Validate request data
// ------------------------------------------------------------

const validateRequest = (schema, data) => {
  const result = schema.safeParse(data);

  if (!result.success) {
    const error = new Error("Validation failed.");
    error.statusCode = 400;
    error.details = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    throw error;
  }

  return result.data;
};

// ------------------------------------------------------------
// Helper: Handle controller errors
// ------------------------------------------------------------

const handleControllerError = (error, next) => {
  // Database errors and unexpected errors are handled centrally.
  // Known HTTP errors retain their status codes.
  return next(error);
};

// ------------------------------------------------------------
// POST /api/companies
// Create a company
// ------------------------------------------------------------

export const createCompany = async (req, res, next) => {
  try {
    const companyData = validateRequest(createCompanySchema, req.body);

    const company = await createCompanyService(companyData);

    return res.status(201).json({
      success: true,
      message: "Company created successfully.",
      data: company,
    });
  } catch (error) {
    return handleControllerError(error, next);
  }
};

// ------------------------------------------------------------
// GET /api/companies
// List companies with pagination
// ------------------------------------------------------------

export const getAllCompanies = async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      const error = new Error(
        "Page must be a positive integer and limit must be between 1 and 100."
      );
      error.statusCode = 400;
      throw error;
    }

    const includeInactiveValue = req.query.includeInactive ?? "false";

    if (!["true", "false"].includes(includeInactiveValue)) {
      const error = new Error(
        "includeInactive must be either true or false."
      );
      error.statusCode = 400;
      throw error;
    }

    const result = await getAllCompaniesService({
      page,
      limit,
      includeInactive: includeInactiveValue === "true",
    });

    return res.status(200).json({
      success: true,
      message: "Companies retrieved successfully.",
      ...result,
    });
  } catch (error) {
    return handleControllerError(error, next);
  }
};

// ------------------------------------------------------------
// GET /api/companies/:id
// Get one company
// ------------------------------------------------------------

export const getCompanyById = async (req, res, next) => {
  try {
    const companyId = validateRequest(companyIdSchema, req.params.id);

    const company = await getCompanyByIdService(companyId);

    return res.status(200).json({
      success: true,
      message: "Company retrieved successfully.",
      data: company,
    });
  } catch (error) {
    return handleControllerError(error, next);
  }
};

// ------------------------------------------------------------
// PUT /api/companies/:id
// Update company details
// ------------------------------------------------------------

export const updateCompany = async (req, res, next) => {
  try {
    const companyId = validateRequest(companyIdSchema, req.params.id);
    const companyData = validateRequest(updateCompanySchema, req.body);

    const company = await updateCompanyService(companyId, companyData);

    return res.status(200).json({
      success: true,
      message: "Company updated successfully.",
      data: company,
    });
  } catch (error) {
    return handleControllerError(error, next);
  }
};

// ------------------------------------------------------------
// PATCH /api/companies/:id/status
// Activate or deactivate a company
// ------------------------------------------------------------

export const updateCompanyStatus = async (req, res, next) => {
  try {
    const companyId = validateRequest(companyIdSchema, req.params.id);
    const statusData = validateRequest(
      updateCompanyStatusSchema,
      req.body
    );

    const company = await updateCompanyStatusService(
      companyId,
      statusData.is_active
    );

    return res.status(200).json({
      success: true,
      message: "Company status updated successfully.",
      data: company,
    });
  } catch (error) {
    return handleControllerError(error, next);
  }
};

// ------------------------------------------------------------
// DELETE /api/companies/:id
// Soft-delete a company
// ------------------------------------------------------------

export const deleteCompany = async (req, res, next) => {
  try {
    const companyId = validateRequest(companyIdSchema, req.params.id);

    const result = await deleteCompanyService(companyId);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleControllerError(error, next);
  }
};