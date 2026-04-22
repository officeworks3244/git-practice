import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {
  getAllUsersByCompany, getAllUsersForAdmin, checkEmailExists,
  createUser, updateUser, assignstatuse
} from "../models/usersModel.js";
import db from "../config/db.js";

export const getAllUsers = async (req, res) => {
  try {
    // ✅ Get token from header
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Token missing"
      });
    }

    // ✅ Decode token to extract user info
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id: user_id, company_id, role } = decoded;



    let users;

    // ✅ ADMIN → can see all users
    if (role === "admin") {
      users = await getAllUsersForAdmin();
    }

    // ✅ COMPANY OWNER → can see only users added by him in his company
    else if (role === "company_owner") {
      if (!company_id) {
        return res.status(400).json({
          success: false,
          message: "Company ID missing in token"
        });
      }
      users = await getAllUsersByCompany(company_id, user_id);
    }

    // ❌ Deny access for regular users
    else {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Admin or Company Owner allowed."
      });
    }

    // ✅ Success response
    return res.json({
      success: true,
      message: "Users fetched successfully",
      data: users,
      total: users.length
    });

  } catch (err) {
    console.error("❌ GetAllUsers Error:", err);

    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    }

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while fetching users",
      error: err.message,
    });
  }
};

// ✅ Get single user by ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Get token from header
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Token missing"
      });
    }

    // ✅ Decode token to extract user info
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id: user_id, company_id, role } = decoded;

    let user;

    if (role === "admin") {
      // ✅ Admin can access any user
      const [users] = await db.execute(
        `SELECT 
          id, company_id, added_by, first_name, last_name, email,
          is_company_owner, auth_type, profile_image, is_active, status,
          created_at, updated_at
         FROM users 
         WHERE id = ? AND is_deleted = 0`,
        [id]
      );
      user = users[0];
    }
    else if (role === "company_owner") {
      // ✅ Company owner can only access users from their company added by them
      const [users] = await db.execute(
        `SELECT 
          id, company_id, added_by, first_name, last_name, email,
          is_company_owner, auth_type, profile_image, is_active, status,
          created_at, updated_at
         FROM users 
         WHERE id = ? 
           AND company_id = ? 
           AND added_by = ?
           AND is_deleted = 0`,
        [id, company_id, user_id]
      );
      user = users[0];
    }
    else {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.json({
      success: true,
      message: "User fetched successfully",
      data: user
    });

  } catch (err) {
    console.error("❌ GetUserById Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};


// ✅ Get profile (current user) with all required details for profile page
export const getProfile = async (req, res) => {
  try {
    // ✅ Get token from header
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized - Token missing" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id: current_user_id } = decoded;

    // ✅ Fetch all required user details for profile page
    const [rows] = await db.execute(
      `SELECT 
        u.id,
        u.first_name, 
        u.last_name, 
        u.email,
        u.mobile,
        u.vat,
        u.profile_image,
        u.google_avatar,
        u.facebook_avatar,
        u.apple_avatar,
        u.zip,
        u.city,
        u.country,
        u.status,
        u.is_company_owner,
        u.auth_type,
        c.name AS company_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.id = ? AND u.is_deleted = 0`,
      [current_user_id]
    );

    const user = rows[0];
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // ✅ Format response according to profile page requirements
    const profileData = {
      // PHOTO
      profile_image: user.profile_image || user.google_avatar || user.facebook_avatar || user.apple_avatar || null,

      // NAME
      first_name: user.first_name,
      last_name: user.last_name,
      full_name: `${user.first_name} ${user.last_name}`,

      // EMAIL
      email: user.email,

      // COMPANY
      company_name: user.company_name || "Not set",
      is_company_owner: user.is_company_owner,

      // VAT NUMBER
      vat: user.vat || "Not set",

      // ADDRESS - Combine fields or show "Not set"
      address: user.city && user.country ? `${user.city}, ${user.country}` : "Not set",

      // ZIP & CITY
      zip: user.zip || "Not set",
      city: user.city || "Not set",

      // COUNTRY
      country: user.country || "Not set",

      // PHONE
      mobile: user.mobile || "Not set",

      // STATUS
      status: user.status,
      is_active: user.is_active
    };

    return res.json({
      success: true,
      message: "Profile fetched successfully",
      data: profileData
    });
  } catch (err) {
    console.error("❌ GetProfile Error:", err);
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token expired" });
    }
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};


export const editUser = async (req, res) => {
  try {
    const { id } = req.params;

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id: current_user_id, company_id, role } = decoded;

    if (!["admin", "company_owner"].includes(role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { first_name, last_name, email, password, is_active, remove_image } = req.body;

    // 🔹 Get existing user (for old image)
    const [existing] = await db.execute(
      "SELECT profile_image FROM users WHERE id = ? AND is_deleted = 0",
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let profile_image = undefined;

    // ✅ New image uploaded
    if (req.file) {
      profile_image = `${PROFILE_IMAGE_PATH}/${req.file.filename}`;

      // delete old image
      if (existing[0].profile_image) {
        const oldPath = path.join(process.cwd(), existing[0].profile_image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    // ✅ Remove image explicitly
    if (remove_image === "1") {
      profile_image = null;

      if (existing[0].profile_image) {
        const oldPath = path.join(process.cwd(), existing[0].profile_image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    let hashedPassword;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const updatedUser = await updateUser(
      id,
      {
        first_name,
        last_name,
        email,
        password: hashedPassword,
        profile_image,
        is_active: is_active !== undefined ? Number(is_active) : undefined
      },
      role === "company_owner" ? company_id : null,
      role === "company_owner" ? current_user_id : null
    );

    res.json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });

  } catch (err) {
    console.error("❌ EditUser Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ✅ Edit existing user
// export const editUser = async (req, res) => {
//   try {
//     const { id } = req.params;

//     // Get token
//     const token = req.headers.authorization?.split(" ")[1];
//     if (!token) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized - Token missing",
//       });
//     }

//     // Decode token
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const { id: current_user_id, company_id, role } = decoded;

//     if (role !== "admin" && role !== "company_owner") {
//       return res.status(403).json({
//         success: false,
//         message: "Access denied. Only Admin or Company Owner can edit users.",
//       });
//     }

//     const { first_name, last_name, email, password, is_active } = req.body;

//     // Handle profile image
//     let profile_image = undefined;

//     if (req.file) {
//       // ✅ ALWAYS SAVE FULL RELATIVE PATH
//       profile_image = `uploads/profile_pictures/${req.file.filename}`;
//     } else if (req.body.profile_image === null || req.body.profile_image === "") {
//       profile_image = null;
//     }

//     // Handle password hashing
//     let hashedPassword;
//     if (password) {
//       hashedPassword = await bcrypt.hash(password, 10);
//     }

//     // Update user
//     const updatedUser = await updateUser(
//       id,
//       {
//         first_name,
//         last_name,
//         email,
//         password: hashedPassword,
//         profile_image,
//         is_active: is_active !== undefined ? Number(is_active) : undefined
//       },
//       role === "company_owner" ? company_id : null,
//       role === "company_owner" ? current_user_id : null
//     );

//     return res.json({
//       success: true,
//       message: "User updated successfully",
//       data: updatedUser,
//     });

//   } catch (err) {
//     console.error("❌ EditUser Error:", err);

//     if (err.name === "JsonWebTokenError") {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid token"
//       });
//     }

//     if (err.name === "TokenExpiredError") {
//       return res.status(401).json({
//         success: false,
//         message: "Token expired"
//       });
//     }

//     if (err.code === 'ER_DUP_ENTRY') {
//       return res.status(409).json({
//         success: false,
//         message: "Email already in use by another user"
//       });
//     }

//     if (err.message === "User not found or you don't have permission to edit") {
//       return res.status(404).json({
//         success: false,
//         message: err.message
//       });
//     }

//     return res.status(500).json({
//       success: false,
//       message: "Server error while updating user",
//       error: err.message,
//     });
//   }
// };



// ✅ Add New User
export const addUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Token missing",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id: added_by, company_id, role } = decoded;

    if (role !== "admin" && role !== "company_owner") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Admin or Company Owner can add users.",
      });
    }

    const { first_name, last_name, email, password } = req.body;

    // ✅ ALWAYS SAVE FULL RELATIVE PATH
    let profile_image = null;
    if (req.file) {
      profile_image = `uploads/profile_pictures/${req.file.filename}`;
    }

    // Validate required fields
    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, email and password are required",
      });
    }

    // Check email exists
    const emailExists = await checkEmailExists(email);
    if (emailExists) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await createUser({
      first_name,
      last_name,
      email,
      password: hashedPassword,
      company_id,
      added_by,
      profile_image,
    });

    return res.status(201).json({
      success: true,
      message: "User added successfully",
      data: newUser,
    });

  } catch (err) {
    console.error("❌ AddUser Error:", err);

    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    }

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired"
      });
    }

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    if (err.message === "Email already exists") {
      return res.status(409).json({
        success: false,
        message: err.message
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while adding user",
      error: err.message,
    });
  }
};




