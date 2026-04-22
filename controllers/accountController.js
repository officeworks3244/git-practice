import jwt from "jsonwebtoken";
import {
  getUserProfileModel,
  updateUserProfileModel,
  getInvoicesByCompanyModel,
  getPaymentsByCompanyModel,
  getCompanySubscriptionModel,
  getCompanyAccessStatusModel,
  renewCompanySubscriptionModel,
  cancelCompanySubscriptionModel
} from "../models/accountModel.js";
import db from "../config/db.js";
import fs from "fs";
import path from "path";
import multer from "multer";
const uploadPath = "uploads/profile_images";

/* Helper: extract token */
const extractTokenData = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new Error("No token provided");
  const token = authHeader.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded;
};

/* GET /api/account/profile */
export const getProfile = async (req, res) => {
  try {
    const decoded = extractTokenData(req);
    const user_id = decoded.id;
    const profile = await getUserProfileModel(user_id);
    return res.json({ success: true, data: profile });
  } catch (err) {
    console.error("getProfile error:", err);
    return res.status(401).json({ success: false, message: err.message || "Unauthorized" });
  }
};


export const updateProfile = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const decoded = extractTokenData(req);
    const user_id = decoded.id;
    const updateData = req.body;

    console.log("Update request for user:", user_id);
    console.log("Update data:", updateData);

    // Get current user info
    const [users] = await connection.execute(`SELECT * FROM users WHERE id = ?`, [user_id]);
    const currentUser = users[0];
    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userUpdateData = {};
    const companyUpdateData = {};

    const userFields = [
      "first_name",
      "last_name",
      "email",
      "mobile",
      "vat",
      "zip",
      "city",
      "country",
      "profile_image"
    ];

    const companyFields = ["name", "email", "phone", "address"];

    Object.keys(updateData).forEach((key) => {
      if (userFields.includes(key)) userUpdateData[key] = updateData[key];
      if (companyFields.includes(key)) companyUpdateData[key] = updateData[key];
    });

    // ✅ If profile image updated and user has social avatars, also update them
    if (updateData.profile_image) {
      const imageUrl = `${process.env.BASE_URL}/${updateData.profile_image}`;
      
      if (currentUser.google_avatar) userUpdateData.google_avatar = imageUrl;
      if (currentUser.facebook_avatar) userUpdateData.facebook_avatar = imageUrl;
      if (currentUser.apple_avatar) userUpdateData.apple_avatar = imageUrl;
    }

    // ✅ Update user info
    if (Object.keys(userUpdateData).length > 0) {
      const keys = Object.keys(userUpdateData);
      const values = Object.values(userUpdateData);
      const setClause = keys.map((key) => `${key} = ?`).join(", ");
      values.push(user_id);

      await connection.execute(
        `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = ?`,
        values
      );
    }

    // ✅ Update company info if needed
    if (Object.keys(companyUpdateData).length > 0 && currentUser.company_id) {
      const keys = Object.keys(companyUpdateData);
      const values = Object.values(companyUpdateData);
      const setClause = keys.map((key) => `${key} = ?`).join(", ");
      values.push(currentUser.company_id);

      await connection.execute(
        `UPDATE companies SET ${setClause}, updated_at = NOW() WHERE id = ?`,
        values
      );
    }

    await connection.commit();
    return res.json({ success: true, message: "Profile updated successfully" });
  } catch (err) {
    await connection.rollback();
    console.error("updateProfile error:", err);
    return res.status(500).json({ success: false, message: "Server error: " + err.message });
  } finally {
    connection.release();
  }
};



// Ensure folder exists
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `user_${Date.now()}${ext}`);
  },
});

export const upload = multer({ storage });



export const uploadProfileImage = async (req, res) => {
  try {
    const decoded = extractTokenData(req);
    const user_id = decoded.id;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file uploaded" });
    }

    // ✅ CORRECT PATH
    const imagePath = `uploads/profile_pictures/${req.file.filename}`;
    const imageUrl = `/${imagePath}`;

    const [users] = await db.execute(
      `SELECT * FROM users WHERE id = ?`,
      [user_id]
    );

    const user = users[0];
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let updateSql = `UPDATE users SET profile_image = ?, updated_at = NOW()`;
    const params = [imageUrl];

    if (user.google_avatar) {
      updateSql += `, google_avatar = ?`;
      params.push(imageUrl);
    }
    if (user.facebook_avatar) {
      updateSql += `, facebook_avatar = ?`;
      params.push(imageUrl);
    }
    if (user.apple_avatar) {
      updateSql += `, apple_avatar = ?`;
      params.push(imageUrl);
    }

    updateSql += ` WHERE id = ?`;
    params.push(user_id);

    await db.execute(updateSql, params);

    res.json({
      success: true,
      message: "Profile image updated successfully",
      image: imageUrl,
    });
  } catch (err) {
    console.error("uploadProfileImage error:", err);
    res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
};


/* GET /api/account/invoices?limit=20&page=1 */
export const getInvoices = async (req, res) => {
  try {
    const decoded = extractTokenData(req);
    const company_id = decoded.company_id;
    const { page = 1, limit = 20 } = req.query;
    const invoices = await getInvoicesByCompanyModel(company_id, { page: +page, limit: +limit });
    return res.json({ success: true, data: invoices });
  } catch (err) {
    console.error("getInvoices error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* GET /api/account/payments */
export const getPayments = async (req, res) => {
  try {
    const decoded = extractTokenData(req);
    const company_id = decoded.company_id;
    const payments = await getPaymentsByCompanyModel(company_id);
    return res.json({ success: true, data: payments });
  } catch (err) {
    console.error("getPayments error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* GET /api/account/subscription */
export const getSubscription = async (req, res) => {
  try {
    const decoded = extractTokenData(req);
    const company_id = decoded.company_id;
    const sub = await getCompanySubscriptionModel(company_id);
    return res.json({ success: true, data: sub });
  } catch (err) {
    console.error("getSubscription error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* GET /api/account/access-status */
export const getAccessStatus = async (req, res) => {
  try {
    const decoded = extractTokenData(req);
    const company_id = decoded.company_id;
    const access = await getCompanyAccessStatusModel(company_id);

    if (!access) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    return res.json({
      success: true,
      data: access,
    });
  } catch (err) {
    console.error("getAccessStatus error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* POST /api/account/subscription/renew
   Body: { plan: "1000_photos", amount: 100, months: 1, payment_info: {...} }
*/
export const renewSubscription = async (req, res) => {
  try {
    const decoded = extractTokenData(req);
    const company_id = decoded.company_id;
    const { plan, amount, months = 1, payment_info = {} } = req.body;

    // server-side: create invoice, record payment via payment provider (not implemented here)
    const result = await renewCompanySubscriptionModel(company_id, { plan, amount, months, payment_info });

    return res.json({ success: true, message: "Subscription renewed", data: result });
  } catch (err) {
    console.error("renewSubscription error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* POST /api/account/subscription/cancel */
export const cancelSubscription = async (req, res) => {
  try {
    const decoded = extractTokenData(req);
    const company_id = decoded.company_id;
    const result = await cancelCompanySubscriptionModel(company_id);
    return res.json({ success: true, message: "Subscription canceled", data: result });
  } catch (err) {
    console.error("cancelSubscription error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
