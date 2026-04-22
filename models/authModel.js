import db from "../config/db.js";
import bcrypt from "bcryptjs";



// ✅ Create a normal user (just DB insert, no response)
export const createNormalUser = async (data) => {
    const { first_name, last_name, email, password } = data;

    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ USER INACTIVE BY DEFAULT
    const [result] = await db.execute(
        `INSERT INTO users 
        (first_name, last_name, email, password, auth_type, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'normal', 0, NOW(), NOW())`,
        [first_name, last_name, email, hashedPassword]
    );

    console.log("✅ Inactive user created with ID:", result.insertId);
    return result.insertId;
};


// ✅ Register normal user - Helper function (NO req/res)
export const registerNormalUser = async (data) => {
    const { first_name, last_name, email, password } = data;

    // ✅ Validate required fields
    if (!first_name || !last_name || !email || !password) {
        throw new Error("First name, last name, email and password are required");
    }

    // ✅ Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
        throw new Error("User already exists");
    }

    // ✅ Create and return userId
    const userId = await createNormalUser({
        first_name,
        last_name,
        email,
        password,
    });

    return userId;
};
// ✅ Get user by email
export const getUserByEmail = async (email) => {
  const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0];
};

// ✅ Get user by ID
export const getUserById = async (id) => {
  const [rows] = await db.execute("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0];
};


export const registerSocialUser = async (data) => {
  console.log('Starting social user registration with data:', data);
  
  const {
    first_name,
    last_name,
    email,
    auth_type,
    google_id = null,
    google_avatar = null,
    facebook_id = null,
    facebook_avatar = null,
    apple_id = null,
    apple_avatar = null,
  } = data;

  // ✅ Validate required fields
  if (!first_name || !email || !auth_type) {
    throw new Error('First name, email and auth_type are required');
  }

  // ✅ Validate auth_type
  const validAuthTypes = ['google', 'facebook', 'apple'];
  if (!validAuthTypes.includes(auth_type)) {
    throw new Error(`Invalid auth_type. Must be one of: ${validAuthTypes.join(', ')}`);
  }

  try {
    console.log('Executing SQL insert for social user...');
    
    // ✅ Prepare parameters based on auth_type
    let params = [
      first_name,
      last_name || '',
      email,
      auth_type,
      auth_type === 'google' ? google_id : null,
      auth_type === 'google' ? google_avatar : null,
      auth_type === 'facebook' ? facebook_id : null,
      auth_type === 'facebook' ? facebook_avatar : null,
      auth_type === 'apple' ? apple_id : null,
      auth_type === 'apple' ? apple_avatar : null,
    ];

    const [result] = await db.execute(
      `INSERT INTO users 
        (first_name, last_name, email, auth_type, 
         google_id, google_avatar, 
         facebook_id, facebook_avatar, 
         apple_id, apple_avatar, 
         is_active, is_company_owner, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, NOW(), NOW())`,
      params
    );
    
    console.log('✅ Social user inserted successfully with ID:', result.insertId);
    return result.insertId;
  } catch (error) {
    console.error('❌ Error in registerSocialUser:', error);
    
    // ✅ Check for duplicate email
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('Duplicate')) {
      throw new Error('User with this email already exists');
    }
    
    throw error;
  }
};

// ✅ Update Google user info
export const updateGoogleUser = async (id, google_id, google_avatar) => {
  await db.execute(
    `UPDATE users SET google_id = ?, google_avatar = ? WHERE id = ?`,
    [google_id, google_avatar, id]
  );
};

// ✅ Update Facebook user info
export const updateFacebookUser = async (id, facebook_id, facebook_avatar) => {
  await db.execute(
    `UPDATE users SET facebook_id = ?, facebook_avatar = ? WHERE id = ?`,
    [facebook_id, facebook_avatar, id]
  );
};

// ✅ Update Apple user info
export const updateAppleUser = async (id, apple_id, apple_avatar) => {
  await db.execute(
    `UPDATE users SET apple_id = ?, apple_avatar = ? WHERE id = ?`,
    [apple_id, apple_avatar, id]
  );
};


// ✅ Store OTP in database
export const storeOtp = async (email, otp) => {
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  await db.execute(
    `UPDATE users SET otp_code = ?, otp_expiry = ? WHERE email = ?`,
    [otp, otpExpiry, email]
  );
  
  return otp;
};

// ✅ Verify OTP
export const verifyOtp = async (email, otp) => {
  const [rows] = await db.execute(
    `SELECT otp_code, otp_expiry FROM users WHERE email = ?`,
    [email]
  );
  
  if (rows.length === 0) return false;
  
  const user = rows[0];
  
  // Check if OTP exists and not expired
  if (!user.otp_code || !user.otp_expiry) return false;
  
  const now = Date.now();
  const expiry = new Date(user.otp_expiry).getTime();
  const storedOtp = String(user.otp_code).trim();
  const providedOtp = String(otp).trim();
  
  if (!Number.isFinite(expiry)) return false;
  
  if (now > expiry) return false; // OTP expired
  
  return storedOtp === providedOtp;
};

// ✅ Clear OTP after successful verification
export const clearOtp = async (email) => {
  await db.execute(
    `UPDATE users SET otp_code = NULL, otp_expiry = NULL WHERE email = ?`,
    [email]
  );
};


// ✅ Activate user after OTP verification
export const activateUser = async (email) => {
  await db.execute(
    `UPDATE users SET is_active = 1, otp_code = NULL, otp_expiry = NULL WHERE email = ?`,
    [email]
  );
};

// ✅ Update user profile
export const updateUserProfile = async (userId, data) => {
  // Build dynamic SET clause and values array for the query
  const validFields = ['first_name', 'last_name', 'phone', 'avatar'];
  const updates = [];
  const values = [];
  
  for (const [key, value] of Object.entries(data)) {
    if (validFields.includes(key)) {
      updates.push(`${key} = ?`);
      values.push(value);
    }
  }
  
  if (updates.length === 0) return null;
  
  values.push(userId); // Add userId for WHERE clause
  
  const [result] = await db.execute(
    `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
    values
  );
  
  if (result.affectedRows > 0) {
    const [rows] = await db.execute("SELECT * FROM users WHERE id = ?", [userId]);
    const user = rows[0];
    if (user) {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }
  }
  return null;
};
