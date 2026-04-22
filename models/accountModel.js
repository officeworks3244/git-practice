import db from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

const DEFAULT_TRIAL_PHOTO_LIMIT = Number(process.env.DEFAULT_TRIAL_PHOTO_LIMIT ?? 100);

/* Get user with company details */
export const getUserProfileModel = async (user_id) => {
  const [rows] = await db.execute(
    `SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.address,
        u.city,
        u.country,
        u.zip,
        u.vat,
        u.is_company_owner,
        u.status,
        u.created_at,
        u.profile_image,
        c.id AS company_id,
        c.name AS company_name,
        c.is_ai_enabled,
        CASE
          WHEN c.subscription_status = 'active' THEN 'active'
          WHEN c.is_ai_enabled = 1 THEN 'trial'
          ELSE c.subscription_status
        END AS subscription_status,
        c.photos_limit,
        c.photos_used,
        c.subscription_expires_at
     FROM users u
     LEFT JOIN companies c ON u.company_id = c.id
     WHERE u.id = ? LIMIT 1`,
    [user_id]
  );

  const user = rows[0] || null;
  if (user && user.profile_image) {
    // ✅ Add BASE_URL prefix if it's a relative path
    const BASE_URL = process.env.BASE_URL || 'https://yourdomain.com'; // change this as needed
    if (!user.profile_image.startsWith('http')) {
      user.profile_image = `${BASE_URL}/${user.profile_image}`;
    }
  }

  return user;
};


/* Update user profile (partial update) */
// export const updateUserProfileModel = async (user_id, data) => {
//   // Build dynamic set - only fields that exist in users table
//   const allowed = ["first_name", "last_name", "email", "mobile", "vat", "zip", "city", "country", "address", "preferences"];
//   const setParts = [];
//   const params = [];

//   allowed.forEach((k) => {
//     if (typeof data[k] !== "undefined") {
//       setParts.push(`${k} = ?`);
//       params.push(data[k]);
//     }
//   });

//   if (setParts.length === 0) return null;
//   params.push(user_id);

//   const sql = `UPDATE users SET ${setParts.join(", ")}, updated_at = NOW() WHERE id = ?`;
//   console.log("SQL Query:", sql);
//   console.log("Params:", params);

//   const [result] = await db.execute(sql, params);
//   return result.affectedRows > 0;
// };

export const updateUserProfileModel = async (user_id, data) => {
  // Allowed fields for update
  const allowed = [
    "first_name",
    "last_name",
    "email",
    "mobile",
    "vat",
    "zip",
    "city",
    "country",
    "profile_image",
    "google_avatar",
    "facebook_avatar",
    "apple_avatar",
  ];

  const setParts = [];
  const params = [];

  allowed.forEach((key) => {
    if (typeof data[key] !== "undefined" && data[key] !== null) {
      setParts.push(`${key} = ?`);
      params.push(data[key]);
    }
  });

  if (setParts.length === 0) return null;

  params.push(user_id);
  const sql = `UPDATE users SET ${setParts.join(", ")}, updated_at = NOW() WHERE id = ?`;

  console.log("SQL Query:", sql);
  console.log("Params:", params);

  const [result] = await db.execute(sql, params);
  return result.affectedRows > 0;
};


