import db from "../config/db.js";

// ✅ Add Location
export const addLocation = async (
  company_id,
  customer_id,
  name,
  address,
  street,
  city,
  state,
  country,
  post_code,
  latitude,
  longitude,
  status = 1
) => {
  const [result] = await db.execute(
    `INSERT INTO locations 
     (company_id, customer_id, name, address, street, city, state, country, post_code, latitude, longitude, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [company_id, customer_id, name, address, street, city, state, country, post_code, latitude, longitude, status]
  );
  return result.insertId;
};


export const getLocationsWithCustomer = async (company_id, customer_id = null, isAdmin = false) => {
  let query = `
    SELECT 
      l.id AS location_id,
      l.name AS location_name,
      l.address,
      l.street,
      l.city,
      l.state,
      l.country,
      l.post_code,
      l.latitude,
      l.longitude,
      l.status,
      l.created_at,

      c.id AS customer_id,
      c.name AS customer_name,
      c.email AS customer_email,
      c.phone AS customer_phone,
      c.address AS customer_address,

      comp.id AS company_id,
      comp.name AS company_name,
      comp.email AS company_email,
      comp.phone AS company_phone,
      comp.address AS company_address

    FROM locations l
    LEFT JOIN customers c ON l.customer_id = c.id
    LEFT JOIN companies comp ON l.company_id = comp.id
    WHERE 1=1
  `;

  const params = [];

  // 🟢 Admin → No company filter
  if (!isAdmin) {
    query += " AND l.company_id = ?";
    params.push(company_id);
  }

  if (customer_id) {
    query += " AND l.customer_id = ?";
    params.push(customer_id);
  }

  query += " ORDER BY l.id DESC";

  const [rows] = await db.execute(query, params);
  return rows;
};


export const updateLocation = async (id, name, address, latitude, longitude) => {
  const [result] = await db.execute(
    `UPDATE locations 
     SET name = ?, address = ?, latitude = ?, longitude = ? 
     WHERE id = ?`,
    [name, address, latitude, longitude, id]
  );
  return result.affectedRows > 0;
};


export const removeLocation = async (location_id, company_id) => {
  const [result] = await db.execute(
    `DELETE FROM locations 
     WHERE id = ? AND company_id = ?`,
    [location_id, company_id]
  );

  return result.affectedRows;
};

export const fetchTrapStatistics = async (company_id, start_date, end_date, trap_id, location_id) => {
  let query = `
    SELECT 
      t.id AS trap_id,
      t.name AS trap_name,
      l.name AS location_name,
      COUNT(p.id) AS total_photos,
      COUNT(DISTINCT p.exterminator_id) AS unique_exterminators,
      MAX(p.created_at) AS last_activity
    FROM traps t
    LEFT JOIN photos p ON p.trap_name = t.name
    LEFT JOIN locations l ON t.location_id = l.id
    WHERE t.company_id = ? AND t.is_deleted = 0
  `;

  const params = [company_id];

  if (start_date && end_date) {
    query += " AND DATE(p.created_at) BETWEEN ? AND ?";
    params.push(start_date, end_date);
  }

  if (trap_id) {
    query += " AND t.id = ?";
    params.push(trap_id);
  }

  if (location_id) {
    query += " AND t.location_id = ?";
    params.push(location_id);
  }

  query += " GROUP BY t.id, t.name, l.name ORDER BY l.name ASC, t.name ASC";

  const [rows] = await db.execute(query, params);
  return rows;
};


// models/locationModel.js
export const getLocationByIds = async (company_id, location_id) => {
  try {
    const query = `
      SELECT 
        l.id AS location_id,
        l.name AS location_name,
        l.address,
        l.street,
        l.city,
        l.state,
        l.country,
        l.post_code,
        l.latitude,
        l.longitude,
        l.status,
        l.created_at,
        l.updated_at,

        c.id AS customer_id,
        c.name AS customer_name,
        c.email AS customer_email,
        c.phone AS customer_phone,
        c.address AS customer_address,

        comp.id AS company_id,
        comp.name AS company_name,
        comp.email AS company_email,
        comp.phone AS company_phone,
        comp.address AS company_address

      FROM locations l
      LEFT JOIN customers c ON l.customer_id = c.id
      LEFT JOIN companies comp ON l.company_id = comp.id
      WHERE l.company_id = ? AND l.id = ?
    `;

    const params = [company_id, location_id];
    const [rows] = await db.execute(query, params);
    
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error("Get Location By ID Error:", error);
    throw error;
  }
};
