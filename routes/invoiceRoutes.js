import express from "express";
import jwt from "jsonwebtoken";
import {
  getCompanyInvoices,
  getInvoiceDetails,
  getRevenueSummary,
  getInvoiceCount,
  getSubscriptionStatus,
} from "../utils/photoCreditService.js";

const router = express.Router();

/* Helper: extract token */
const extractTokenData = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new Error("No token provided");
  const token = authHeader.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded;
};

/* GET /api/invoices - Get all invoices for company */
router.get("/", async (req, res) => {
  try {
    const decoded = extractTokenData(req);
    const company_id = decoded.company_id;
    const { page = 1, limit = 20, status } = req.query;

    const invoices = await getCompanyInvoices(company_id, {
      page: parseInt(page),
      limit: parseInt(limit),
      status: status || null,
    });

    const totalCount = await getInvoiceCount(company_id, status || null);

    return res.json({
      success: true,
      data: invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("getInvoices error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
});

/* GET /api/invoices/:invoiceId - Get single invoice */
router.get("/:invoiceId", async (req, res) => {
  try {
    const decoded = extractTokenData(req);
    const company_id = decoded.company_id;
    const { invoiceId } = req.params;

    const invoice = await getInvoiceDetails(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    // Check if invoice belongs to this company
    if (invoice.company_id !== company_id) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Invoice does not belong to your company",
      });
    }

    return res.json({
      success: true,
      data: invoice,
    });
  } catch (err) {
    console.error("getInvoice error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
});

/* GET /api/invoices/summary/revenue - Get revenue summary */
router.get("/summary/revenue", async (req, res) => {
  try {
    const decoded = extractTokenData(req);
    const company_id = decoded.company_id;

    const summary = await getRevenueSummary(company_id);

    return res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    console.error("getRevenueSummary error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
});

/* GET /api/invoices/status/subscription - Get subscription and photo status */
router.get("/status/subscription", async (req, res) => {
  try {
    const decoded = extractTokenData(req);
    const company_id = decoded.company_id;

    const subscriptionStatus = await getSubscriptionStatus(company_id);

    if (!subscriptionStatus) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    return res.json({
      success: true,
      data: subscriptionStatus,
    });
  } catch (err) {
    console.error("getSubscriptionStatus error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
});

export default router;
