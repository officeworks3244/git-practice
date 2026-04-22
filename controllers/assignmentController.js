import jwt from "jsonwebtoken";
import {
  assignCustomerToUser,
  getAssignmentsByUser,
  deleteAssignment,
  getLocationsByCustomerModel
} from "../models/assignmentModel.js";

/* ✅ Assign Customer or Location to Exterminator */
export const assignToExterminator = async (req, res) => {
  try {
    // Token decode
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { role } = decoded;

    if (role !== "admin" && role !== "company_owner") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { user_id, customer_id, location_id, can_access_all_locations = 0 } = req.body;

    if (!user_id || !customer_id) {
      return res.status(400).json({
        success: false,
        message: "user_id and customer_id are required",
      });
    }

    const insertId = await assignCustomerToUser({
      user_id,
      customer_id,
      location_id,
      can_access_all_locations,
    });

    return res.status(201).json({
      success: true,
      message: "Assignment created successfully",
      assignment_id: insertId,
    });
  } catch (err) {
    console.error("❌ assignToExterminator Error:", err);
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/* ✅ Get all assigned customers/locations for a user */
export const getUserAssignments = async (req, res) => {
  try {
    const { user_id } = req.params;
    if (!user_id) return res.status(400).json({ success: false, message: "User ID required" });

    const assignments = await getAssignmentsByUser(user_id);

    return res.status(200).json({
      success: true,
      data: assignments,
    });
  } catch (err) {
    console.error("❌ getUserAssignments Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/* ✅ Delete an assignment */
export const removeAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: "Assignment ID required" });

    await deleteAssignment(id);

    return res.status(200).json({
      success: true,
      message: "Assignment removed successfully",
    });
  } catch (err) {
    console.error("❌ removeAssignment Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

export const getLocationsByCustomer = async (req, res) => {
  try {
    const { customer_id } = req.params;

    // ✅ Validate customer_id
    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required",
      });
    }

    // ✅ Verify token (optional for security)
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Token missing",
      });
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    // ✅ Fetch locations from model
    const locations = await getLocationsByCustomerModel(customer_id);

    return res.status(200).json({
      success: true,
      message: "Locations fetched successfully",
      data: locations,
    });
  } catch (error) {
    console.error("❌ getLocationsByCustomer Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching locations",
    });
  }
};
