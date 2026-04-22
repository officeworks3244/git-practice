// import { verifyWebhookSignature } from "./stripeService.js";
// import db from "../config/db.js";

// /* ===============================
//    STRIPE WEBHOOK HANDLER
// ================================ */
// export const handleStripeWebhook = async (req, res) => {
//   const signature = req.headers["stripe-signature"];
//   let event;

//   try {
//     event = verifyWebhookSignature(req.body, signature);
//   } catch (err) {
//     console.error("❌ Webhook signature error:", err.message);
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   try {
//     console.log("🔥 STRIPE WEBHOOK HIT:", event.type);

//     if (event.type === "checkout.session.completed") {
//       await handleCheckoutSessionCompleted(event.data.object);
//     }

//     if (event.type === "payment_intent.succeeded") {
//       await handlePaymentIntentSucceeded(event.data.object);
//     }

//     return res.json({ received: true });
//   } catch (err) {
//     console.error("❌ Webhook processing failed:", err);
//     return res.status(500).json({ success: false });
//   }
// };

// /* ===============================
//    SUBSCRIPTION CHECKOUT
// ================================ */
// const handleCheckoutSessionCompleted = async (session) => {
//   const conn = await db.getConnection();

//   try {
//     await conn.beginTransaction();

//     const company_id = Number(session.metadata?.company_id);
//     const plan = session.metadata?.plan;
//     const amount = session.amount_total / 100;
//     const currency = session.currency.toUpperCase();

//     if (!company_id || !plan) {
//       throw new Error("Missing company_id or plan in metadata");
//     }

//     console.log("🎉 Checkout completed for company:", company_id);

//     /* -------- INVOICE -------- */
//     const invoiceNumber = `INV-${Date.now()}`;

//     const [inv] = await conn.execute(
//       `INSERT INTO invoices
//        (company_id, invoice_number, amount, currency, status, meta, created_at)
//        VALUES (?, ?, ?, ?, ?, ?, NOW())`,
//       [
//         company_id,
//         invoiceNumber,
//         amount,
//         currency,
//         "paid",
//         JSON.stringify({
//           invoice_type: "subscription",
//           plan,
//           stripe_session_id: session.id,
//           stripe_payment_intent: session.payment_intent,
//           stripe_customer_id: session.customer,
//         }),
//       ]
//     );

//     /* -------- PAYMENT -------- */
//     await conn.execute(
//       `INSERT INTO payments
//        (company_id, invoice_id, amount, currency, payment_method, provider_transaction_id, status, meta, created_at)
//        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
//       [
//         company_id,
//         inv.insertId,
//         amount,
//         currency,
//         "stripe",
//         session.payment_intent,
//         "completed",
//         JSON.stringify({ source: "checkout.session.completed" }),
//       ]
//     );

//     /* -------- SUBSCRIPTION -------- */
//     let photosLimit = 100;
//     if (plan.includes("500")) photosLimit = 500;
//     if (plan.includes("1000")) photosLimit = 1000;

//     const expires = new Date();
//     expires.setMonth(expires.getMonth() + 1);

//     await conn.execute(
//       `UPDATE companies SET
//         subscription_status = 'active',
//         subscription_plan = ?,
//         subscription_expires_at = ?,
//         photos_limit = ?,
//         photos_used = 0,
//         billing_customer_id = ?,
//         updated_at = NOW()
//        WHERE id = ?`,
//       [
//         plan,
//         expires.toISOString().slice(0, 19).replace("T", " "),
//         photosLimit,
//         session.customer,
//         company_id,
//       ]
//     );

//     await conn.commit();

//     console.log("✅ Subscription activated for company:", company_id);
//   } catch (err) {
//     await conn.rollback();
//     console.error("❌ Checkout handler error:", err);
//     throw err;
//   } finally {
//     conn.release();
//   }
// };

// /* ===============================
//    PHOTO PACK PURCHASE
// ================================ */
// const handlePaymentIntentSucceeded = async (pi) => {
//   const conn = await db.getConnection();

//   try {
//     const company_id = Number(pi.metadata?.company_id);
//     if (!company_id) return;

//     const amount = pi.amount / 100;
//     let photos = 0;

//     if (amount === 4.99) photos = 100;
//     if (amount === 19.99) photos = 500;
//     if (amount === 34.99) photos = 1000;

//     if (!photos) return;

//     await conn.beginTransaction();

//     await conn.execute(
//       `UPDATE companies
//        SET photos_limit = photos_limit + ?, updated_at = NOW()
//        WHERE id = ?`,
//       [photos, company_id]
//     );

//     const invoiceNumber = `INV-${Date.now()}`;

//     const [inv] = await conn.execute(
//       `INSERT INTO invoices
//        (company_id, invoice_number, amount, currency, status, meta, created_at)
//        VALUES (?, ?, ?, ?, ?, ?, NOW())`,
//       [
//         company_id,
//         invoiceNumber,
//         amount,
//         pi.currency.toUpperCase(),
//         "paid",
//         JSON.stringify({
//           invoice_type: "photo_pack",
//           photos_added: photos,
//           stripe_payment_intent: pi.id,
//         }),
//       ]
//     );

//     await conn.execute(
//       `INSERT INTO payments
//        (company_id, invoice_id, amount, currency, payment_method, provider_transaction_id, status, meta, created_at)
//        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
//       [
//         company_id,
//         inv.insertId,
//         amount,
//         pi.currency.toUpperCase(),
//         "stripe",
//         pi.id,
//         "completed",
//         JSON.stringify({ photos_added: photos }),
//       ]
//     );

//     await conn.commit();
//     console.log(`✅ Photo pack added (${photos}) to company ${company_id}`);
//   } catch (err) {
//     await conn.rollback();
//     console.error("❌ Photo pack error:", err);
//   } finally {
//     conn.release();
//   }
// };

import { verifyWebhookSignature } from "./stripeService.js";
import db from "../config/db.js";

/* ===============================
   STRIPE WEBHOOK HANDLER
================================ */
export const handleStripeWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];
  let event;

  try {
    event = verifyWebhookSignature(req.body, signature);
  } catch (err) {
    console.error("❌ Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    console.log("🔥 STRIPE EVENT:", event.type);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      default:
        console.log("ℹ️ Unhandled event:", event.type);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("❌ Webhook processing failed:", err);
    return res.status(500).json({ success: false });
  }
};

