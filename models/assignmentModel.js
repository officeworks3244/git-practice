import db from "../config/db.js";

/* ✅ Assign exterminator to customer/location */
export const assignCustomerToUser = async (assignmentData) => {
  try {
    const { user_id, customer_id, location_id = null, can_access_all_locations = 0 } = assignmentData;

    const [result] = await db.execute(
      `INSERT INTO user_customer_locations 
        (user_id, customer_id, location_id, can_access_all_locations, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [user_id, customer_id, location_id, can_access_all_locations]
    );

    return result.insertId;
  } catch (error) {
    console.error("❌ Error in assignCustomerToUser:", error);
    throw error;
  }
};

/* ✅ Get all assigned customers + locations for one exterminator */
export const getAssignmentsByUser = async (user_id) => {
  try {
    const [rows] = await db.execute(
      `SELECT 
          ucl.id AS assignment_id,
          c.name AS customer_name,
          c.id AS customer_id,
          l.name AS location_name,
          l.id AS location_id,
          ucl.can_access_all_locations,
          ucl.created_at
        FROM user_customer_locations ucl
        JOIN customers c ON c.id = ucl.customer_id
        LEFT JOIN locations l ON l.id = ucl.location_id
        WHERE ucl.user_id = ?`,
      [user_id]
    );
    return rows;
  } catch (error) {
    console.error("❌ Error in getAssignmentsByUser:", error);
    throw error;
  }
};

/* ✅ Delete or unassign */
export const deleteAssignment = async (assignment_id) => {
  try {
    const [result] = await db.execute(
      `DELETE FROM user_customer_locations WHERE id = ?`,
      [assignment_id]
    );
    return result;
  } catch (error) {
    console.error("❌ Error in deleteAssignment:", error);
    throw error;
  }
};

export const getLocationsByCustomerModel = async (customer_id) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, address, latitude, longitude
       FROM locations 
       WHERE customer_id = ?`,
      [customer_id]
    );
    return rows;
  } catch (error) {
    console.error("❌ Error in getLocationsByCustomerModel:", error);
    throw error;
  }
};

