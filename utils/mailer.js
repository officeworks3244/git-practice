import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpSecure =
  String(process.env.SMTP_SECURE || "").trim().toLowerCase() === "true"
    ? true
    : smtpPort === 465;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const getFromAddress = () =>
  String(process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();

export async function sendResendHelloWorldEmail() {
  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: "asmrcutting110@gmail.com",
      subject: "Hello World",
      html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
    });
    return { success: true, message: "Hello World email sent successfully" };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

const getOtpTemplate = (otp, name, purpose = "verification") => {
  const purposeText =
    purpose === "password_reset" ? "password reset" : "account verification";

  return `
    <div style="font-family: Arial, sans-serif; background:#f8f9fa; padding:20px;">
      <div style="max-width:500px; margin:auto; background:#ffffff; padding:20px; border-radius:8px;">
        <h2 style="color:#667eea;">Hi ${name || "User"},</h2>
        <p>Your ${purposeText} code is:</p>

        <div style="font-size:32px; font-weight:bold; letter-spacing:4px; margin:20px 0;">
          ${otp}
        </div>

        <p>This OTP will expire in <strong>10 minutes</strong>.</p>
        <p style="font-size:12px; color:#999;">
          If you didn't request this, please ignore this email.
        </p>
      </div>
    </div>
  `;
};

export async function sendOtpEmail(
  toEmail,
  otp,
  name,
  purpose = "verification"
) {
  const subject =
    purpose === "password_reset"
      ? "Your Password Reset Code"
      : "Your Pestiq Verification Code";

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: toEmail,
      subject,
      html: getOtpTemplate(otp, name, purpose),
    });
    console.log(`OTP sent to: ${toEmail}`);
    return { success: true, message: "OTP sent successfully" };
  } catch (error) {
    console.error("OTP email failed:", error.message);
    return { success: false, message: error.message };
  }
}

export async function sendResetEmail(toEmail, resetLink) {
  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: toEmail,
      subject: "Reset Your Password",
      html: `
      <div style="font-family: Arial, sans-serif; background:#f8f9fa; padding:20px;">
        <div style="max-width:500px; margin:auto; background:#ffffff; padding:20px; border-radius:8px;">
          <h2 style="color:#667eea;">Password Reset Request</h2>
          <p>Click the button below to reset your password:</p>

          <a href="${resetLink}"
             style="display:inline-block; margin-top:15px;
             background:#667eea; color:white; padding:10px 20px;
             text-decoration:none; border-radius:5px;">
            Reset Password
          </a>

          <p style="margin-top:20px; font-size:12px; color:#999;">
            This link will expire in 1 hour.
          </p>
        </div>
      </div>
    `,
    });
    console.log(`Reset email sent to: ${toEmail}`);
    return { success: true, message: "Reset email sent successfully" };
  } catch (error) {
    console.error("Reset email failed:", error.message);
    return { success: false, message: error.message };
  }
}
