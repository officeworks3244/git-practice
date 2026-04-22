import express from "express";
import {
  createSubscription,
  getAllSubscriptions,
  getSubscriptionById,
  updateSubscription
} from "../controllers/subscriptionController.js";

const router = express.Router();

/* ADMIN */
router.post("/subscriptions", createSubscription);

/* PUBLIC (for pricing page / checkout) */
router.get("/subscriptions", getAllSubscriptions);
router.get("/subscriptions/:id", getSubscriptionById);
router.put("/subscriptions/:id", updateSubscription);


export default router;
