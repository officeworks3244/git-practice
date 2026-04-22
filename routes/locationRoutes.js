import express from "express";
import {
  createLocation,
  fetchLocations,
  editLocation,
  
  getTrapStatistics,
  getLocationById,
  deleteLocation
} from "../controllers/locationController.js";
import { authMiddleware } from "../middleware/auth.js";


const router = express.Router();

// ✅ Add Location
router.post("/add", createLocation);

// ✅ Get All Locations (with optional ?customer_id=)
router.get("/", fetchLocations);

// ✅ Update Location
router.put("/:id", editLocation);



router.get("/statistics", authMiddleware, getTrapStatistics);

// ✅ Get Single Location by ID
router.get("/:id", getLocationById);

// ✅ Delete Location
router.delete("/delete/:id", deleteLocation);


export default router;