export const toggleUserStatus = async (req, res) => {
  try {
    const { id: userIdToUpdate } = req.params;

    // Read Token
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id: currentUserId, company_id, role } = decoded;

    // Allow both Admin + Company Owner
    if (role !== "company_owner" && role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Admin or Company Owner can toggle user status.",
      });
    }

    let user;

    if (role === "admin") {
      // Admin can change any user
      user = await assignstatuse.getUserById(userIdToUpdate);
    } else {
      // Company owner → restrictions
      user = await assignstatuse.getUserWithPermission(
        userIdToUpdate,
        company_id,
        currentUserId
      );
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found or you don't have permission.",
      });
    }

    // Toggle Status
    const currentStatus = user.is_active;
    const newStatus = currentStatus === 1 ? 0 : 1;

    let result;

    if (role === "admin") {
      // Admin update without company_id/added_by restriction
      result = await assignstatuse.toggleUserStatusAsAdmin(userIdToUpdate, newStatus);
    } else {
      // Company owner update
      result = await assignstatuse.toggleUserStatus(
        userIdToUpdate,
        newStatus,
        company_id,
        currentUserId
      );
    }

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Failed to update user status",
      });
    }

    return res.json({
      success: true,
      message: `User ${newStatus === 1 ? "activated" : "deactivated"} successfully`,
      data: {
        user_id: userIdToUpdate,
        user_name: `${user.first_name} ${user.last_name}`,
        previous_status: currentStatus,
        new_status: newStatus,
      },
    });

  } catch (err) {
    console.error("❌ ToggleUserStatus Error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error while updating user status",
      error: err.message,
    });
  }
};





export const testDbConnection = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1");
    
    return res.json({
      success: true,
      message: "Database connected successfully",
      result: rows,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }
};
