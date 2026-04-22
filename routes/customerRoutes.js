import express from "express";
import {
  addCustomer,
  getCustomers,
  updateCustomer,
  deleteCustomer,
  getCustomerById
} from "../controllers/customerController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// POST /api/customers/add → Add new customer
router.post("/add", addCustomer);

// GET /api/customers?company_id=1 → Get all customers
router.get("/get-all", authMiddleware, getCustomers);

// PUT /api/customers/:id → Update a customer
router.put("/:id", updateCustomer);

// DELETE /api/customers/:id → Delete a customer
router.delete("/:id", deleteCustomer);

// GET /api/customers/get/:id
router.get("/get/:id", authMiddleware, getCustomerById);

export default router;
