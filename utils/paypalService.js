import db from "../config/db.js";

const PAYPAL_BASE_URL =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export const PAYPAL_SUPPORTED_CURRENCIES = new Set([
  "AUD",
  "BRL",
  "CAD",
  "CHF",
  "CZK",
  "DKK",
  "EUR",
  "GBP",
  "HKD",
  "HUF",
  "ILS",
  "JPY",
  "MXN",
  "NOK",
  "NZD",
  "PHP",
  "PLN",
  "SEK",
  "SGD",
  "THB",
  "TWD",
  "USD",
]);

const ZERO_DECIMAL_CURRENCIES = new Set(["HUF", "JPY", "TWD"]);

export const normalizePaypalCurrency = (currency) =>
  String(currency || "USD").trim().toUpperCase();

export const isSupportedPaypalCurrency = (currency) =>
  PAYPAL_SUPPORTED_CURRENCIES.has(normalizePaypalCurrency(currency));

export const isAbsoluteHttpUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const formatAmountForPaypal = (amount, currency) => {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Invalid PayPal amount");
  }

  return ZERO_DECIMAL_CURRENCIES.has(currency)
    ? numericAmount.toFixed(0)
    : numericAmount.toFixed(2);
};

const buildCustomId = ({ companyId, subscriptionId }) =>
  `${String(companyId || "").trim()}:${String(subscriptionId || "").trim()}`;

const parseCustomId = (customId) => {
  const [companyIdRaw = "", subscriptionIdRaw = ""] = String(customId || "").split(":");
  const companyId = Number(companyIdRaw);
  const subscriptionId = Number(subscriptionIdRaw);

  return {
    companyId: Number.isFinite(companyId) && companyId > 0 ? companyId : null,
    subscriptionId:
      Number.isFinite(subscriptionId) && subscriptionId > 0 ? subscriptionId : null,
  };
};

const extractPaypalApiError = async (response) => {
  const raw = await response.text();

  try {
    const parsed = JSON.parse(raw);
    const issue = parsed?.details?.[0]?.issue || parsed?.name || null;
    const description =
      parsed?.details?.[0]?.description || parsed?.message || response.statusText;

    const error = new Error(description || "PayPal API request failed");
    error.statusCode = response.status;
    error.paypalIssue = issue;
    error.paypalDetails = parsed;
    return error;
  } catch {
    const error = new Error(raw || response.statusText || "PayPal API request failed");
    error.statusCode = response.status;
    return error;
  }
};

const getAccessToken = async () => {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    throw new Error("PayPal credentials are missing");
  }

  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal OAuth failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
};

export const createOrder = async ({
  companyId,
  subscriptionId,
  amount,
  currency = "USD",
  returnUrl,
  cancelUrl,
}) => {
  const accessToken = await getAccessToken();
  const normalizedCurrency = normalizePaypalCurrency(currency);
  const customId = buildCustomId({ companyId, subscriptionId });

  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: normalizedCurrency,
            value: formatAmountForPaypal(amount, normalizedCurrency),
          },
          custom_id: customId,
          description: "PestIQ Subscription Payment",
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: returnUrl,
            cancel_url: cancelUrl,
            user_action: "PAY_NOW",
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw await extractPaypalApiError(response);
  }

  const order = await response.json();
  return {
    ...order,
    metadata: {
      companyId,
      subscriptionId,
    },
  };
};

export const captureOrder = async (orderId) => {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
    }
  );

  if (!response.ok) {
    throw await extractPaypalApiError(response);
  }

  return response.json();
};

export const getOrder = async (orderId) => {
  const accessToken = await getAccessToken();

  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw await extractPaypalApiError(response);
  }

  return response.json();
};

export const finalizePaypalSubscriptionOrder = async ({
  orderId,
  expectedCompanyId = null,
  fallbackSubscriptionId = null,
}) => {
  let order;

  try {
    order = await captureOrder(orderId);
  } catch (error) {
    if (error?.paypalIssue !== "ORDER_ALREADY_CAPTURED") {
      throw error;
    }

    order = await getOrder(orderId);
  }

  const sync = await syncCapturedPaypalSubscriptionOrder({
    order,
    expectedCompanyId,
    fallbackSubscriptionId,
  });

  return { order, sync };
};

