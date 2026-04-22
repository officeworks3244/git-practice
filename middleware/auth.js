
// middlewares/authMiddleware.js
import jwt from "jsonwebtoken";
import { getUserById } from "../models/authModel.js";

export const authMiddleware = async (req, res, next) => {
  try {
    /* ===============================
       ✅ READ TOKEN
    =============================== */
    const authHeader = req.header("Authorization");
    const token = authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    /* ===============================
       ✅ VERIFY TOKEN
    =============================== */
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /* ===============================
       ✅ ADMIN (SYSTEM LEVEL)
    =============================== */
    if (decoded.role === "admin") {
      req.user = {
        id: decoded.id,
        role: "admin",
        company_id: null,
        isAdmin: true,
      };
      return next();
    }

    /* ===============================
       ✅ FETCH USER FROM DB
    =============================== */
    const user = await getUserById(decoded.id);

    if (!user || user.is_active !== 1) {
      return res.status(401).json({
        success: false,
        message: "Invalid user or inactive account.",
      });
    }

    /* ===============================
       ✅ FINAL ROLE DECISION
       RULE:
       is_company_owner = 1  → company_owner
       is_company_owner = 0  → exterminator
    =============================== */
    const role = user.is_company_owner === 1
      ? "company_owner"
      : "exterminator";

    /* ===============================
       ✅ ATTACH USER TO REQUEST
    =============================== */
    req.user = {
      id: user.id,
      role,
      company_id: user.company_id,
      email: user.email,
      name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
      isAdmin: false,
    };

    console.log("✅ Authenticated User:", req.user);
    next();

  } catch (error) {
    console.error("❌ Auth Middleware Error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};


