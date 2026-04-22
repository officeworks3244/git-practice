import express from "express";
import {
    assignToExterminator,
    getUserAssignments,
    removeAssignment,
    getLocationsByCustomer
} from "../controllers/assignmentController.js";

const router = express.Router();

// POST => Assign exterminator to customer/location
router.post("/assign", assignToExterminator);

// GET => Get all assignments for a user
router.get("/user/:user_id", getUserAssignments);

// DELETE => Remove assignment
router.delete("/:id", removeAssignment);

// ✅ Get all locations by customer ID
router.get("/by-customer/:customer_id", getLocationsByCustomer);

export default router;
