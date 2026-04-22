import jwt from "jsonwebtoken";
import { getDashboardStats, getExterminatorDashboardStats, getExterminatorRecentActivity } from "../models/dashboardModel.js";

export const fetchDashboardStats = async (req, res) => {
  try {
    // ✅ Get token from header
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized - Token missing" });
    }

    // ✅ Decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id: user_id, company_id, role } = decoded;

    console.log("Dashboard request:", user_id, company_id, role);

    if (!company_id && role !== "admin") {
      return res.status(400).json({ success: false, message: "Invalid token: company_id missing" });
    }

    let stats;

    if (role === "admin") {
      // ✅ Admin → all data
      stats = await getDashboardStats();
    } 
    else if (role === "company_owner") {
      // ✅ Company owner → own company stats
      stats = await getDashboardStats(company_id, user_id);
    } 
    else if (role === "user") {
      // ✅ Regular user → only stats relevant to self
      stats = await getDashboardStats(company_id, user_id, true); // `true` = filter by user only
    } 
    else {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    return res.json({
      success: true,
      message: "Dashboard stats fetched successfully",
      data: stats,
    });

  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};


export const fetchExterminatorDashboardStats = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token missing" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id: exterminator_id, role } = decoded;

    if (role !== "exterminator") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // ✅ today | week | month
    const { filter } = req.query;

    const stats = await getExterminatorDashboardStats(exterminator_id, filter);

    return res.json({
      success: true,
      message: "Exterminator dashboard stats fetched",
      filter: filter || "all",
      data: stats,
    });

  } catch (error) {
    console.error("Dashboard Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};




export const fetchExterminatorRecentActivity = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { id: exterminator_id, role } = decoded;

    if (role !== "exterminator") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const limit = Number(req.query.limit) || 10;

    const activity = await getExterminatorRecentActivity(
      exterminator_id,
      limit
    );

    return res.status(200).json({
      success: true,
      message: "Recent activity fetched successfully",
      data: activity,
    });

  } catch (error) {
    console.error("Recent Activity Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};