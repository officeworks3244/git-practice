import express from "express";
import {
  addPhoto,
  getPhotosByMeetingId,
  getPhotosByExterminatorId,
  removePhoto,
  getPhotosByCompanyId,
  
} from "../controllers/photosController.js";
import { authMiddleware } from "../middleware/auth.js";
import { ensureCompanyAiAccess } from "../middleware/aiAccessMiddleware.js";
import upload from "../middleware/upload.js"; // ✅ multer middleware

const router = express.Router();

router.post("/add", authMiddleware, ensureCompanyAiAccess, addPhoto);
// GET - Photos by meeting ID
router.get("/meeting/:meeting_id", authMiddleware, getPhotosByMeetingId);

// GET - Photos by exterminator (from token)
router.get("/exterminator", authMiddleware, getPhotosByExterminatorId);

// GET - Company photos (admin = all, user = company only)
router.get("/company-photos", authMiddleware, getPhotosByCompanyId);

// DELETE - Delete photo by ID
router.delete("/:id", authMiddleware, removePhoto);
export default router;
