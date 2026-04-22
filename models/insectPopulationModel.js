import db from "../config/db.js";

// export const getInsectPopulationData = async ({
//   company_id,
//   start_date,
//   end_date,
//   location_id,
//   meeting_id,
// }) => {

//   // 🛡 Safety check
//   if (!company_id) {
//     throw new Error("company_id is required");
//   }

//   // 🔎 Base conditions
//   let conditions = `
//     WHERE u.company_id = ?
//       AND DATE(p.created_at) BETWEEN ? AND ?
//   `;

//   let params = [company_id, start_date, end_date];

//   if (location_id !== null) {
//     conditions += " AND p.location_id = ?";
//     params.push(location_id);
//   }

//   if (meeting_id !== null) {
//     conditions += " AND p.meeting_id = ?";
//     params.push(meeting_id);
//   }

//   // ==========================
//   // 📈 GRAPH (Date-wise insects)
//   // ==========================
//   const [graphData] = await db.execute(
//     `
//     SELECT 
//       DATE(p.created_at) AS date,
//       SUM(ar.pest_count) AS total_insects
//     FROM ai_results ar
//     JOIN photos p ON ar.photo_id = p.id
//     JOIN users u ON p.exterminator_id = u.id
//     ${conditions}
//     GROUP BY DATE(p.created_at)
//     ORDER BY date ASC
//     `,
//     params
//   );

//   // ==========================
//   // 🐜 FAMILY / ORDER WISE
//   // ==========================
//   const [familyData] = await db.execute(
//     `
//     SELECT 
//       COALESCE(ar.family_name, ar.detected_pest) AS family,
//       SUM(ar.pest_count) AS total
//     FROM ai_results ar
//     JOIN photos p ON ar.photo_id = p.id
//     JOIN users u ON p.exterminator_id = u.id
//     ${conditions}
//     GROUP BY family
//     ORDER BY total DESC
//     `,
//     params
//   );

//   return {
//     graph: graphData,
//     families: familyData,
//   };
// };


export const getInsectPopulationData = async ({
  role,
  company_id,
  start_date,
  end_date,
  location_id,
  meeting_id,
}) => {

  // 🔎 Base conditions
  let conditions = `
    WHERE DATE(p.created_at) BETWEEN ? AND ?
  `;

  let params = [start_date, end_date];

  // 🏢 Company filter (ONLY for non-admin)
  if (role !== "admin") {
    if (!company_id) {
      throw new Error("company_id is required for non-admin users");
    }
    conditions += " AND u.company_id = ?";
    params.push(company_id);
  }

  if (location_id !== null) {
    conditions += " AND p.location_id = ?";
    params.push(location_id);
  }

  if (meeting_id !== null) {
    conditions += " AND p.meeting_id = ?";
    params.push(meeting_id);
  }

  // ==========================
  // 📈 GRAPH DATA
  // ==========================
  const [graphData] = await db.execute(
    `
    SELECT 
      DATE(p.created_at) AS date,
      SUM(ar.pest_count) AS total_insects
    FROM ai_results ar
    JOIN photos p ON ar.photo_id = p.id
    JOIN users u ON p.exterminator_id = u.id
    ${conditions}
    GROUP BY DATE(p.created_at)
    ORDER BY date ASC
    `,
    params
  );

  // ==========================
  // 🐜 FAMILY / ORDER WISE
  // ==========================
  const [familyData] = await db.execute(
    `
    SELECT 
      COALESCE(ar.family_name, ar.detected_pest) AS family,
      SUM(ar.pest_count) AS total
    FROM ai_results ar
    JOIN photos p ON ar.photo_id = p.id
    JOIN users u ON p.exterminator_id = u.id
    ${conditions}
    GROUP BY family
    ORDER BY total DESC
    `,
    params
  );

  return {
    graph: graphData,
    families: familyData,
  };
};
