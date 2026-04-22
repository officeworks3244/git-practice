import jwt from "jsonwebtoken";
import {
  getAllCompaniesWithOwners,
  getCompanyOwnerByCompanyId,
  getInvoicesByCompanyIdModel,
  getInvoicesCountByCompanyIdModel,
  updateCompanyAiAccessModel,
  getCompanyAiAccessMetaModel,
} from "../models/adminModel.js";

const extractAdminFromToken = (req) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    const error = new Error("Unauthorized - Token missing");
    error.statusCode = 401;
    throw error;
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.role !== "admin") {
    const error = new Error("Access denied. Admin only.");
    error.statusCode = 403;
    throw error;
  }

  return decoded;
};

export const getAllCompanies = async (req, res) => {
  try {
    extractAdminFromToken(req);

    const companies = await getAllCompaniesWithOwners();

    return res.json({
      success: true,
      message: "Companies fetched successfully",
      total: companies.length,
      data: companies,
    });
  } catch (err) {
    console.error("getAllCompanies Error:", err);

    const statusCode = err.statusCode || 500;
    if (statusCode !== 500) {
      return res.status(statusCode).json({
        success: false,
        message: err.message,
      });
    }

    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: err.name === "TokenExpiredError" ? "Token expired" : "Invalid token",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while fetching companies",
      error: err.message,
    });
  }
};

export const getCompanyOwnerDetail = async (req, res) => {
  try {
    extractAdminFromToken(req);

    const { companyId } = req.params;
    const owner = await getCompanyOwnerByCompanyId(companyId);

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Owner not found",
      });
    }

    return res.json({
      success: true,
      data: owner,
    });
  } catch (err) {
    console.error("getCompanyOwnerDetail:", err);

    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? "Server error" : err.message,
    });
  }
};

export const getInvoicesByCompanyId = async (req, res) => {
  try {
    extractAdminFromToken(req);

    const { companyId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    const invoices = await getInvoicesByCompanyIdModel(companyId, { page, limit });
    const total = await getInvoicesCountByCompanyIdModel(companyId);

    const data = invoices.map((inv) => {
      let meta = null;
      try {
        meta = inv.meta ? JSON.parse(inv.meta) : null;
      } catch {
        meta = null;
      }

      return {
        id: inv.id,
        company_id: inv.company_id,
        invoice_number: inv.invoice_number,
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        type: inv.type,
        meta,
        created_at: new Date(inv.created_at).toISOString(),
        updated_at: inv.updated_at ? new Date(inv.updated_at).toISOString() : null,
      };
    });

    return res.json({
      success: true,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
      data,
    });
  } catch (err) {
    console.error("getInvoicesByCompanyId:", err);

    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? "Server error" : err.message,
    });
  }
};

export const updateCompanyAiAccess = async (req, res) => {
  try {
    extractAdminFromToken(req);

    const { companyId } = req.params;
    const { is_ai_enabled } = req.body;

    if (!companyId || Number.isNaN(Number(companyId))) {
      return res.status(400).json({
        success: false,
        message: "Valid companyId is required",
      });
    }

    if (typeof is_ai_enabled === "undefined") {
      return res.status(400).json({
        success: false,
        message: "is_ai_enabled is required",
      });
    }

    const normalizedValue =
      typeof is_ai_enabled === "string"
        ? ["true", "1", "yes", "on"].includes(is_ai_enabled.trim().toLowerCase())
        : Boolean(is_ai_enabled);

    const companyMeta = await getCompanyAiAccessMetaModel(Number(companyId));

    if (!companyMeta) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    if (companyMeta.subscription_status === "active") {
      return res.status(409).json({
        success: false,
        message: "AI access cannot be changed while subscription is active",
        data: {
          company_id: Number(companyId),
          is_ai_enabled: Boolean(companyMeta.is_ai_enabled),
          subscription_status: companyMeta.subscription_status,
        },
      });
    }

    const updated = await updateCompanyAiAccessModel(
      Number(companyId),
      normalizedValue
    );

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: "AI access could not be updated",
      });
    }

    return res.json({
      success: true,
      message: `AI access ${normalizedValue ? "enabled" : "disabled"} successfully`,
      data: {
        company_id: Number(companyId),
        is_ai_enabled: normalizedValue,
      },
    });
  } catch (err) {
    console.error("updateCompanyAiAccess:", err);

    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? "Server error" : err.message,
    });
  }
};
