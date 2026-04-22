import express from "express";
import { getAllCompanies, getCompanyOwnerDetail, getInvoicesByCompanyId, updateCompanyAiAccess } from "../controllers/adminController.js";

const router = express.Router();

// ✅ Admin → Get all companies with owners
router.get("/get-all-companies", getAllCompanies);
router.get(
    "/company/:companyId/owner",
    getCompanyOwnerDetail
);

router.get(
  "/companies/:companyId/invoices",
  getInvoicesByCompanyId
);

router.put(
  "/companies/:companyId/ai-access",
  updateCompanyAiAccess
);

export default router;
