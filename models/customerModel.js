import db from "../config/db.js";

// ✅ Add new customer
export const addCustomerModel = async ({ company_id, name, email, phone, address }) => {
  const [result] = await db.execute(
    `INSERT INTO customers (company_id, name, email, phone, address, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [company_id, name, email, phone, address]
  );
  return result.insertId;
};

// ✅ Get all customers by company_id
// export const getCustomersModel = async (company_id) => {
//   const [rows] = await db.execute(
//     `SELECT * FROM customers WHERE company_id = ? ORDER BY id DESC`,
//     [company_id]
//   );
//   return rows;
// };


export const getCustomersModel = async (company_id = null) => {
  if (!company_id) {
    // admin → get all customers
    const [rows] = await db.execute(`SELECT * FROM customers`);
    return rows;
  }

  const [rows] = await db.execute(
    `SELECT * FROM customers WHERE company_id = ?`,
    [company_id]
  );
  return rows;
};


// ✅ Get single customer by email (for duplication check)
export const getCustomerByEmailModel = async (email, company_id) => {
  const [rows] = await db.execute(
    `SELECT id FROM customers WHERE email = ? AND company_id = ? LIMIT 1`,
    [email, company_id]
  );
  return rows[0];
};

// ✅ Update customer
export const updateCustomerModel = async (id, { name, email, phone, address }) => {
  await db.execute(
    `UPDATE customers 
     SET name = ?, email = ?, phone = ?, address = ? 
     WHERE id = ?`,
    [name, email, phone, address, id]
  );
};

// ✅ Delete customer
export const deleteCustomerModel = async (id) => {
  await db.execute(`DELETE FROM customers WHERE id = ?`, [id]);
};


export const getCustomerByIdModel = async (company_id, customer_id) => {
  const [rows] = await db.execute(
    `SELECT * FROM customers WHERE id = ? AND company_id = ? LIMIT 1`,
    [customer_id, company_id]
  );
  return rows.length ? rows[0] : null;
};
