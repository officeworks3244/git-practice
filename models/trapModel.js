import db from "../config/db.js";

// ✅ Create new trap
export const createTrap = async (trapData) => {
  const {
    company_id,
    customer_id,
    location_id,
    trap_code,
    name,
    trap_type,
    installed_at,
    last_inspected_at,
    status,
    latitude,
    longitude,
    notes,
    added_by,
  } = trapData;

  const [result] = await db.execute(
    `INSERT INTO traps 
      (company_id, customer_id, location_id, trap_code, name, trap_type, installed_at, last_inspected_at, status, latitude, longitude, notes, added_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      company_id,
      customer_id || null,
      location_id || null,
      trap_code,
      name,
      trap_type,
      installed_at || null,
      last_inspected_at || null,
      status || 1,
      latitude || null,
      longitude || null,
      notes || null,
      added_by || null,
    ]
  );

  return result.insertId;
};

// ✅ Fetch traps (with optional filters)
export const fetchTraps = async (company_id, { customer_id, location_id }) => {
  let query = `
    SELECT *
    FROM traps
    WHERE is_deleted = 0 AND company_id = ?
  `;
  const params = [company_id];

  if (customer_id) {
    query += " AND customer_id = ?";
    params.push(customer_id);
  }

  if (location_id) {
    query += " AND location_id = ?";
    params.push(location_id);
  }

  const [rows] = await db.execute(query, params);
  return rows;
};

// ✅ Update trap
export const updateTrap = async (id, company_id, trapData) => {
  const fields = [];
  const values = [];

  Object.entries(trapData).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) return;

  const query = `
    UPDATE traps
    SET ${fields.join(", ")}
    WHERE id = ? AND company_id = ? AND is_deleted = 0
  `;

  values.push(id, company_id);
  await db.execute(query, values);
};

// ✅ Soft delete trap
export const deleteTrap = async (id, company_id) => {
  await db.execute(
    "UPDATE traps SET is_deleted = 1 WHERE id = ? AND company_id = ?",
    [id, company_id]
  );
};
