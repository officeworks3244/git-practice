import express from "express";
import { registerUser, loginUser, socialLogin, socialSignup, verifyOtpController, resendOtp, forgotPassword, resetPassword } from "../controllers/authController.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/social-login", socialLogin);
router.post("/social-signup", socialSignup);

router.post("/verify-otp", verifyOtpController);
router.post("/resend-otp", resendOtp);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
export default router;