export const syncCapturedPaypalSubscriptionOrder = async ({
  order,
  expectedCompanyId = null,
  fallbackSubscriptionId = null,
}) => {
  const customId = order?.purchase_units?.[0]?.custom_id;
  const parsed = parseCustomId(customId);
  const companyId = parsed.companyId || Number(expectedCompanyId);
  const subscriptionId = parsed.subscriptionId || Number(fallbackSubscriptionId);
  const purchaseUnit = order?.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.[0];

  if (!companyId || !subscriptionId) {
    throw new Error("Captured PayPal order is missing subscription metadata");
  }

  if (expectedCompanyId && Number(expectedCompanyId) !== companyId) {
    const error = new Error("PayPal order does not belong to this company");
    error.statusCode = 403;
    throw error;
  }

  if (!capture?.id || capture.status !== "COMPLETED") {
    throw new Error("PayPal capture was not completed");
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [[existingInvoice]] = await conn.execute(
      `SELECT id
       FROM invoices
       WHERE JSON_UNQUOTE(JSON_EXTRACT(meta, '$.paypal_capture_id')) = ?
          OR JSON_UNQUOTE(JSON_EXTRACT(meta, '$.paypal_order_id')) = ?
       LIMIT 1`,
      [capture.id, order.id]
    );

    if (existingInvoice) {
      await conn.rollback();
      return {
        alreadyProcessed: true,
        invoiceId: existingInvoice.id,
      };
    }

    const [[plan]] = await conn.execute(
      `SELECT * FROM subscriptions WHERE id = ? AND status = 'active' LIMIT 1`,
      [subscriptionId]
    );

    if (!plan) {
      throw new Error("Subscription plan not found for PayPal capture");
    }

    const details = JSON.parse(plan.details || "{}");
    const amount = Number(capture.amount?.value || purchaseUnit?.amount?.value || 0);
    const currency = normalizePaypalCurrency(
      capture.amount?.currency_code || purchaseUnit?.amount?.currency_code || "USD"
    );
    const invoiceNumber = `INV-${Date.now()}`;
    const metadata = {
      invoice_type: "subscription",
      subscription_id: subscriptionId,
      paypal_order_id: order.id,
      paypal_capture_id: capture.id,
      paypal_payer_id: order?.payer?.payer_id || null,
      paypal_status: capture.status,
    };

    const [invoiceResult] = await conn.execute(
      `INSERT INTO invoices
       (company_id, invoice_number, amount, currency, status, meta, created_at)
       VALUES (?, ?, ?, ?, 'paid', ?, NOW())`,
      [companyId, invoiceNumber, amount, currency, JSON.stringify(metadata)]
    );

    await conn.execute(
      `INSERT INTO payments
       (company_id, invoice_id, amount, currency, payment_method,
        provider_transaction_id, status, meta, created_at)
       VALUES (?, ?, ?, ?, 'paypal', ?, 'completed', ?, NOW())`,
      [
        companyId,
        invoiceResult.insertId,
        amount,
        currency,
        capture.id,
        JSON.stringify({ source: "paypal.capture", order_id: order.id }),
      ]
    );

    const expires = new Date();
    expires.setMonth(expires.getMonth() + (details.duration_months || 1));

    await conn.execute(
      `UPDATE companies SET
         subscription_plan = ?,
         is_ai_enabled = 1,
         subscription_status = 'active',
         subscription_expires_at = ?,
         photos_limit = ?,
         photos_used = 0,
         updated_at = NOW()
       WHERE id = ?`,
      [plan.name, expires, details.photos_limit || 0, companyId]
    );

    await conn.commit();

    return {
      alreadyProcessed: false,
      invoiceId: invoiceResult.insertId,
      subscriptionId,
      companyId,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};
