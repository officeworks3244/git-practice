import bcrypt from "bcryptjs";
import { sendOtpEmail } from "../utils/mailer.js";
import jwt from "jsonwebtoken";
import {
    getUserByEmail,
    registerNormalUser,
    registerSocialUser,
    storeOtp,
    verifyOtp,
    clearOtp, updateGoogleUser,
    updateFacebookUser,
    activateUser
} from "../models/authModel.js";
import db from "../config/db.js";

// ✅ Helper function for OTP generation
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// ✅ 1. Register with OTP
export const registerUser = async (req, res) => {
    try {
        const { first_name, last_name, email, password, company_name } = req.body;
        const isAiEnabled = true;

        if (!first_name || !last_name || !email || !password || !company_name) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        // ✅ Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format",
            });
        }

        // ✅ Check if user already exists
        const existingUser = await getUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "User already exists",
            });
        }

        // ✅ Check if company already exists
        const [companyCheck] = await db.execute(
            `SELECT id FROM companies WHERE LOWER(name) = LOWER(?) LIMIT 1`,
            [company_name]
        );

        if (companyCheck.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Company name already exists",
            });
        }

        // ✅ 1. Create User (inactive)
        const userId = await registerNormalUser({
            first_name,
            last_name,
            email,
            password,
        });

        // ✅ 2. Create Company
        const defaultTrialPhotoLimit = Number(process.env.DEFAULT_TRIAL_PHOTO_LIMIT ?? 100);
        const [companyRes] = await db.execute(
            `INSERT INTO companies (name, subscription_status, is_ai_enabled, photos_limit, photos_used, created_at, updated_at)
      VALUES (?, 'trial', ?, ?, 0, NOW(), NOW())`,
            [company_name, isAiEnabled ? 1 : 0, isAiEnabled ? defaultTrialPhotoLimit : 0]
        );

        // ✅ 3. Update user's company_id
        await db.execute(
            `UPDATE users SET company_id = ?, is_company_owner = 1 WHERE id = ?`,
            [companyRes.insertId, userId]
        );

        // ✅ 4. Generate OTP
        const otp = generateOtp();
        console.log(`Generated OTP for ${email}: ${otp}`);
        
        // ✅ 5. Try to send email first
        const emailResult = await sendOtpEmail(email, otp, first_name, "verification");
        
        if (!emailResult.success) {
            console.error("Email sending failed:", emailResult.message);
            
            // Clean up the user if email fails
            await db.execute(`DELETE FROM users WHERE id = ?`, [userId]);
            await db.execute(`DELETE FROM companies WHERE id = ?`, [companyRes.insertId]);
            
            return res.status(500).json({
                success: false,
                message: "Failed to send OTP email",
                debug: emailResult.message // Add debug info
            });
        }
        
        // ✅ 6. Store OTP only if email was sent successfully
        await storeOtp(email, otp);
        
        // ✅ 7. Send Response (user inactive)
        res.status(201).json({
            success: true,
            message: "User registered successfully. Please verify OTP.",
            data: {
                user_id: userId,
                company_id: companyRes.insertId,
                email: email,
                is_active: false,
                need_otp_verification: false,
                is_ai_enabled: isAiEnabled
            },
        });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message,
        });
    }
};


// ✅ 2. Verify OTP (Without Token)
export const verifyOtpController = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required",
            });
        }

        // ✅ Verify OTP
        const isValidOtp = await verifyOtp(email, otp);

        if (!isValidOtp) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP",
            });
        }

        // ✅ Activate user and clear OTP
        const user = await getUserByEmail(email);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (Number(user.is_active) === 1) {
            return res.status(200).json({
                success: true,
                message: "OTP verified successfully",
            });
        }

        await activateUser(email);
        await clearOtp(email);

        // ✅ Simple success response - NO TOKEN
        res.status(200).json({
            success: true,
            message: "OTP verified successfully. Your account is now active. Please login.",
        });
    } catch (err) {
        console.error("OTP Verification Error:", err);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message,
        });
    }
};

