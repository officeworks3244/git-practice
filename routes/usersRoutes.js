import express from "express";
import { getAllUsers, getUserById, addUser, editUser, getProfile, toggleUserStatus, testDbConnection } from "../controllers/usersController.js";
import upload from "../middleware/upload.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// ✅ Get all users (with filters based on role)
router.get("/get-all", getAllUsers);

// ✅ Get single user by ID
router.get("/getby-id/:id", getUserById);

// ✅ Get profile for logged-in user
router.get("/profile", getProfile);

// ✅ Add new user (Admin or Company Owner only) with optional file upload
// Use multipart/form-data with an optional `profile_image` field
router.post("/add", upload.single('profile_image'), addUser);

// ✅ Edit user with optional profile image update
router.put("/edit/:id", upload.single('profile_image'), editUser);

router.put("/toggle-status/:id", authMiddleware, toggleUserStatus);

router.get("/test-db", testDbConnection);

export default router;