/* ===============================
   SUBSCRIPTION CHECKOUT
================================ */
const handleCheckoutSessionCompleted = async (session) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const company_id = Number(session.metadata?.company_id);
    const subscription_id = Number(session.metadata?.subscription_id);

    if (!company_id || !subscription_id) {
      throw new Error("Missing company_id or subscription_id in metadata");
    }

    /* 🔒 Prevent duplicate webhook */
    const [[exists]] = await conn.execute(
      `SELECT id FROM invoices 
       WHERE meta->>'$.stripe_session_id' = ?`,
      [session.id]
    );

    if (exists) {
      console.log("⚠️ Duplicate webhook ignored:", session.id);
      await conn.rollback();
      return;
    }

    /* 📦 Subscription template */
    const [[plan]] = await conn.execute(
      `SELECT * FROM subscriptions 
       WHERE id = ? AND status = 'active'`,
      [subscription_id]
    );

    if (!plan) {
      throw new Error("Subscription plan not found");
    }

    const details = JSON.parse(plan.details || "{}");
    const amount = session.amount_total / 100;
    const currency = session.currency.toUpperCase();

    /* 🧾 INVOICE */
    const invoiceNumber = `INV-${Date.now()}`;

    const [inv] = await conn.execute(
      `INSERT INTO invoices
       (company_id, invoice_number, amount, currency, status, meta, created_at)
       VALUES (?, ?, ?, ?, 'paid', ?, NOW())`,
      [
        company_id,
        invoiceNumber,
        amount,
        currency,
        JSON.stringify({
          invoice_type: "subscription",
          subscription_id,
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent,
        }),
      ]
    );

    /* 💳 PAYMENT */
    await conn.execute(
      `INSERT INTO payments
       (company_id, invoice_id, amount, currency, payment_method,
        provider_transaction_id, status, meta, created_at)
       VALUES (?, ?, ?, ?, 'stripe', ?, 'completed', ?, NOW())`,
      [
        company_id,
        inv.insertId,
        amount,
        currency,
        session.payment_intent,
        JSON.stringify({ source: "checkout.session.completed" }),
      ]
    );

    /* 🏢 APPLY SUBSCRIPTION (SNAPSHOT) */
    const expires = new Date();
    expires.setMonth(
      expires.getMonth() + (details.duration_months || 1)
    );

    await conn.execute(
      `UPDATE companies SET
        subscription_plan = ?,
        is_ai_enabled = 1,
        subscription_status = 'active',
        subscription_expires_at = ?,
        photos_limit = ?,
        photos_used = 0,
        billing_customer_id = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        plan.name,
        expires,
        details.photos_limit || 0,
        session.customer,
        company_id,
      ]
    );

    await conn.commit();
    console.log("✅ Subscription activated for company:", company_id);
  } catch (err) {
    await conn.rollback();
    console.error("❌ Subscription webhook error:", err);
    throw err;
  } finally {
    conn.release();
  }
};

/* ===============================
   PHOTO PACK PURCHASE
================================ */
const handlePaymentIntentSucceeded = async (pi) => {
  const conn = await db.getConnection();

  try {
    const company_id = Number(pi.metadata?.company_id);
    const photos = Number(pi.metadata?.photos || 0);

    if (!company_id || !photos) return;

    await conn.beginTransaction();

    /* 🔒 Prevent duplicate payment */
    const [[exists]] = await conn.execute(
      `SELECT id FROM payments WHERE provider_transaction_id = ?`,
      [pi.id]
    );

    if (exists) {
      await conn.rollback();
      return;
    }

    const amount = pi.amount / 100;
    const currency = pi.currency.toUpperCase();

    /* 🧾 INVOICE */
    const invoiceNumber = `INV-${Date.now()}`;

    const [inv] = await conn.execute(
      `INSERT INTO invoices
       (company_id, invoice_number, amount, currency, status, meta, created_at)
       VALUES (?, ?, ?, ?, 'paid', ?, NOW())`,
      [
        company_id,
        invoiceNumber,
        amount,
        currency,
        JSON.stringify({
          invoice_type: "photo_pack",
          photos_added: photos,
          stripe_payment_intent: pi.id,
        }),
      ]
    );

    /* 💳 PAYMENT */
    await conn.execute(
      `INSERT INTO payments
       (company_id, invoice_id, amount, currency, payment_method,
        provider_transaction_id, status, meta, created_at)
       VALUES (?, ?, ?, ?, 'stripe', ?, 'completed', ?, NOW())`,
      [
        company_id,
        inv.insertId,
        amount,
        currency,
        pi.id,
        JSON.stringify({ photos_added: photos }),
      ]
    );

    /* 📸 UPDATE COMPANY */
    await conn.execute(
      `UPDATE companies
       SET photos_limit = photos_limit + ?, updated_at = NOW()
       WHERE id = ?`,
      [photos, company_id]
    );

    await conn.commit();
    console.log(`✅ Photo pack (${photos}) added to company ${company_id}`);
  } catch (err) {
    await conn.rollback();
    console.error("❌ Photo pack webhook error:", err);
  } finally {
    conn.release();
  }
};
