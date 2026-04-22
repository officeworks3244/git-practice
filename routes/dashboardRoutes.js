import express from "express";
import { fetchDashboardStats, fetchExterminatorDashboardStats, fetchExterminatorRecentActivity } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/stats", fetchDashboardStats);
router.get("/exterminator/dashboard", fetchExterminatorDashboardStats);
router.get(
  "/exterminator/recent-activity",
  fetchExterminatorRecentActivity
);

export default router;
