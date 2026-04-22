import express from "express";
import { fetchInsectPopulationData } from "../controllers/insectPopulationController.js";

const router = express.Router();

router.get("/exterminator/insect-population", fetchInsectPopulationData);

export default router;
