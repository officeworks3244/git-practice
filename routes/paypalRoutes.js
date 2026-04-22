import express from "express";
import jwt from "jsonwebtoken";
import {
  createOrder,
  finalizePaypalSubscriptionOrder,
  getOrder,
  isAbsoluteHttpUrl,
  isSupportedPaypalCurrency,
  normalizePaypalCurrency,
  PAYPAL_SUPPORTED_CURRENCIES,
} from "../utils/paypalService.js";

const router = express.Router();

const appendQueryParams = (targetUrl, params) => {
  const url = new URL(targetUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
};

const buildPaypalRedirectUrls = ({ returnUrl, cancelUrl, subscriptionId }) => {
  const baseUrl = String(process.env.BASE_URL || "").trim().replace(/\/+$/, "");

  if (!isAbsoluteHttpUrl(baseUrl)) {
    const error = new Error("BASE_URL must be an absolute http(s) URL for PayPal redirects");
    error.statusCode = 500;
    throw error;
  }

  const successCallback = new URL(`${baseUrl}/api/paypal/return`);
  successCallback.searchParams.set("returnUrl", returnUrl);

  if (subscriptionId) {
    successCallback.searchParams.set("subscriptionId", String(subscriptionId));
  }

  const cancelCallback = new URL(`${baseUrl}/api/paypal/cancel`);
  cancelCallback.searchParams.set("cancelUrl", cancelUrl);

  if (subscriptionId) {
    cancelCallback.searchParams.set("subscriptionId", String(subscriptionId));
  }

  return {
    paypalReturnUrl: successCallback.toString(),
    paypalCancelUrl: cancelCallback.toString(),
  };
};

const extractTokenData = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new Error("No token provided");
  const token = authHeader.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded;
};

/* GET /api/paypal/config - Expose client id for frontend sdk init */
router.get("/config", (req, res) => {
  return res.json({
    success: true,
    data: {
      clientId: process.env.PAYPAL_CLIENT_ID || "",
      environment: process.env.PAYPAL_ENV || "sandbox",
    },
  });
});

/* POST /api/paypal/create-order */
router.post("/create-order", async (req, res) => {
  try {
    const decoded = extractTokenData(req);
    const companyId = decoded.company_id;
    const {
      subscriptionId = null,
      amount,
      currency = "USD",
      returnUrl,
      cancelUrl,
    } = req.body;

    if (!amount || !returnUrl || !cancelUrl) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: amount, returnUrl, cancelUrl",
      });
    }

    const normalizedCurrency = normalizePaypalCurrency(currency);
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "amount must be a valid number greater than 0",
      });
    }

    if (!isAbsoluteHttpUrl(returnUrl) || !isAbsoluteHttpUrl(cancelUrl)) {
      return res.status(400).json({
        success: false,
        message: "returnUrl and cancelUrl must be absolute http(s) URLs",
      });
    }

    if (!isSupportedPaypalCurrency(normalizedCurrency)) {
      return res.status(400).json({
        success: false,
        message: `Currency ${normalizedCurrency} is not supported by PayPal for this checkout flow`,
        code: "PAYPAL_UNSUPPORTED_CURRENCY",
        data: {
          requestedCurrency: normalizedCurrency,
          allowedCurrencies: [...PAYPAL_SUPPORTED_CURRENCIES],
        },
      });
    }

    console.info("PayPal create-order payload validated", {
      companyId,
      subscriptionId,
      amount: numericAmount,
      currency: normalizedCurrency,
      returnUrl,
      cancelUrl,
    });

    const { paypalReturnUrl, paypalCancelUrl } = buildPaypalRedirectUrls({
      returnUrl,
      cancelUrl,
      subscriptionId,
    });

    const order = await createOrder({
      companyId,
      subscriptionId,
      amount: numericAmount,
      currency: normalizedCurrency,
      returnUrl: paypalReturnUrl,
      cancelUrl: paypalCancelUrl,
    });

    const approveLink =
      order.links?.find(
        (link) => link.rel === "approve" || link.rel === "payer-action"
      )?.href || null;

    return res.json({
      success: true,
        data: {
          orderId: order.id,
          status: order.status,
          currency: normalizedCurrency,
          approveUrl: approveLink,
        },
      });
  } catch (error) {
    console.error("PayPal create order error:", error);
    const statusCode =
      error?.statusCode ||
      (error?.paypalIssue === "CURRENCY_NOT_SUPPORTED" ? 400 : 500);

    return res.status(statusCode).json({
      success: false,
      message: error?.message || "Failed to create PayPal order",
    });
  }
});

/* POST /api/paypal/capture-order */
router.post("/capture-order", async (req, res) => {
  try {
    const decoded = extractTokenData(req);
    const { orderId, subscriptionId = null } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "orderId is required",
      });
    }

    const result = await finalizePaypalSubscriptionOrder({
      orderId,
      expectedCompanyId: decoded.company_id,
      fallbackSubscriptionId: subscriptionId,
    });

    return res.json({
      success: true,
      data: {
        capture: result.order,
        sync: result.sync,
      },
    });
  } catch (error) {
    console.error("PayPal capture order error:", error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || "Failed to capture PayPal order",
    });
  }
});

/* GET /api/paypal/return - PayPal redirects here after approval */
router.get("/return", async (req, res) => {
  const {
    token: orderId,
    returnUrl,
    subscriptionId = null,
  } = req.query;

  if (!orderId || !isAbsoluteHttpUrl(returnUrl)) {
    return res.status(400).json({
      success: false,
      message: "Missing valid PayPal return parameters",
    });
  }

  try {
    const result = await finalizePaypalSubscriptionOrder({
      orderId,
      fallbackSubscriptionId: subscriptionId,
    });

    return res.redirect(
      appendQueryParams(returnUrl, {
        paypal: 1,
        orderId,
        captureStatus: result.order?.status || "COMPLETED",
        sync: result.sync?.alreadyProcessed ? "already_processed" : "completed",
      })
    );
  } catch (error) {
    console.error("PayPal return handler error:", error);

    return res.redirect(
      appendQueryParams(returnUrl, {
        paypal: 0,
        orderId,
        error: error?.message || "PayPal capture failed",
      })
    );
  }
});

/* GET /api/paypal/cancel - PayPal redirects here after cancellation */
router.get("/cancel", (req, res) => {
  const { token: orderId = "", cancelUrl } = req.query;

  if (!isAbsoluteHttpUrl(cancelUrl)) {
    return res.status(400).json({
      success: false,
      message: "Missing valid PayPal cancel parameters",
    });
  }

  return res.redirect(
    appendQueryParams(cancelUrl, {
      paypal: 0,
      orderId,
      cancelled: 1,
    })
  );
});

/* GET /api/paypal/order/:orderId */
router.get("/order/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await getOrder(orderId);

    return res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("PayPal get order error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch PayPal order",
    });
  }
});

export default router;
