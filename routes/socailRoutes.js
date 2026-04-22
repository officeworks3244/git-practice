import express from "express";
import passport from "passport";
import jwt from "jsonwebtoken";

const router = express.Router();

const buildSocialData = (profile = {}, authType = "google") => ({
  first_name: profile.first_name || "",
  last_name: profile.last_name || "",
  email: profile.email || "",
  google_id: profile.google_id || null,
  google_avatar: profile.google_avatar || null,
  facebook_id: profile.facebook_id || null,
  facebook_avatar: profile.facebook_avatar || null,
  apple_id: profile.apple_id || null,
  apple_avatar: profile.apple_avatar || null,
  auth_type: profile.auth_type || authType,
  is_company_owner: true,
  social_registration: true,
});

const handleOAuthCallback = (provider, authType) => (req, res, next) => {
  passport.authenticate(provider, { session: false }, (err, user, info) => {
    if (err) {
      console.error(`${provider} auth error:`, err);
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=${encodeURIComponent(
          err.message || "An error occurred"
        )}`
      );
    }

    if (!user) {
      if (info?.need_signup && info?.profile) {
        const socialData = buildSocialData(info.profile, authType);
        return res.redirect(
          `${process.env.FRONTEND_URL}/register?socialData=${encodeURIComponent(
            JSON.stringify(socialData)
          )}`
        );
      }

      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=${encodeURIComponent(
          info?.message || "Authentication failed"
        )}`
      );
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        isAdmin: false,
        role: "company_owner",
        company_id: user.company_id || 0,
        auth_type: authType,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?success=true&token=${token}&user=${encodeURIComponent(
      JSON.stringify(user)
    )}&need_company_creation=${user.need_company_creation || false}`;

    return res.redirect(redirectUrl);
  })(req, res, next);
};

/* GOOGLE LOGIN */
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);
router.get("/google/callback", handleOAuthCallback("google", "google"));
router.get("/google/failure", (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`);
});

/* FACEBOOK LOGIN */
router.get("/facebook", passport.authenticate("facebook", { scope: ["email"] }));
router.get("/facebook/callback", handleOAuthCallback("facebook", "facebook"));
router.get("/facebook/failure", (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL}/login?error=facebook_auth_failed`);
});

/* APPLE LOGIN */
router.get("/apple", passport.authenticate("apple", { scope: ["name", "email"] }));
router.get("/apple/callback", handleOAuthCallback("apple", "apple"));
router.post("/apple/callback", handleOAuthCallback("apple", "apple"));
router.get("/apple/failure", (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL}/login?error=apple_auth_failed`);
});

export default router;