// ✅ 3. Resend OTP
export const resendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required",
            });
        }

        // ✅ Check if user exists
        const user = await getUserByEmail(email);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // ✅ Generate and send new OTP
        const otp = await storeOtp(email, generateOtp());
        const emailResult = await sendOtpEmail(email, otp, user.first_name, "verification");

        if (!emailResult.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to send OTP email",
            });
        }

        res.status(200).json({
            success: true,
            message: "OTP sent successfully",
        });
    } catch (err) {
        console.error("Resend OTP Error:", err);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message,
        });
    }
};

// ✅ 4. Forgot Password - Send OTP (Only for normal users)
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required",
            });
        }

        // ✅ Check if user exists
        const user = await getUserByEmail(email);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found with this email",
            });
        }

        // ✅ Check if user is normal user (not social login)
        if (user.auth_type !== 'normal') {
            return res.status(400).json({
                success: false,
                message: `This account was created with ${user.auth_type} login. Please use ${user.auth_type} to sign in.`,
                auth_type: user.auth_type
            });
        }

        // ✅ Check if account is active (OTP verified)
        if (user.is_active === 0) {
            return res.status(403).json({
                success: false,
                message: "Account not verified. Please verify your OTP first.",
                need_otp_verification: true,
                email: user.email
            });
        }

        // ✅ Generate and send OTP for password reset
        const otp = await storeOtp(email, generateOtp());
        const emailResult = await sendOtpEmail(email, otp, user.first_name, "password_reset");

        if (!emailResult.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to send OTP email",
            });
        }

        res.status(200).json({
            success: true,
            message: "Password reset OTP sent successfully",
        });
    } catch (err) {
        console.error("Forgot Password Error:", err);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message,
        });
    }
};

// ✅ 5. Reset Password with OTP (Only for normal users)
export const resetPassword = async (req, res) => {
    try {
        const { email, otp, new_password, newPassword } = req.body;
        const passwordToUpdate = new_password || newPassword;

        if (!email || !otp || !passwordToUpdate) {
            return res.status(400).json({
                success: false,
                message: "Email, OTP and new password are required",
            });
        }

        // ✅ Check if user exists and is normal user
        const user = await getUserByEmail(email);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (user.auth_type !== 'normal') {
            return res.status(400).json({
                success: false,
                message: `Password reset not allowed for ${user.auth_type} accounts.`,
                auth_type: user.auth_type
            });
        }

        // ✅ Verify OTP
        const isValidOtp = await verifyOtp(email, otp);

        if (!isValidOtp) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP",
            });
        }

        // ✅ Hash new password and update
        const hashedPassword = await bcrypt.hash(passwordToUpdate, 10);
        await db.execute(
            `UPDATE users SET password = ?, otp_code = NULL, otp_expiry = NULL WHERE email = ?`,
            [hashedPassword, email]
        );

        res.status(200).json({
            success: true,
            message: "Password reset successfully",
        });
    } catch (err) {
        console.error("Reset Password Error:", err);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message,
        });
    }
};






export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        /* =========================
          ✅ ADMIN LOGIN
        ========================= */
        if (email === process.env.ADMIN_EMAIL) {
            if (password !== process.env.ADMIN_PASSWORD) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid admin credentials",
                });
            }

            const token = jwt.sign(
                {
                    id: 0,
                    email,
                    isAdmin: true,
                    role: "admin",
                    company_id: 0,
                },
                process.env.JWT_SECRET,
                { expiresIn: "7d" }
            );

            return res.status(200).json({
                success: true,
                message: "Admin login successful",
                token,
                data: {
                    id: 0,
                    email,
                    role: "admin",
                },
            });
        }

        /* =========================
          ✅ NORMAL USER LOGIN
        ========================= */
        const user = await getUserByEmail(email);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // ❌ Block social-login users
        if (user.auth_type !== "normal") {
            return res.status(400).json({
                success: false,
                message: `This account was created using ${user.auth_type}. Please login with ${user.auth_type}.`,
                auth_type: user.auth_type,
            });
        }

        // ❌ Block inactive users
        if (user.is_active === 0) {
            return res.status(403).json({
                success: false,
                message: "Your account is deactivated. Contact your company owner.",
            });
        }

        // ✅ Password check
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        /* =========================
          ✅ ROLE DETERMINATION
        ========================= */
        let role = "exterminator"; // default

        if (user.is_company_owner === 1) {
            role = "company_owner";
        } else if (user.is_exterminator === 1) {
            role = "exterminator";
        }

        /* =========================
          ✅ JWT TOKEN
        ========================= */
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                isAdmin: false,
                role,
                company_id: user.company_id,
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        const { password: _, ...safeUser } = user;

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            data: {
                ...safeUser,
                role,
            },
        });

    } catch (err) {
        console.error("Login Error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message,
        });
    }
};


