import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { getMeetingReport } from "../controllers/reportController.js";

const router = express.Router();

// Dashboard ya Reports page ke liye main API
router.get("/pest-analytics", authMiddleware, getMeetingReport);

export default router;