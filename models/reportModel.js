import db from "../config/db.js";



export const fetchMeetingReport = async (
  company_id,
  start_date,
  end_date,
  location_id,
  customer_id
) => {
  try {
    let query = `
      SELECT
        m.id AS meeting_id,
        m.title AS meeting_title,
        m.scheduled_date,

        l.id AS location_id,
        l.name AS location_name,
        l.address AS location_address,
        l.city AS location_city,
        l.state AS location_state,

        c.id AS customer_id,
        c.name AS customer_name,
        c.email AS customer_email,
        c.phone AS customer_phone,

        p.id AS photo_id,
        p.created_at AS photo_created_at,

        -- ✅ AI Species Results (pest_count NOT confidence!)
        ar.id AS species_result_id,
        ar.detected_pest,
        ar.pest_count,

        -- ✅ AI Families Results
        af.id AS family_result_id,
        af.family_name,
        af.family_count

      FROM meetings m
      JOIN photos p ON p.meeting_id = m.id
      LEFT JOIN ai_results ar ON ar.photo_id = p.id
      LEFT JOIN ai_families af ON af.photo_id = p.id
      JOIN locations l ON p.location_id = l.id
      JOIN customers c ON p.customer_id = c.id

      WHERE m.company_id = ?
    `;

    const params = [company_id];

    // ✅ Date filter
    if (start_date && end_date) {
      query += " AND DATE(p.created_at) BETWEEN ? AND ?";
      params.push(start_date, end_date);
    }

    // ✅ Location filter
    if (location_id) {
      query += " AND p.location_id = ?";
      params.push(location_id);
    }

    // ✅ Customer filter
    if (customer_id) {
      query += " AND p.customer_id = ?";
      params.push(customer_id);
    }

    query += " ORDER BY m.id DESC, p.id DESC";

    const [rows] = await db.execute(query, params);

    // ================================================================
    // 🧠 GROUPING: MEETING → PHOTOS → (SPECIES + FAMILIES)
    // ================================================================
    const meetings = {};

    for (const row of rows) {
      // ✅ Meeting level
      if (!meetings[row.meeting_id]) {
        meetings[row.meeting_id] = {
          meeting_id: row.meeting_id,
          meeting_title: row.meeting_title,
          meeting_date: row.scheduled_date,
          location: {
            id: row.location_id,
            name: row.location_name,
            address: row.location_address,
            city: row.location_city,
            state: row.location_state
          },
          customer: {
            id: row.customer_id,
            name: row.customer_name,
            email: row.customer_email,
            phone: row.customer_phone
          },
          photos: {}
        };
      }

      // ✅ Photo level
      if (!meetings[row.meeting_id].photos[row.photo_id]) {
        meetings[row.meeting_id].photos[row.photo_id] = {
          photo_id: row.photo_id,
          created_at: row.photo_created_at,
          detected_species: [],
          detected_families: []
        };
      }

      // ✅ Species level (pest_count instead of confidence)
      if (row.detected_pest && row.species_result_id) {
        const existingSpecies = meetings[row.meeting_id].photos[row.photo_id].detected_species
          .find(s => s.id === row.species_result_id);
        
        if (!existingSpecies) {
          meetings[row.meeting_id].photos[row.photo_id].detected_species.push({
            id: row.species_result_id,
            species: row.detected_pest,
            count: row.pest_count
          });
        }
      }

      // ✅ Family level (NEW!)
      if (row.family_name && row.family_result_id) {
        const existingFamily = meetings[row.meeting_id].photos[row.photo_id].detected_families
          .find(f => f.id === row.family_result_id);
        
        if (!existingFamily) {
          meetings[row.meeting_id].photos[row.photo_id].detected_families.push({
            id: row.family_result_id,
            family: row.family_name,
            count: row.family_count
          });
        }
      }
    }

    // ✅ Convert photos object → array & calculate totals
    return Object.values(meetings).map(meeting => {
      const photos = Object.values(meeting.photos);
      
      // ✅ Calculate total insects per meeting
      const totalInsects = photos.reduce((sum, photo) => {
        const photoTotal = photo.detected_species.reduce((s, sp) => s + sp.count, 0);
        return sum + photoTotal;
      }, 0);

      // ✅ Get unique species across all photos
      const allSpecies = new Map();
      photos.forEach(photo => {
        photo.detected_species.forEach(sp => {
          if (allSpecies.has(sp.species)) {
            allSpecies.set(sp.species, allSpecies.get(sp.species) + sp.count);
          } else {
            allSpecies.set(sp.species, sp.count);
          }
        });
      });

      // ✅ Get unique families across all photos
      const allFamilies = new Map();
      photos.forEach(photo => {
        photo.detected_families.forEach(fam => {
          if (allFamilies.has(fam.family)) {
            allFamilies.set(fam.family, allFamilies.get(fam.family) + fam.count);
          } else {
            allFamilies.set(fam.family, fam.count);
          }
        });
      });

      return {
        ...meeting,
        photos,
        summary: {
          total_photos: photos.length,
          total_insects: totalInsects,
          unique_species: Array.from(allSpecies.entries()).map(([species, count]) => ({
            species,
            count
          })).sort((a, b) => b.count - a.count),
          unique_families: Array.from(allFamilies.entries()).map(([family, count]) => ({
            family,
            count
          })).sort((a, b) => b.count - a.count)
        }
      };
    });

  } catch (error) {
    console.error("❌ Error fetching meeting report:", error);
    throw new Error(`Failed to fetch meeting report: ${error.message}`);
  }
};