export const socialLogin = async (req, res) => {
  try {
    const {
      email,
      auth_type,
      google_id,
      facebook_id,
      apple_id,
      google_avatar,
      facebook_avatar,
      apple_avatar,
    } = req.body;

    console.log("🟦 Incoming Social Login:", { email, auth_type });

    if (!email || !auth_type) {
      console.log("❌ Missing email or auth_type");
      return res.status(400).json({
        success: false,
        message: "Missing email or auth_type",
      });
    }

    // ✅ Fetch user
    const user = await getUserByEmail(email);
    console.log("🟩 Found User:", user ? user.id : "No user found");

    if (!user) {
      console.log("❌ User not found in DB");
      return res.status(404).json({
        success: false,
        message: "Account not found. Please sign up first.",
        need_signup: true,
      });
    }

    // ✅ Account inactive?
    if (user.is_active === 0) {
      console.log("⚠️ Account inactive:", user.email);
      return res.status(403).json({
        success: false,
        message: "Account not verified yet. Please verify your email/OTP.",
        need_otp_verification: true,
        email: user.email,
      });
    }

    // ✅ Update social IDs if needed
    if (auth_type === "google" && google_id && !user.google_id) {
      console.log("🔄 Updating Google ID for user:", user.id);
      await updateGoogleUser(user.id, google_id, google_avatar || null);
    } else if (auth_type === "facebook" && facebook_id && !user.facebook_id) {
      console.log("🔄 Updating Facebook ID for user:", user.id);
      await updateFacebookUser(user.id, facebook_id, facebook_avatar || null);
    } else if (auth_type === "apple" && apple_id && !user.apple_id) {
      console.log("🔄 Updating Apple ID for user:", user.id);
      await updateAppleUser(user.id, apple_id, apple_avatar || null);
    }

    // ✅ Reload user data after update
    const updatedUser = await getUserByEmail(email);
    console.log("🟢 Updated User Fetched:", updatedUser);

    // ✅ Force numeric comparison to avoid "1" vs 1 mismatch
    const isOwner =
      Number(updatedUser.is_company_owner) === 1 ||
      updatedUser.is_company_owner === true;

    const companyId = Number(updatedUser.company_id) || 0;
    const role = isOwner ? "company_owner" : "user";

    console.log("🧩 Debug Values:");
    console.log(" - is_company_owner:", updatedUser.is_company_owner);
    console.log(" - company_id:", updatedUser.company_id);
    console.log(" - Computed isOwner:", isOwner);
    console.log(" - Final Role:", role);

    // ✅ Generate JWT (SAME STRUCTURE as normal login)
    const tokenPayload = {
      id: updatedUser.id,
      email: updatedUser.email,
      isAdmin: false,
      role: role,
      company_id: companyId,
      auth_type,
    };

    console.log("🪙 JWT Payload:", tokenPayload);

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // ✅ Remove password before sending response
    const { password: _, ...userWithoutPassword } = updatedUser;

    const responsePayload = {
      success: true,
      message: "Social login successful",
      token,
      data: {
        ...userWithoutPassword,
        role,
        company_id: companyId,
        is_company_owner: isOwner ? 1 : 0,
        isAdmin: false,
      },
      need_company_creation: companyId === 0,
    };

    console.log("✅ Final Response (Server):", responsePayload);

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error("❌ Social Login Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};




export const socialSignup = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      auth_type,
      google_id,
      facebook_id,
      apple_id,
      google_avatar,
      facebook_avatar,
      apple_avatar,
      company_name,
    } = req.body;
    const isAiEnabled = true;

    /* =========================
      ✅ BASIC VALIDATION
    ========================= */
    if (!email || !auth_type || !first_name) {
      return res.status(400).json({
        success: false,
        message: "Email, auth_type and first_name are required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    /* =========================
      ✅ CHECK EXISTING USER
    ========================= */
    const existing = await getUserByEmail(email);

    if (existing) {
      // 🔄 Update social IDs if missing
      if (auth_type === "google" && google_id && !existing.google_id) {
        await updateGoogleUser(existing.id, google_id, google_avatar || null);
      } else if (auth_type === "facebook" && facebook_id && !existing.facebook_id) {
        await updateFacebookUser(existing.id, facebook_id, facebook_avatar || null);
      } else if (auth_type === "apple" && apple_id && !existing.apple_id) {
        await updateAppleUser(existing.id, apple_id, apple_avatar || null);
      }

      // ❌ Only company owners allowed
      if (Number(existing.is_company_owner) !== 1) {
        return res.status(403).json({
          success: false,
          message: "Only company owners can use social login.",
        });
      }

      const role = "company_owner";
      const companyId = Number(existing.company_id) || 0;

      const token = jwt.sign(
        {
          id: existing.id,
          email: existing.email,
          role,
          company_id: companyId,
          auth_type,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const { password, ...safeUser } = existing;

      return res.status(200).json({
        success: true,
        message: "Login successful via social media",
        token,
        data: {
          ...safeUser,
          role,
          company_id: companyId,
          is_company_owner: 1,
          profile_image:
            google_avatar ||
            facebook_avatar ||
            apple_avatar ||
            existing.profile_image ||
            null,
        },
        need_company_creation: companyId === 0,
      });
    }

    /* =========================
      ✅ CREATE NEW SOCIAL USER
    ========================= */
    const userId = await registerSocialUser({
      first_name,
      last_name: last_name || "",
      email,
      auth_type,
      google_id,
      google_avatar,
      facebook_id,
      facebook_avatar,
      apple_id,
      apple_avatar,
    });

    /* =========================
      ✅ CREATE COMPANY
    ========================= */
    const defaultCompanyName = company_name || `${first_name}'s Company`;

    const defaultTrialPhotoLimit = Number(process.env.DEFAULT_TRIAL_PHOTO_LIMIT ?? 100);
    const [companyRes] = await db.execute(
      `INSERT INTO companies (name, subscription_status, is_ai_enabled, photos_limit, photos_used, created_at, updated_at)
      VALUES (?, 'trial', ?, ?, 0, NOW(), NOW())`,
      [defaultCompanyName, isAiEnabled ? 1 : 0, isAiEnabled ? defaultTrialPhotoLimit : 0]
    );

    await db.execute(
      `UPDATE users SET company_id = ?, is_company_owner = 1 WHERE id = ?`,
      [companyRes.insertId, userId]
    );

    /* =========================
      ✅ FETCH FINAL USER
    ========================= */
    const newUser = await getUserByEmail(email);
    const { password, ...safeUser } = newUser;

    const role = "company_owner";

    const token = jwt.sign(
      {
        id: newUser.id,
        email: newUser.email,
        role,
        company_id: companyRes.insertId,
        auth_type,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    /* =========================
      ✅ FINAL RESPONSE (LOGIN-LIKE)
    ========================= */
    return res.status(201).json({
      success: true,
      message: "Social signup successful and company created",
      token,
      data: {
        ...safeUser,
        role,
        company_id: companyRes.insertId,
        is_company_owner: 1,
        is_ai_enabled: isAiEnabled,
        profile_image:
          google_avatar ||
          facebook_avatar ||
          apple_avatar ||
          null,
        isAdmin: false,
      },
      need_company_creation: false,
    });
  } catch (err) {
    console.error("❌ Social Signup Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};


export const googleAuthSuccess = (req, res) => {
    if (!req.user) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=NoUser`);
    }

    const token = jwt.sign(
        { id: req.user.id, email: req.user.email, role: req.user.role },
        process.env.JWT_SECRET || "secretkey",
        { expiresIn: "1d" }
    );

    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?success=true&token=${token}&user=${encodeURIComponent(
        JSON.stringify(req.user)
    )}`;

    return res.redirect(redirectUrl);
};

export const googleAuthFailure = (req, res) => {
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`);
};



export const logout = (req, res) => {
    try {

        res.status(200).json({
            success: true,
            message: "Logged out successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Logout failed",
            error: error.message,
        });
    }
};
