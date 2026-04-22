import db from "../config/db.js";

const DEFAULT_TRIAL_PHOTO_LIMIT = Number(process.env.DEFAULT_TRIAL_PHOTO_LIMIT ?? 100);

/* Check if company has available photo credits */
export const hasPhotoCredits = async (company_id) => {
  try {
    const [rows] = await db.execute(
      `SELECT photos_limit, photos_used, subscription_status, is_ai_enabled FROM companies WHERE id = ?`,
      [company_id]
    );

    if (rows.length === 0) return false;

    const { photos_limit, photos_used, subscription_status, is_ai_enabled } = rows[0];
    const paidSubscriptionActive = subscription_status === "active";
    const trialActive = !paidSubscriptionActive && Boolean(is_ai_enabled);
    const effectiveLimit =
      trialActive && (!photos_limit || Number(photos_limit) <= 0)
        ? DEFAULT_TRIAL_PHOTO_LIMIT
        : Number(photos_limit ?? 0);

    return Number(photos_used ?? 0) < effectiveLimit;
  } catch (error) {
    console.error("Error checking photo credits:", error);
    throw error;
  }
};

/* Get available photo credits left */
export const getAvailablePhotos = async (company_id) => {
  try {
    const [rows] = await db.execute(
      `SELECT photos_limit, photos_used, subscription_status, is_ai_enabled FROM companies WHERE id = ?`,
      [company_id]
    );

    if (rows.length === 0) return 0;

    const { photos_limit, photos_used, subscription_status, is_ai_enabled } = rows[0];
    const paidSubscriptionActive = subscription_status === "active";
    const trialActive = !paidSubscriptionActive && Boolean(is_ai_enabled);
    const effectiveLimit =
      trialActive && (!photos_limit || Number(photos_limit) <= 0)
        ? DEFAULT_TRIAL_PHOTO_LIMIT
        : Number(photos_limit ?? 0);

    return Math.max(0, effectiveLimit - Number(photos_used ?? 0));
  } catch (error) {
    console.error("Error getting available photos:", error);
    throw error;
  }
};

/* Increment photo usage */
export const incrementPhotoUsage = async (company_id, count = 1) => {
  try {
    const [result] = await db.execute(
      `UPDATE companies SET photos_used = photos_used + ? WHERE id = ?`,
      [count, company_id]
    );
    return result.affectedRows > 0;
  } catch (error) {
    console.error("Error incrementing photo usage:", error);
    throw error;
  }
};

/* Reset photo usage (after renewal) */
export const resetPhotoUsage = async (company_id) => {
  try {
    const [result] = await db.execute(
      `UPDATE companies SET photos_used = 0 WHERE id = ?`,
      [company_id]
    );
    return result.affectedRows > 0;
  } catch (error) {
    console.error("Error resetting photo usage:", error);
    throw error;
  }
};

/* Check if subscription is expired/overdue */
export const isSubscriptionOverdue = async (company_id) => {
  try {
    const [rows] = await db.execute(
      `SELECT subscription_expires_at, subscription_status FROM companies WHERE id = ?`,
      [company_id]
    );

    if (rows.length === 0) return true;

    const { subscription_expires_at, subscription_status } = rows[0];

    // Check if status is cancelled
    if (subscription_status === "cancelled") return true;

    // Check if expiry date is in past
    if (!subscription_expires_at) return true;

    const expiryDate = new Date(subscription_expires_at);
    const now = new Date();

    return expiryDate < now;
  } catch (error) {
    console.error("Error checking subscription overdue:", error);
    throw error;
  }
};

/* Get subscription status and remaining days */
export const getSubscriptionStatus = async (company_id) => {
  try {
    const [rows] = await db.execute(
      `SELECT 
        subscription_status,
        subscription_expires_at,
        subscription_plan,
        photos_limit,
        photos_used
       FROM companies WHERE id = ?`,
      [company_id]
    );

    if (rows.length === 0) return null;

    const company = rows[0];
    const expiryDate = new Date(company.subscription_expires_at);
    const now = new Date();
    const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

    return {
      status: company.subscription_status,
      expiresAt: company.subscription_expires_at,
      daysLeft: Math.max(0, daysLeft),
      isExpired: expiryDate < now,
      plan: company.subscription_plan,
      photosLimit: company.photos_limit,
      photosUsed: company.photos_used,
      photosRemaining: Math.max(0, company.photos_limit - company.photos_used),
      percentageUsed: Math.round((company.photos_used / company.photos_limit) * 100),
    };
  } catch (error) {
    console.error("Error getting subscription status:", error);
    throw error;
  }
};

/* Create invoice in database */
export const createInvoice = async (
  company_id,
  amount,
  type = "subscription", // subscription, ai_usage, etc
  description,
  metadata = {}
) => {
  try {
    const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 9000)}`;

    const [result] = await db.execute(
      `INSERT INTO invoices (company_id, invoice_number, amount, currency, status, type, description, meta, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        company_id,
        invoiceNumber,
        amount,
        "USD",
        "pending", // pending -> paid (after payment)
        type,
        description,
        JSON.stringify(metadata),
      ]
    );

    return {
      invoiceId: result.insertId,
      invoiceNumber: invoiceNumber,
    };
  } catch (error) {
    console.error("Error creating invoice:", error);
    throw error;
  }
};

/* Update invoice status to paid */
export const markInvoiceAsPaid = async (
  invoiceId,
  paymentIntentId,
  paymentMethod = "stripe"
) => {
  try {
    const [result] = await db.execute(
      `UPDATE invoices 
       SET status = 'paid', 
           meta = JSON_SET(COALESCE(meta, '{}'), '$.payment_intent_id', ?),
           updated_at = NOW()
       WHERE id = ?`,
      [paymentIntentId, invoiceId]
    );

    return result.affectedRows > 0;
  } catch (error) {
    console.error("Error marking invoice as paid:", error);
    throw error;
  }
};

/* Get all invoices for company */
export const getCompanyInvoices = async (
  company_id,
  filters = { page: 1, limit: 20, status: null }
) => {
  try {
    const offset = (filters.page - 1) * filters.limit;
    let query = `SELECT * FROM invoices WHERE company_id = ?`;
    const params = [company_id];

    // Filter by status if provided
    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(filters.limit, offset);

    const [rows] = await db.execute(query, params);
    return rows;
  } catch (error) {
    console.error("Error getting company invoices:", error);
    throw error;
  }
};

/* Get invoice count for company */
export const getInvoiceCount = async (company_id, status = null) => {
  try {
    let query = `SELECT COUNT(*) as count FROM invoices WHERE company_id = ?`;
    const params = [company_id];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    const [rows] = await db.execute(query, params);
    return rows[0]?.count || 0;
  } catch (error) {
    console.error("Error getting invoice count:", error);
    throw error;
  }
};

/* Get single invoice details */
export const getInvoiceDetails = async (invoiceId) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM invoices WHERE id = ? LIMIT 1`,
      [invoiceId]
    );

    return rows[0] || null;
  } catch (error) {
    console.error("Error getting invoice details:", error);
    throw error;
  }
};

/* Get revenue summary for company (for dashboard) */
export const getRevenueSummary = async (company_id) => {
  try {
    const [rows] = await db.execute(
      `SELECT 
        COUNT(*) as total_invoices,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_invoices,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_paid,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
        AVG(amount) as average_invoice_value
       FROM invoices WHERE company_id = ?`,
      [company_id]
    );

    return rows[0] || {};
  } catch (error) {
    console.error("Error getting revenue summary:", error);
    throw error;
  }
};
