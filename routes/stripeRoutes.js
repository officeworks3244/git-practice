import express from "express";
import jwt from "jsonwebtoken";
import * as stripeService from "../utils/stripeService.js";
import { handleStripeWebhook } from "../utils/webhookHandler.js";

const router = express.Router();
const createCheckoutSession =
  stripeService.createCheckoutSession ??
  stripeService.default?.createCheckoutSession;
const createPaymentIntent =
  stripeService.createPaymentIntent ??
  stripeService.default?.createPaymentIntent;
const getCheckoutSession =
  stripeService.getCheckoutSession ??
  stripeService.default?.getCheckoutSession;
const getPaymentIntent =
  stripeService.getPaymentIntent ??
  stripeService.default?.getPaymentIntent;

/* Helper: extract token */
const extractTokenData = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    const error = new Error("Authorization header is required");
    error.statusCode = 401;
    throw error;
  }

  if (!authHeader.startsWith("Bearer ")) {
    const error = new Error("Authorization header must use Bearer token");
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.split(" ")[1];

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    const error = new Error("Invalid or expired token");
    error.statusCode = 401;
    throw error;
  }
};

/* POST /api/stripe/checkout-session - Create checkout session for subscription */
router.post("/checkout-session", async (req, res) => {
  try {
    const decoded = extractTokenData(req);
    const company_id = decoded.company_id;
    const { plan, amount, successUrl, cancelUrl } = req.body;

    if (!plan || !amount || !successUrl || !cancelUrl) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: plan, amount, successUrl, cancelUrl",
      });
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive integer in cents",
      });
    }

    const session = await createCheckoutSession(
      company_id,
      plan,
      amount,
      "usd",
      successUrl,
      cancelUrl
    );

    return res.json({
      success: true,
      data: {
        sessionId: session.id,
        clientSecret: session.client_secret,
        url: session.url,
      },
    });
  } catch (error) {
    console.error("Checkout session error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to create checkout session",
    });
  }
});

/* POST /api/stripe/payment-intent - Create payment intent */
router.post("/payment-intent", async (req, res) => {
  try {
    const decoded = extractTokenData(req);
    const company_id = decoded.company_id;
    const { amount, description = "PestIQ Subscription Renewal" } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: "Amount is required",
      });
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive integer in cents",
      });
    }

    const paymentIntent = await createPaymentIntent(
      company_id,
      amount,
      "usd",
      description
    );

    return res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
    });
  } catch (error) {
    console.error("Payment intent error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to create payment intent",
    });
  }
});

/* GET /api/stripe/checkout-session/:sessionId - Get checkout session details */
router.get("/checkout-session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await getCheckoutSession(sessionId);

    return res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error("Get session error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve session",
    });
  }
});

/* GET /api/stripe/payment-intent/:paymentIntentId - Get payment intent details */
router.get("/payment-intent/:paymentIntentId", async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    const paymentIntent = await getPaymentIntent(paymentIntentId);

    return res.json({
      success: true,
      data: {
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
      },
    });
  } catch (error) {
    console.error("Get payment intent error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve payment intent",
    });
  }
});

export default router;
