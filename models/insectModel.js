import db from "../config/db.js";

export const fetchInsectData = async (company_id, start_date, end_date, trap_id, location_id) => {
  let query = `
    SELECT 
      p.id,
      DATE(p.created_at) AS record_date,
      l.name AS location_name,
      t.name AS trap_name,
      p.araneae,
      p.coleoptera,
      p.diptera,
      p.hemiptera,
      p.hymenoptera,
      p.lepidoptera
    FROM photos p
    LEFT JOIN traps t ON p.trap_name = t.name
    LEFT JOIN locations l ON t.location_id = l.id
    WHERE t.company_id = ? 
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

  query += " ORDER BY p.created_at DESC";

  const [rows] = await db.execute(query, params);
  return rows;
};
