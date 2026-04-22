import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as AppleStrategy } from "passport-apple";
import dotenv from "dotenv";

import {
  getUserByEmail,
  getUserById,
  updateGoogleUser,
  updateFacebookUser,
  updateAppleUser,
} from "../models/authModel.js";

dotenv.config();

// ✅ Serialize & Deserialize
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await getUserById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});




// passport.js - Updated for company_owner only
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Google OAuth callback received:", {
          id: profile.id,
          displayName: profile.displayName,
          hasEmail: !!profile.emails?.[0]?.value,
        });

        const email = profile.emails?.[0]?.value;
        if (!email)
          return done(null, false, { message: "Google login failed: email missing" });

        const googleId = profile.id;
        const googleAvatar = profile.photos?.[0]?.value || null;

        let user = await getUserByEmail(email);

        console.log("Google OAuth - User lookup result:", {
          email,
          found: !!user,
          isDeleted: user?.is_deleted === 1,
          isCompanyOwner: user?.is_company_owner === 1,
          hasGoogleId: !!user?.google_id
        });

        // ✅ If user found, check if they are company owner
        if (user) {
          if (user.is_deleted === 1)
            return done(null, false, { message: "Account deleted" });

          // ❌ Check if user is company_owner
          if (Number(user.is_company_owner) !== 1) {
            return done(null, false, { 
              message: "Only company owners can use social login. Please use email/password login." 
            });
          }

          if (!user.google_id)
            await updateGoogleUser(user.id, googleId, googleAvatar);

          return done(null, { ...user, need_company_creation: !user.company_id });
        }

        // ✅ If user not found, allow registration ONLY for company owners
        return done(null, false, { 
          message: "Please signup your account first.",
          profile: {
            first_name: profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User',
            last_name: profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '',
            email: email,
            google_id: googleId,
            google_avatar: googleAvatar,
            auth_type: 'google',
            // This will be used to set is_company_owner = 1 during registration
            is_company_owner: true
          },
          need_signup: true,
          allow_registration: true // Flag to indicate registration is allowed
        });
      } catch (err) {
        console.error("Google Strategy Error:", err);
        return done(err, null);
      }
    }
  )
);

// ✅ FACEBOOK STRATEGY - Updated
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL,
      profileFields: ["id", "emails", "name", "photos"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email)
          return done(null, false, { message: "Facebook login failed: email missing" });

        const facebookId = profile.id;
        const facebookAvatar = profile.photos?.[0]?.value || null;

        let user = await getUserByEmail(email);

        if (user) {
          if (user.is_deleted === 1)
            return done(null, false, { message: "Account deleted" });

          // ❌ Check if user is company_owner
          if (Number(user.is_company_owner) !== 1) {
            return done(null, false, { 
              message: "Only company owners can use social login. Please use email/password login." 
            });
          }

          if (!user.facebook_id)
            await updateFacebookUser(user.id, facebookId, facebookAvatar);

          return done(null, { ...user, need_company_creation: !user.company_id });
        }

        // ❌ User not exist → Allow registration for company owners only
        return done(null, false, { 
          message: "Please signup your account first.",
          profile: {
            first_name: profile.name?.givenName || '',
            last_name: profile.name?.familyName || '',
            email: email,
            facebook_id: facebookId,
            facebook_avatar: facebookAvatar,
            auth_type: 'facebook',
            is_company_owner: true
          },
          need_signup: true,
          allow_registration: true
        });
      } catch (err) {
        console.error("Facebook Strategy Error:", err);
        return done(err, null);
      }
    }
  )
);

// ✅ APPLE STRATEGY - Updated
passport.use(
  new AppleStrategy(
    {
      clientID: process.env.APPLE_CLIENT_ID,
      teamID: process.env.APPLE_TEAM_ID,
      keyID: process.env.APPLE_KEY_ID,
      privateKeyString: process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      callbackURL: process.env.APPLE_CALLBACK_URL,
      scope: ["name", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.email || profile._json?.email;
        if (!email)
          return done(null, false, { message: "Apple login failed: email missing" });

        const appleId = profile.id;

        let user = await getUserByEmail(email);

        if (user) {
          if (user.is_deleted === 1)
            return done(null, false, { message: "Account deleted" });

          // ❌ Check if user is company_owner
          if (Number(user.is_company_owner) !== 1) {
            return done(null, false, { 
              message: "Only company owners can use social login. Please use email/password login." 
            });
          }

          if (!user.apple_id) await updateAppleUser(user.id, appleId, null);

          return done(null, { ...user, need_company_creation: !user.company_id });
        }

        // ❌ User not exist → Allow registration for company owners only
        return done(null, false, { 
          message: "Please signup your account first.",
          profile: {
            first_name: profile.name?.firstName || '',
            last_name: profile.name?.lastName || '',
            email: email,
            apple_id: appleId,
            auth_type: 'apple',
            is_company_owner: true
          },
          need_signup: true,
          allow_registration: true
        });
      } catch (err) {
        console.error("Apple Strategy Error:", err);
        return done(err, null);
      }
    }
  )
);

export default passport;
