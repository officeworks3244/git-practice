import e from "express";
import db from "../config/db.js";

export const getAllUsersByCompany = async (company_id, current_user_id) => {
  try {
    // console.log("🟢 getAllUsersByCompany called =>", { company_id, current_user_id });

    // ✅ Company owner ke liye sirf wohi users jo unhone add kiye hain
    const [users] = await db.execute(
      `SELECT 
        u.id,
        u.company_id,
        c.name,             -- ✅ Company name from companies table
        u.added_by,
        u.first_name,
        u.last_name,
        u.email,
        u.is_company_owner,
        u.auth_type,
        u.profile_image,
        u.google_id,
        u.google_avatar,
        u.facebook_id,
        u.facebook_avatar,
        u.apple_id,
        u.apple_avatar,
        u.is_active,
        u.is_deleted,
        u.status,
        u.created_at,
        u.updated_at
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id  -- ✅ Join with companies
       WHERE u.company_id = ? 
         AND u.added_by = ?
         AND (u.is_company_owner = 0 OR u.is_company_owner IS NULL)
         AND u.is_deleted = 0
       ORDER BY u.created_at DESC`,
      [company_id, current_user_id]
    );

    return users;
  } catch (error) {
    console.error("❌ Error in getAllUsersByCompany:", error);
    throw error;
  }
};


export const getAllUsersForAdmin = async () => {
  try {

    const [users] = await db.execute(
      `SELECT 
  u.id,
  u.company_id,
  u.added_by,
  u.first_name,
  u.last_name,
  u.email,
  u.is_company_owner,
  u.auth_type,
  u.profile_image,
  u.google_id,
  u.google_avatar,
  u.facebook_id,
  u.facebook_avatar,
  u.apple_id,
  u.apple_avatar,
  u.is_active,
  u.is_deleted,
  u.status,
  u.created_at,
  u.updated_at,
  c.name AS name
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
WHERE u.is_deleted = 0
ORDER BY u.created_at DESC`
    );

    return users;

  } catch (error) {
    console.error("❌ Error in getAllUsersForAdmin:", error);
    throw error;
  }
};



// ✅ Check if email already exists
export const checkEmailExists = async (email) => {
  try {
    const [existing] = await db.execute(
      "SELECT id FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1",
      [email]
    );
    return existing.length > 0;
  } catch (error) {
    console.error("❌ Error in checkEmailExists:", error);
    throw error;
  }
};

// ✅ Get user by ID
export const getUserById = async (id) => {
  try {
    const [user] = await db.execute(
      `SELECT 
        id, company_id, added_by, first_name, last_name, email,
        is_company_owner, auth_type, profile_image, google_id, google_avatar,
        facebook_id, facebook_avatar, apple_id, apple_avatar, is_active,
        is_deleted, otp_code, otp_expiry, status, created_at, updated_at
       FROM users 
       WHERE id = ? AND is_deleted = 0`,
      [id]
    );

    return user.length > 0 ? user[0] : null;
  } catch (error) {
    console.error("❌ Error in getUserById:", error);
    throw error;
  }
};