/* Get invoices by company with optional paging */
export const getInvoicesByCompanyModel = async (company_id, opts = { page: 1, limit: 20 }) => {
  const offset = (opts.page - 1) * opts.limit;
  const [rows] = await db.execute(
    `SELECT * FROM invoices WHERE company_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [company_id, opts.limit, offset]
  );
  return rows;
};

/* Get payments */
export const getPaymentsByCompanyModel = async (company_id) => {
  const [rows] = await db.execute(
    `SELECT p.*, i.invoice_number FROM payments p LEFT JOIN invoices i ON p.invoice_id = i.id WHERE p.company_id = ? ORDER BY p.created_at DESC`,
    [company_id]
  );
  return rows;
};

/* Get company subscription info */
export const getCompanySubscriptionModel = async (company_id) => {
  const [rows] = await db.execute(
    `SELECT
       id,
       name,
       is_ai_enabled,
       CASE
         WHEN subscription_status = 'active' THEN 'active'
         WHEN is_ai_enabled = 1 THEN 'trial'
         ELSE subscription_status
       END AS subscription_status,
       CASE
         WHEN subscription_status = 'active' THEN subscription_plan
         WHEN is_ai_enabled = 1 THEN 'Free Trial'
         ELSE subscription_plan
       END AS subscription_plan,
       subscription_expires_at,
       photos_limit,
       photos_used
     FROM companies
     WHERE id = ?
     LIMIT 1`,
    [company_id]
  );
  return rows[0] || null;
};

export const getCompanyAccessStatusModel = async (company_id) => {
  const [rows] = await db.execute(
    `SELECT
       id,
       name,
       is_ai_enabled,
       subscription_status,
       subscription_plan,
       subscription_expires_at,
       photos_limit,
       photos_used
     FROM companies
     WHERE id = ?
     LIMIT 1`,
    [company_id]
  );

  const company = rows[0] || null;
  if (!company) return null;

  const paidSubscriptionActive = company.subscription_status === "active";
  const trialActive = !paidSubscriptionActive && Boolean(company.is_ai_enabled);
  const accessGranted = paidSubscriptionActive || trialActive;
  const effectivePhotosLimit =
    trialActive && (!company.photos_limit || Number(company.photos_limit) <= 0)
      ? DEFAULT_TRIAL_PHOTO_LIMIT
      : Number(company.photos_limit ?? 0);
  const effectivePhotosUsed = Number(company.photos_used ?? 0);

  return {
    company_id: company.id,
    company_name: company.name,
    access_granted: accessGranted,
    access_status: paidSubscriptionActive
      ? "subscription_active"
      : trialActive
        ? "trial_active"
        : "inactive",
    subscription_status: paidSubscriptionActive
      ? "active"
      : trialActive
        ? "trial"
        : company.subscription_status || "inactive",
    plan_name: paidSubscriptionActive
      ? company.subscription_plan || "Paid Subscription"
      : trialActive
        ? "Free Trial"
        : company.subscription_plan,
    is_trial: trialActive,
    is_paid_subscription: paidSubscriptionActive,
    is_ai_enabled: Boolean(company.is_ai_enabled),
    can_upload_photos: accessGranted,
    can_use_ai: accessGranted,
    subscription_expires_at: company.subscription_expires_at,
    photos_limit: effectivePhotosLimit,
    photos_used: effectivePhotosUsed,
    remaining_photos: Math.max(effectivePhotosLimit - effectivePhotosUsed, 0),
    message: paidSubscriptionActive
      ? "Paid subscription is active for this company."
      : trialActive
        ? "Free trial is active for this company."
        : "No active subscription or free trial found for this company.",
  };
};


/* Renew subscription: create invoice, optionally payment record, update company subscription fields */
export const renewCompanySubscriptionModel = async (company_id, { plan, amount, months = 1, payment_info }) => {
  // Create invoice
  const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 9000)}`;

  const [invResult] = await db.execute(
    `INSERT INTO invoices (company_id, invoice_number, amount, currency, status, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [company_id, invoiceNumber, amount, payment_info.currency || "EUR", "paid", JSON.stringify(payment_info || {})]
  );

  const invoiceId = invResult.insertId;

  // Create payment record (if payment_info present)
  if (amount > 0) {
    await db.execute(
      `INSERT INTO payments (company_id, invoice_id, amount, currency, payment_method, provider_transaction_id, status, meta, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [company_id, invoiceId, amount, payment_info.currency || "EUR", payment_info.method || null, payment_info.tx || null, "completed", JSON.stringify(payment_info || {})]
    );
  }

  // Update company's subscription fields (extend expiry)
  // Read existing expiry
  const [compRows] = await db.execute(`SELECT subscription_expires_at FROM companies WHERE id = ? LIMIT 1`, [company_id]);
  let expiresAt = compRows[0]?.subscription_expires_at ? new Date(compRows[0].subscription_expires_at) : new Date();
  // add months
  expiresAt.setMonth(expiresAt.getMonth() + months);

  await db.execute(
    `UPDATE companies
     SET subscription_status = 'active',
         subscription_plan = ?,
         subscription_expires_at = ?,
         photos_limit = photos_limit + ?,
         is_ai_enabled = 1
     WHERE id = ?`,
    [plan, expiresAt.toISOString().slice(0, 19).replace('T', ' '), (plan.includes("1000") ? 1000 : 0), company_id]
  );

  return { invoiceId, invoiceNumber, newExpiry: expiresAt };
};

/* Cancel subscription */
export const cancelCompanySubscriptionModel = async (company_id) => {
  const [result] = await db.execute(
    `UPDATE companies SET subscription_status = 'cancelled', subscription_expires_at = NULL WHERE id = ?`,
    [company_id]
  );
  return result.affectedRows > 0;
};
