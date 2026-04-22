import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import {
  addTrap,
  getTraps,
  editTrap,
  removeTrap,
} from "../controllers/trapController.js";

const router = express.Router();

// ✅ Add new trap
router.post("/add", authMiddleware, addTrap);

// ✅ Get all traps (filterable by ?customer_id=&location_id=)
router.get("/traps", authMiddleware, getTraps);

// ✅ Update a trap
router.put("/:id", authMiddleware, editTrap);

// ✅ Delete a trap (soft delete)
router.delete("/:id", authMiddleware, removeTrap);

export default router;
