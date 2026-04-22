import jwt from "jsonwebtoken";
import {
  createSubscriptionModel,
  getAllSubscriptionsModel,
  getSubscriptionByIdModel,
  updateSubscriptionModel
} from "../models/subscriptionModel.js";

/* ===============================
   CREATE SUBSCRIPTION (ADMIN)
================================ */
export const createSubscription = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }

    const {
      name,
      price,
      currency = "USD",
      interval_type,
      details
    } = req.body;

    if (!name || !price || !interval_type || !details) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    const subscriptionId = await createSubscriptionModel({
      name,
      price,
      currency,
      interval_type,
      details
    });

    return res.json({
      success: true,
      message: "Subscription plan created",
      subscription_id: subscriptionId
    });

  } catch (err) {
    console.error("❌ createSubscription:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create subscription"
    });
  }
};

/* ===============================
   GET ALL SUBSCRIPTIONS
================================ */
export const getAllSubscriptions = async (req, res) => {
  try {
    const rows = await getAllSubscriptionsModel();

    res.json({
      success: true,
      total: rows.length,
      data: rows
    });

  } catch (err) {
    console.error("❌ getAllSubscriptions:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscriptions"
    });
  }
};

/* ===============================
   GET SINGLE SUBSCRIPTION
================================ */
export const getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await getSubscriptionByIdModel(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found"
      });
    }

    res.json({
      success: true,
      data: plan
    });

  } catch (err) {
    console.error("❌ getSubscriptionById:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscription"
    });
  }
};


/* ===============================
   UPDATE SUBSCRIPTION (ADMIN)
================================ */
export const updateSubscription = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin only"
      });
    }

    const { id } = req.params;

    const {
      name,
      price,
      currency,
      interval_type,
      details
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Subscription ID required"
      });
    }

    const updated = await updateSubscriptionModel(id, {
      name,
      price,
      currency,
      interval_type,
      details
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found"
      });
    }

    return res.json({
      success: true,
      message: "Subscription updated successfully"
    });

  } catch (err) {
    console.error("❌ updateSubscription:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update subscription"
    });
  }
};