// ✅ Update existing user
export const updateUser = async (userId, userData, companyId = null, addedBy = null) => {
  try {
    const {
      first_name,
      last_name,
      email,
      password,
      profile_image,
      is_active
    } = userData;

    // ✅ Build SET clause and params dynamically
    const updates = [];
    const params = [];

    if (first_name) {
      updates.push("first_name = ?");
      params.push(first_name);
    }
    if (last_name) {
      updates.push("last_name = ?");
      params.push(last_name);
    }
    if (email) {
      updates.push("email = ?");
      params.push(email);
    }
    if (password) {
      updates.push("password = ?");
      params.push(password);
    }
    if (profile_image !== undefined) {
      updates.push("profile_image = ?");
      params.push(profile_image);
    }
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      params.push(is_active);
    }

    updates.push("updated_at = NOW()");

    // ✅ Add conditions to params array
    params.push(userId);
    if (companyId) params.push(companyId);
    if (addedBy) params.push(addedBy);

    // ✅ Build WHERE clause based on role
    let whereClause = "id = ? AND is_deleted = 0";
    if (companyId && addedBy) {
      whereClause += " AND company_id = ? AND added_by = ?";
    }

    // ✅ Execute update
    const [result] = await db.execute(
      `UPDATE users 
       SET ${updates.join(", ")}
       WHERE ${whereClause}`,
      params
    );

    if (result.affectedRows === 0) {
      throw new Error("User not found or you don't have permission to edit");
    }

    // ✅ Return updated user data
    const [updatedUser] = await db.execute(
      `SELECT 
        id, company_id, added_by, first_name, last_name, email,
        is_company_owner, auth_type, profile_image, is_active,
        status, created_at, updated_at
       FROM users 
       WHERE id = ? AND is_deleted = 0`,
      [userId]
    );

    return updatedUser[0];
  } catch (error) {
    console.error("❌ Error in updateUser:", error);
    throw error;
  }
};

// ✅ Create new user
export const createUser = async (userData) => {
  try {
    const {
      first_name,
      last_name,
      email,
      password,
      company_id,
      added_by,
      profile_image = null,
      is_active = 1
    } = userData;

    // ✅ Insert new user
    const [result] = await db.execute(
      `INSERT INTO users 
        (first_name, last_name, email, password, company_id, added_by, 
         is_company_owner, auth_type, profile_image, is_active, is_deleted, status, 
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'normal', ?, ?, 0, 'active', NOW(), NOW())`,
      [first_name, last_name, email, password, company_id, added_by, profile_image, is_active]
    );

    // ✅ Return inserted user data
    const [newUser] = await db.execute(
      `SELECT 
        id, company_id, added_by, first_name, last_name, email, 
        is_company_owner, auth_type, profile_image, is_active, is_deleted, 
        status, created_at, updated_at
       FROM users 
       WHERE id = ?`,
      [result.insertId]
    );

    return newUser[0];
  } catch (error) {
    console.error("❌ Error in createUser:", error);
    throw error;
  }
};


export const assignstatuse = {
  // Get user with permission (company owner only)
  getUserWithPermission: async (userId, companyId, addedBy) => {
    try {
      const [user] = await db.execute(
        `SELECT id, company_id, added_by, is_active, first_name, last_name, email
         FROM users
         WHERE id = ? AND company_id = ? AND added_by = ? AND is_deleted = 0`,
        [userId, companyId, addedBy]
      );
      return user[0] || null;
    } catch (error) {
      console.error("❌ Error in getUserWithPermission:", error);
      throw error;
    }
  },

  // Toggle user status (company owner only)
  toggleUserStatus: async (userId, newStatus, companyId, addedBy) => {
    try {
      const [result] = await db.execute(
        `UPDATE users 
         SET is_active = ?, updated_at = NOW()
         WHERE id = ? AND company_id = ? AND added_by = ? AND is_deleted = 0`,
        [newStatus, userId, companyId, addedBy]
      );
      return result;
    } catch (error) {
      console.error("❌ Error in toggleUserStatus:", error);
      throw error;
    }
  },

  // Toggle user status (admin — no restrictions)
  toggleUserStatusAsAdmin: async (userId, newStatus) => {
    try {
      const [result] = await db.execute(
        `UPDATE users 
         SET is_active = ?, updated_at = NOW()
         WHERE id = ? AND is_deleted = 0`,
      [newStatus, userId]
      );
      return result;
    } catch (error) {
      console.error("❌ Error in toggleUserStatusAsAdmin:", error);
      throw error;
    }
  },

  // Get user by ID
  getUserById: async (userId) => {
    try {
      const [user] = await db.execute(
        `SELECT id, first_name, last_name, email, is_active, company_id, added_by
         FROM users
         WHERE id = ? AND is_deleted = 0`,
        [userId]
      );
      return user[0] || null;
    } catch (error) {
      console.error("❌ Error in getUserById:", error);
      throw error;
    }
  },
};
