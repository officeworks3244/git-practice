import db from "../config/db.js";

const DEFAULT_TRIAL_PHOTO_LIMIT = Number(process.env.DEFAULT_TRIAL_PHOTO_LIMIT ?? 100);

export const uploadPhoto = async (data) => {
  const { meeting_id, exterminator_id, customer_id, image_base64, location_id } = data;

  const [result] = await db.execute(
    `INSERT INTO photos 
      (meeting_id, exterminator_id, customer_id, location_id, image_url, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [meeting_id, exterminator_id, customer_id, location_id, image_base64]
  );

  return result.insertId;
};

// ================================================================
// ✅ Save AI Species Result WITH FAMILY
// ================================================================
export const saveAIResult = async ({ photo_id, detected_pest, pest_count, family_name }) => {
  await db.execute(
    `INSERT INTO ai_results 
      (photo_id, detected_pest, pest_count, family_name, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [photo_id, detected_pest, pest_count, family_name]
  );
};
// ================================================================
// ✅ Save AI Family Result (NEW FUNCTION!)
// ================================================================
export const saveAIFamily = async ({ photo_id, family_name, family_count }) => {
  await db.execute(
    `INSERT INTO ai_families 
      (photo_id, family_name, family_count, created_at)
     VALUES (?, ?, ?, NOW())`,
    [photo_id, family_name, family_count]
  );
};

// ================================================================
// ✅ Check Company Photo Limit
// ================================================================
export const checkPhotoLimit = async (company_id) => {
  const [rows] = await db.execute(
    `SELECT photos_limit, photos_used, subscription_status, is_ai_enabled FROM companies WHERE id = ?`,
    [company_id]
  );

  if (rows.length === 0) {
    throw new Error("Company not found");
  }

  const {
    photos_limit,
    photos_used,
    subscription_status,
    is_ai_enabled,
  } = rows[0];

  const paidSubscriptionActive = subscription_status === "active";
  const trialActive = !paidSubscriptionActive && Boolean(is_ai_enabled);
  const effectiveLimit =
    trialActive && (!photos_limit || Number(photos_limit) <= 0)
      ? DEFAULT_TRIAL_PHOTO_LIMIT
      : Number(photos_limit ?? 0);
  const used = Number(photos_used ?? 0);

  return {
    hasLimit: used < effectiveLimit,
    photos_used: used,
    photos_limit: effectiveLimit,
    remaining: Math.max(effectiveLimit - used, 0),
    is_trial: trialActive,
  };
};

// ================================================================
// ✅ Increment Photos Used Count
// ================================================================
export const incrementPhotosUsed = async (company_id) => {
  const [result] = await db.execute(
    `UPDATE companies SET photos_used = photos_used + 1, updated_at = NOW() WHERE id = ?`,
    [company_id]
  );
  return result.affectedRows > 0;
};



export const getPhotosByMeeting = async (meeting_id) => {
  try {
    await db.execute("SET SESSION group_concat_max_len = 1000000");

    const [photos] = await db.execute(
      `SELECT 
        p.id,
        p.meeting_id,
        p.exterminator_id,
        p.customer_id,
        p.location_id,
        p.image_url,
        p.created_at,

        -- Exterminator
        CONCAT(u.first_name, ' ', u.last_name) AS exterminator_name,
        u.email AS exterminator_email,

        -- Location
        l.name AS location_name,
        l.address AS location_address,
        l.street AS location_street,
        l.city AS location_city,
        l.state AS location_state,
        l.country AS location_country,
        l.post_code AS location_post_code,
        l.latitude AS location_latitude,
        l.longitude AS location_longitude,

        -- Customer
        c.name AS customer_name,
        c.email AS customer_email,
        c.phone AS customer_phone,
        c.address AS customer_address,

        -- 🐜 Species (COUNT ONLY)
        GROUP_CONCAT(
          DISTINCT CONCAT(
            '{"species":"', ar.detected_pest,
            '","count":', ar.pest_count,
            ',"id":', ar.id, '}'
          )
          ORDER BY ar.pest_count DESC
          SEPARATOR '|||'
        ) AS ai_results,

        -- 🧬 Families (COUNT ONLY)
        GROUP_CONCAT(
          DISTINCT CONCAT(
            '{"family":"', af.family_name,
            '","count":', af.family_count,
            '}'
          )
          ORDER BY af.family_count DESC
          SEPARATOR '|||'
        ) AS ai_families

      FROM photos p
      LEFT JOIN ai_results ar ON ar.photo_id = p.id
      LEFT JOIN ai_families af ON af.photo_id = p.id
      LEFT JOIN users u ON p.exterminator_id = u.id
      LEFT JOIN locations l ON p.location_id = l.id
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE p.meeting_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC`,
      [meeting_id]
    );

    // 🔁 Parse JSON strings
    const processedPhotos = photos.map(photo => ({
      ...photo,
      image_url: photo.image_url,

      ai_results: photo.ai_results
        ? photo.ai_results.split('|||').map(item => JSON.parse(item))
        : [],

      ai_families: photo.ai_families
        ? photo.ai_families.split('|||').map(item => JSON.parse(item))
        : []
    }));

    return processedPhotos;

  } catch (error) {
    console.error("❌ Error fetching photos by meeting:", error);
    throw new Error("Failed to fetch photos");
  }
};







// Get photos by exterminator with AI results (OPTIMIZED) - FIX APPLIED
export const getPhotosByExterminator = async (exterminator_id) => {
  const [photos] = await db.execute(
    `SELECT 
        p.id AS photo_id,
        p.meeting_id,
        p.exterminator_id,
        p.customer_id,
        p.image_url,
        p.created_at,

        -- Exterminator/User
        u.first_name AS exterminator_first_name,
        u.last_name AS exterminator_last_name,
        u.email AS exterminator_email,
        u.mobile AS exterminator_phone,

        -- Company info
        c.name AS company_name,

        -- Customer
        cust.name AS customer_name,
        cust.email AS customer_email,
        cust.phone AS customer_phone,

        -- Location (FIXED: Using meeting table for location)
        l.id AS location_id, /* location_id ko yahan se utha lein */
        l.name AS location_name,
        l.address AS location_address,
        l.city AS location_city,
        l.state AS location_state,
        l.country AS location_country,

        -- AI Results
        GROUP_CONCAT(
          CONCAT(
            '{"species":"', COALESCE(ai.detected_pest, ''), 
            '","confidence":', COALESCE(ai.confidence, 0), 
            '","id":', COALESCE(ai.id, 0), '}'
          ) 
          ORDER BY ai.confidence DESC
          SEPARATOR '|||'
        ) as ai_results

      FROM photos p
      JOIN users u ON p.exterminator_id = u.id
      JOIN companies c ON u.company_id = c.id
      LEFT JOIN customers cust ON p.customer_id = cust.id
      
      -- 🔥 FIX: Location should be joined via meetings table
      LEFT JOIN meetings m ON p.meeting_id = m.id
      LEFT JOIN locations l ON m.location_id = l.id
      
      LEFT JOIN ai_results ai ON ai.photo_id = p.id

      WHERE p.exterminator_id = ?
      GROUP BY 
          p.id, p.meeting_id, p.exterminator_id, p.customer_id,
          p.image_url, p.created_at,
          u.first_name, u.last_name, u.email, u.mobile,
          c.name, cust.name, cust.email, cust.phone,
          l.id, l.name, l.address, l.city, l.state, l.country
          /* GROUP BY mein l.id, l.state bhi add kar diya */

      ORDER BY p.created_at DESC
      LIMIT 200`,
    [exterminator_id]
  );

  // ... (rest of the JS code is fine)
};


export const getPhotosByCompany = async (company_id) => {
  try {
    await db.execute("SET SESSION group_concat_max_len = 1000000");

    const [photos] = await db.execute(
      `
      SELECT 
        p.id AS photo_id,
        p.meeting_id,
        p.image_url,
        p.created_at,

        -- Exterminator
        u.id AS exterminator_id,
        u.first_name AS exterminator_first_name,
        u.last_name AS exterminator_last_name,

        -- Company
        c.id AS company_id,
        c.name AS company_name,

        -- Customer
        cust.id AS customer_id,
        cust.name AS customer_name,

        -- Location fallback
        COALESCE(pl.id, ml.id) AS location_id,
        COALESCE(pl.name, ml.name, 'No Location') AS location_name,
        COALESCE(pl.country, ml.country, '') AS location_country,

        -- ✅ AI RESULTS (SPECIES + FAMILY TOGETHER)
        GROUP_CONCAT(
          DISTINCT CONCAT(
            '{"id":', ai.id,
            ',"species":"', ai.detected_pest,
            '","family":"', ai.family_name,
            '","count":', ai.pest_count,
            '}'
          )
          ORDER BY ai.pest_count DESC
          SEPARATOR '|||'
        ) AS ai_results

      FROM photos p
      JOIN users u ON p.exterminator_id = u.id
      JOIN companies c ON u.company_id = c.id
      LEFT JOIN customers cust ON p.customer_id = cust.id

      LEFT JOIN locations pl ON p.location_id = pl.id
      LEFT JOIN meetings m ON p.meeting_id = m.id
      LEFT JOIN locations ml ON m.location_id = ml.id

      -- ✅ ONLY ONE AI TABLE (NO DUPLICATES)
      LEFT JOIN ai_results ai ON ai.photo_id = p.id

      WHERE u.company_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
      `,
      [company_id]
    );

    return photos.map(photo => ({
      ...photo,
      exterminator_name: `${photo.exterminator_first_name} ${photo.exterminator_last_name}`,
      ai_results: photo.ai_results
        ? photo.ai_results.split('|||').map(j => JSON.parse(j))
        : []
    }));

  } catch (error) {
    console.error("❌ getPhotosByCompany error:", error);
    throw error;
  }
};




// Get all photos with AI results (ADMIN ONLY)
export const getAllPhotos = async () => {
  await db.execute("SET SESSION group_concat_max_len = 1000000");

  const [photos] = await db.execute(`
    SELECT 
      p.id AS photo_id,
      p.meeting_id,
      p.image_url,
      p.created_at,

      -- Company
      c.id AS company_id,
      c.name AS company_name,

      -- Customer
      cust.id AS customer_id,
      cust.name AS customer_name,

      -- Exterminator
      u.id AS exterminator_id,
      u.first_name AS exterminator_first_name,
      u.last_name AS exterminator_last_name,

      -- ✅ AI RESULTS (NO confidence)
      GROUP_CONCAT(
        DISTINCT CONCAT(
          '{"id":', ai.id,
          ',"species":"', ai.detected_pest,
          '","family":"', ai.family_name,
          '","count":', ai.pest_count,
          '}'
        )
        ORDER BY ai.pest_count DESC
        SEPARATOR '|||'
      ) AS ai_results

    FROM photos p
    JOIN users u ON p.exterminator_id = u.id
    JOIN companies c ON u.company_id = c.id
    LEFT JOIN customers cust ON p.customer_id = cust.id
    LEFT JOIN ai_results ai ON ai.photo_id = p.id

    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT 200
  `);

  return photos.map(photo => ({
    ...photo,
    exterminator_name: `${photo.exterminator_first_name} ${photo.exterminator_last_name}`,
    ai_results: photo.ai_results
      ? photo.ai_results.split('|||').map(j => JSON.parse(j))
      : []
  }));
};


// Delete photo by id
export const deletePhoto = async (id) => {
  const [result] = await db.execute(
    `DELETE FROM photos WHERE id = ?`,
    [id]
  );

  return result.affectedRows > 0;
};


