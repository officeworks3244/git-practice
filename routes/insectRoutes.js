import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { getInsectData } from "../controllers/insectController.js";

const router = express.Router();

router.get("/get-all", authMiddleware, getInsectData);

export default router;
