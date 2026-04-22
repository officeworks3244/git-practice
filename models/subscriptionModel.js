import db from "../config/db.js";

export const createSubscriptionModel = async ({
  name,
  price,
  currency,
  interval_type,
  details
}) => {
  const [result] = await db.execute(
    `
    INSERT INTO subscriptions
    (name, price, currency, interval_type, details, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'active', NOW())
    `,
    [
      name,
      price,
      currency,
      interval_type,
      JSON.stringify(details)
    ]
  );

  return result.insertId;
};

export const getAllSubscriptionsModel = async () => {
  const [rows] = await db.execute(`
    SELECT
      id,
      name,
      price,
      currency,
      interval_type,
      details,
      status,
      created_at
    FROM subscriptions
    WHERE status = 'active'
    ORDER BY price ASC
  `);

  return rows;
};

export const getSubscriptionByIdModel = async (id) => {
  const [[row]] = await db.execute(
    `SELECT * FROM subscriptions WHERE id = ? AND status = 'active'`,
    [id]
  );

  return row || null;
};


export const updateSubscriptionModel = async (id, data) => {
  const fields = [];
  const values = [];

  if (data.name !== undefined) {
    fields.push("name = ?");
    values.push(data.name);
  }

  if (data.price !== undefined) {
    fields.push("price = ?");
    values.push(data.price);
  }

  if (data.currency !== undefined) {
    fields.push("currency = ?");
    values.push(data.currency);
  }

  if (data.interval_type !== undefined) {
    fields.push("interval_type = ?");
    values.push(data.interval_type);
  }

  if (data.details !== undefined) {
    fields.push("details = ?");
    values.push(JSON.stringify(data.details));
  }

  if (fields.length === 0) return false;

  values.push(id);

  const [result] = await db.execute(
    `UPDATE subscriptions SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  return result.affectedRows > 0;
};
