import db from "../config/db.js";

export const getDashboardStats = async (company_id = null, owner_id = null, userOnly = false) => {
  console.log("ðŸŸ¢ getDashboardStats called =>", { company_id, owner_id, userOnly });

  // ------------------------------------------------------------
  // âœ… 1. ADMIN â†’ Global Counts (No Filters)
  // ------------------------------------------------------------
  if (!company_id && !owner_id && !userOnly) {
    const [[customers]] = await db.execute(`SELECT COUNT(*) AS total_customers FROM customers`);
    const [[companies]] = await db.execute(`SELECT COUNT(*) AS total_companies FROM companies`);
    const [[exterminators]] = await db.execute(`SELECT COUNT(*) AS total_exterminators FROM users`);
    const [[meetings]] = await db.execute(`SELECT COUNT(*) AS total_meetings FROM meetings`);
    const [[photos]] = await db.execute(`SELECT COUNT(*) AS total_photos FROM photos`);
    const [[locations]] = await db.execute(`SELECT COUNT(*) AS total_locations FROM locations`);

    return {
      total_customers: customers.total_customers,
      total_companies: companies.total_companies,
      total_exterminators: exterminators.total_exterminators,
      total_meetings: meetings.total_meetings,
      total_photos: photos.total_photos,
      total_locations: locations.total_locations,
    };
  }

  // ------------------------------------------------------------
  // âœ… 2. COMPANY OWNER / USER â†’ Existing Logic
  // ------------------------------------------------------------

  // Customers of specific company
  let total_customers = 0;
  if (company_id) {
    const [[customers]] = await db.execute(
      `SELECT COUNT(*) AS total_customers 
       FROM customers 
       WHERE company_id = ?`,
      [company_id]
    );
    total_customers = customers?.total_customers || 0;
  }

  // Exterminators under company owner
  let total_exterminators = 0;
  if (owner_id) {
    const [[exterminators]] = await db.execute(
      `SELECT COUNT(*) AS total_exterminators 
       FROM users 
       WHERE added_by = ? 
         AND (is_company_owner = 0 OR is_company_owner IS NULL)`,
      [owner_id]
    );
    total_exterminators = exterminators?.total_exterminators || 0;
  }

  // Meetings linked to company
  let total_meetings = 0;
  if (company_id) {
    const [[meetings]] = await db.execute(
      `SELECT COUNT(*) AS total_meetings 
       FROM meetings 
       WHERE company_id = ?`,
      [company_id]
    );
    total_meetings = meetings?.total_meetings || 0;
  }

  // Photos of company
  let total_photos = 0;
  if (company_id) {
    const [[photos]] = await db.execute(
      `SELECT COUNT(p.id) AS total_photos
       FROM photos p
       JOIN users u ON p.exterminator_id = u.id
       WHERE u.company_id = ?`,
      [company_id]
    );
    total_photos = photos?.total_photos || 0;
  }

  // Locations of company
  let total_locations = 0;
  if (company_id) {
    const [[locations]] = await db.execute(
      `SELECT COUNT(*) AS total_locations 
       FROM locations 
       WHERE company_id = ?`,
      [company_id]
    );
    total_locations = locations?.total_locations || 0;
  }

  const result = {
    total_customers,
    total_exterminators,
    total_meetings,
    total_photos,
    total_locations,
  };

  console.log("ðŸ“Š Dashboard Stats Result:", result);
  return result;
};


export const getExterminatorDashboardStats = async (exterminator_id, filter) => {

  // -----------------------------------
  // âœ… DATE CONDITION
  // -----------------------------------
  let dateCondition = "";
  let params = [exterminator_id];

  if (filter === "today") {
    dateCondition = "AND DATE(p.created_at) = CURDATE()";
  } 
  else if (filter === "week") {
    dateCondition = "AND YEARWEEK(p.created_at, 1) = YEARWEEK(CURDATE(), 1)";
  } 
  else if (filter === "month") {
    dateCondition = "AND MONTH(p.created_at) = MONTH(CURDATE()) AND YEAR(p.created_at) = YEAR(CURDATE())";
  }

  // -----------------------------------
  // âœ… 1. Total Meetings
  // -----------------------------------
  const [[meetings]] = await db.execute(
    `SELECT COUNT(DISTINCT p.meeting_id) AS total_meetings
     FROM photos p
     WHERE p.exterminator_id = ?
     ${dateCondition}`,
    params
  );

  // -----------------------------------
  // âœ… 2. Total Photos
  // -----------------------------------
  const [[photos]] = await db.execute(
    `SELECT COUNT(*) AS total_photos
     FROM photos p
     WHERE p.exterminator_id = ?
     ${dateCondition}`,
    params
  );

  // -----------------------------------
  // âœ… 3. Total Insects (SUM)
  // -----------------------------------
  const [[insects]] = await db.execute(
    `SELECT COALESCE(SUM(ar.pest_count), 0) AS total_insects
     FROM ai_results ar
     JOIN photos p ON ar.photo_id = p.id
     WHERE p.exterminator_id = ?
     ${dateCondition}`,
    params
  );

  // -----------------------------------
  // âœ… 4. Unique Insect Types
  // -----------------------------------
  const [[uniqueInsects]] = await db.execute(
    `SELECT COUNT(DISTINCT ar.detected_pest) AS unique_insects
     FROM ai_results ar
     JOIN photos p ON ar.photo_id = p.id
     WHERE p.exterminator_id = ?
     ${dateCondition}`,
    params
  );

  return {
    total_meetings: meetings.total_meetings || 0,
    total_photos: photos.total_photos || 0,
    total_insects: insects.total_insects || 0,
    unique_insects: uniqueInsects.unique_insects || 0,
  };
};



export const getExterminatorRecentActivity = async (
  exterminator_id,
  limit
) => {

  const [rows] = await db.execute(
    `
    (
      -- 🟢 Photos analyzed
      SELECT 
        'photos' AS type,
        CONCAT(COUNT(p.id), ' new photos analyzed') AS title,
        COALESCE(l.name, 'Unknown location') AS location,
        MAX(p.created_at) AS activity_date
      FROM photos p
      LEFT JOIN locations l ON l.id = p.location_id
      WHERE p.exterminator_id = ?
      GROUP BY l.id
    )

    UNION ALL

    (
      -- 🟢 Meeting completed
      SELECT
        'meeting' AS type,
        'Meeting completed' AS title,
        COALESCE(l.name, 'Unknown location') AS location,
        m.created_at AS activity_date
      FROM meetings m
      LEFT JOIN locations l ON l.id = m.location_id
      WHERE m.exterminator_id = ?
        AND m.status = 'completed'
    )

    UNION ALL

    (
      -- 🟢 Insects detected
      SELECT
        'insects' AS type,
        CONCAT(SUM(ar.pest_count), ' insects detected') AS title,
        COALESCE(l.name, 'Unknown location') AS location,
        MAX(ar.created_at) AS activity_date
      FROM ai_results ar
      INNER JOIN photos p ON p.id = ar.photo_id
      LEFT JOIN locations l ON l.id = p.location_id
      WHERE p.exterminator_id = ?
      GROUP BY l.id
    )

    ORDER BY activity_date DESC
    LIMIT ?
    `,
    [
      exterminator_id,
      exterminator_id,
      exterminator_id,
      limit,
    ]
  );

  return rows.map(row => ({
    type: row.type,
    title: row.title,
    location: row.location,
    date: row.activity_date,
  }));
};