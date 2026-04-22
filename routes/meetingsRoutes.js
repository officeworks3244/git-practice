import express from "express";
import {
  createMeeting,
  listMeetings,
  changeMeetingStatus,
  updateMeetingDetails,
  getMeetingsForExterminator,
  getMeetingsForLocation,
  getMeetingsForCompany,
  removeMeeting,
  createMeetingForExterminator,
  getMeetingDetails,
  getExterminatorMeetings,
  completeMeeting
} from "../controllers/meetingsController.js";
import { authMiddleware } from "../middleware/auth.js";


const router = express.Router();

router.get(
  "/assigned-to-me",
  authMiddleware,
  getExterminatorMeetings
);

// --- LISTING AND SPECIFIC ROUTES MUST COME FIRST ---
router.get("/get-all",authMiddleware, listMeetings); // 1. This must come before /:id

// --- FILTERED LISTS ---
// The following routes have specific path segments that prevent conflicts
router.get("/exterminator/:exterminator_id", getMeetingsForExterminator);
router.get("/location/:location_id", getMeetingsForLocation);
router.get("/company/:company_id", getMeetingsForCompany);

// --- CRUD Operations ---
router.post("/add", createMeeting);
router.put("/:id", updateMeetingDetails);
router.put("/:id/status", changeMeetingStatus);

// ✅ NEW ROUTE: Mobile App Exterminator Meeting Creation
router.post("/exterminator/add", createMeetingForExterminator);

// --- GENERIC ID ROUTE MUST COME LAST ---
router.get("/:id", authMiddleware, getMeetingDetails); // 2. This must come after /get-all
router.delete("/:id", authMiddleware, removeMeeting);

// Complete meeting
router.put("/complete/:id", authMiddleware, completeMeeting);




export default router;