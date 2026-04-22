import db from "../config/db.js";

export const getAllCompaniesWithOwners = async () => {
  const [rows] = await db.execute(`
    SELECT
      c.id AS company_id,
      c.name AS company_name,
      c.is_ai_enabled,
      CASE
        WHEN c.subscription_status = 'active' THEN 'active'
        WHEN c.is_ai_enabled = 1 THEN 'trial'
        ELSE c.subscription_status
      END AS subscription_status,
      c.subscription_expires_at,
      c.created_at AS company_created_at,

      -- 📸 PHOTO LIMIT & USAGE (FROM TABLE)
      c.photos_limit,
      c.photos_used,
      (c.photos_limit - c.photos_used) AS remaining_photos,

      -- 👤 OWNER
      u.id AS owner_id,
      u.first_name AS owner_first_name,
      u.last_name AS owner_last_name,
      u.email AS owner_email,
      u.mobile AS owner_mobile,
      u.city AS owner_city,
      u.country AS owner_country,
      u.auth_type

    FROM companies c
    LEFT JOIN users u 
      ON u.company_id = c.id
      AND u.is_company_owner = 1
      AND u.is_deleted = 0
    ORDER BY c.created_at DESC
  `);

  return rows;
};



export const getCompanyOwnerByCompanyId = async (companyId) => {
  const [rows] = await db.execute(`
    SELECT
      -- 👤 OWNER DETAILS
      u.id AS owner_id,
      u.first_name,
      u.last_name,
      u.email,
      u.mobile,
      u.city,
      u.country,
      u.auth_type,
      u.profile_image,
      u.is_active,
      u.created_at AS owner_created_at,

      -- 🏢 COMPANY DETAILS
      c.id AS company_id,
      c.name AS company_name,
      c.is_ai_enabled,
      CASE
        WHEN c.subscription_status = 'active' THEN c.subscription_plan
        WHEN c.is_ai_enabled = 1 THEN 'Free Trial'
        ELSE c.subscription_plan
      END AS subscription_plan,
      CASE
        WHEN c.subscription_status = 'active' THEN 'active'
        WHEN c.is_ai_enabled = 1 THEN 'trial'
        ELSE c.subscription_status
      END AS subscription_status,
      c.subscription_expires_at,
      c.email AS company_email,
      c.phone AS company_phone,
      c.address AS company_address,
      c.created_at AS company_created_at,

      -- 📸 PHOTO LIMITS (FROM COMPANIES TABLE)
      c.photos_limit,
      c.photos_used,
      (c.photos_limit - c.photos_used) AS remaining_photos,

      -- 📊 STATS
      (
        SELECT COUNT(*)
        FROM customers
        WHERE company_id = c.id
      ) AS total_customers,

      (
        SELECT COUNT(*)
        FROM meetings
        WHERE company_id = c.id
      ) AS total_meetings,

      (
        SELECT COUNT(*)
        FROM users
        WHERE company_id = c.id
          AND is_company_owner = 0
          AND is_deleted = 0
      ) AS total_exterminators

    FROM users u
    JOIN companies c ON c.id = u.company_id
    WHERE u.company_id = ?
      AND u.is_company_owner = 1
      AND u.is_deleted = 0
    LIMIT 1
  `, [companyId]);

  return rows[0] || null;
};



export const getInvoicesByCompanyIdModel = async (
  companyId,
  { page = 1, limit = 20 }
) => {
  const offset = (page - 1) * limit;

  const [rows] = await db.execute(`
    SELECT
      id,
      company_id,
      invoice_number,
      amount,
      currency,
      status,
      type,
      meta,
      created_at,
      updated_at
    FROM invoices
    WHERE company_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, [companyId, Number(limit), offset]);

  return rows;
};

export const getInvoicesCountByCompanyIdModel = async (companyId) => {
  const [[row]] = await db.execute(`
    SELECT COUNT(*) AS total
    FROM invoices
    WHERE company_id = ?
  `, [companyId]);

  return row.total;
};

export const updateCompanyAiAccessModel = async (companyId, isAiEnabled) => {
  const [result] = await db.execute(
    `UPDATE companies
     SET is_ai_enabled = ?, updated_at = NOW()
     WHERE id = ?
       AND COALESCE(subscription_status, 'inactive') <> 'active'`,
    [isAiEnabled ? 1 : 0, companyId]
  );

  return result.affectedRows > 0;
};

export const getCompanyAiAccessMetaModel = async (companyId) => {
  const [rows] = await db.execute(
    `SELECT id, is_ai_enabled, subscription_status
     FROM companies
     WHERE id = ?
     LIMIT 1`,
    [companyId]
  );

  return rows[0] || null;
};
