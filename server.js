// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import path from "path";
// import session from "express-session";
// import passport from "passport";
// import { fileURLToPath } from "url";
// import pool from "./config/db.js";

// // Load env
// dotenv.config();

// const app = express();

// /* =====================================================
//    STRIPE WEBHOOK (MUST BE FIRST)
// ===================================================== */
// import { handleStripeWebhook } from "./utils/webhookHandler.js";

// app.post(
//   "/api/stripe/webhook",
//   express.raw({ type: "application/json" }),
//   handleStripeWebhook
// );

// /* =====================================================
//    CORS (NODE 20 SAFE)
// ===================================================== */
// const allowedOrigins = [
//   "http://localhost:5173",
//   "http://127.0.0.1:5173",
//   process.env.FRONTEND_URL,
// ];

// app.use(
//   cors({
//     origin: (origin, callback) => {
//       if (!origin) return callback(null, true); // Postman / curl
//       if (allowedOrigins.includes(origin)) {
//         return callback(null, true);
//       }
//       return callback(new Error("CORS not allowed"));
//     },
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );

// /* =====================================================
//    BODY PARSERS (AFTER WEBHOOK)
// ===================================================== */
// app.use(express.json({ limit: "100mb" }));
// app.use(express.urlencoded({ limit: "100mb", extended: true }));

// /* =====================================================
//    SESSION SETUP (LOCAL + PROD SAFE)
// ===================================================== */
// app.use(
//   session({
//     name: "pestiq.sid",
//     secret: process.env.JWT_SECRET || "secretkey",
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//       secure: process.env.NODE_ENV === "production",
//       httpOnly: true,
//       sameSite: "lax",
//     },
//   })
// );

// /* =====================================================
//    PASSPORT
// ===================================================== */
// import "./config/passport.js";
// app.use(passport.initialize());
// app.use(passport.session());

// /* =====================================================
//    STATIC FILES
// ===================================================== */
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// console.log("📁 Uploads:", path.join(__dirname, "uploads"));

// /* =====================================================
//    DB TEST
// ===================================================== */
// (async () => {
//   try {
//     await pool.query("SELECT 1");
//     console.log("✅ MySQL Connected");
//   } catch (err) {
//     console.error("❌ MySQL Error:", err.message);
//     process.exit(1);
//   }
// })();

// /* =====================================================
//    ROUTES
// ===================================================== */
// import authRoutes from "./routes/authRoutes.js";
// import customerRoutes from "./routes/customerRoutes.js";
// import locationRoutes from "./routes/locationRoutes.js";
// import meetingsRoutes from "./routes/meetingsRoutes.js";
// import photosRoutes from "./routes/photosRoutes.js";
// import dashboardRoutes from "./routes/dashboardRoutes.js";
// import socialAuthRoutes from "./routes/socailRoutes.js";
// import userRoutes from "./routes/usersRoutes.js";
// import assigmentRoutes from "./routes/assignmentRoutes.js";
// import accountRoutes from "./routes/accountRoutes.js";
// import trapsRoutes from "./routes/trapRoutes.js";
// import insectRoutes from "./routes/insectRoutes.js";
// import adminRoutes from "./routes/adminRoutes.js";
// import reportRoutes from "./routes/reportRoutes.js";
// import insectPopulationRoutes from "./routes/insectPopulationRoutes.js";
// import stripeRoutes from "./routes/stripeRoutes.js";
// import invoiceRoutes from "./routes/invoiceRoutes.js";

// /* =====================================================
//    ROUTE MOUNTS
// ===================================================== */
// app.use("/api/auth", socialAuthRoutes);
// app.use("/api/account", accountRoutes);
// app.use("/api/dashboard", dashboardRoutes);
// app.use("/api/locations", locationRoutes);
// app.use("/api/customers", customerRoutes);
// app.use("/api/meetings", meetingsRoutes);
// app.use("/api/photos", photosRoutes);
// app.use("/api/users", authRoutes);
// app.use("/api/company-users", userRoutes);
// app.use("/api/assigment-users", assigmentRoutes);
// app.use("/api/trap", trapsRoutes);
// app.use("/api/insect", insectRoutes);
// app.use("/api/admin", adminRoutes);
// app.use("/api/report", reportRoutes);
// app.use("/api/insectPopulation", insectPopulationRoutes);
// app.use("/api/stripe", stripeRoutes);
// app.use("/api/invoices", invoiceRoutes);

// /* =====================================================
//    ROOT
// ===================================================== */
// app.get("/", (req, res) => {
//   res.send("🚀 PestIQ Backend running successfully!");
// });

// /* =====================================================
//    SERVER
// ===================================================== */
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () =>
//   console.log(`⚡ Server running on port ${PORT}`)
// );


import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import session from "express-session";
import passport from "passport";
import { fileURLToPath } from "url";
import pool from "./config/db.js";

// Load env
dotenv.config();

const app = express();

/* =====================================================
   STRIPE WEBHOOK (MUST BE FIRST)
===================================================== */
import { handleStripeWebhook } from "./utils/webhookHandler.js";

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

/* =====================================================
   CORS (NODE 20 SAFE + MOBILE APP)
===================================================== */
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,
];

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* =====================================================
   BODY PARSERS (AFTER WEBHOOK)
===================================================== */
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

/* =====================================================
   SESSION SETUP (LOCAL + PROD SAFE)
===================================================== */
app.use(
  session({
    name: "pestiq.sid",
    secret: process.env.JWT_SECRET || "secretkey",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

/* =====================================================
   PASSPORT
===================================================== */
import "./config/passport.js";
app.use(passport.initialize());
app.use(passport.session());

/* =====================================================
   STATIC FILES
===================================================== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
console.log("📁 Uploads:", path.join(__dirname, "uploads"));

/* =====================================================
   DB TEST
===================================================== */
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ MySQL Connected");
  } catch (err) {
    console.error("❌ MySQL Error:", err.message);
    process.exit(1);
  }
})();

/* =====================================================
   ROUTES
===================================================== */
import authRoutes from "./routes/authRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import meetingsRoutes from "./routes/meetingsRoutes.js";
import photosRoutes from "./routes/photosRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import socialAuthRoutes from "./routes/socailRoutes.js";
import userRoutes from "./routes/usersRoutes.js";
import assigmentRoutes from "./routes/assignmentRoutes.js";
import accountRoutes from "./routes/accountRoutes.js";
import trapsRoutes from "./routes/trapRoutes.js";
import insectRoutes from "./routes/insectRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import insectPopulationRoutes from "./routes/insectPopulationRoutes.js";
import stripeRoutes from "./routes/stripeRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import subscriptionroutes from "./routes/subscriptionRoutes.js";
import paypalRoutes from "./routes/paypalRoutes.js";

/* =====================================================
   ROUTE MOUNTS
===================================================== */
app.use("/api/auth", socialAuthRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/meetings", meetingsRoutes);
app.use("/api/photos", photosRoutes);
app.use("/api/users", authRoutes);
app.use("/api/company-users", userRoutes);
app.use("/api/assigment-users", assigmentRoutes);
app.use("/api/trap", trapsRoutes);
app.use("/api/insect", insectRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/report", reportRoutes);
app.use("/api/insectPopulation", insectPopulationRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/paypal", paypalRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/subscriptions", subscriptionroutes);

/* =====================================================
   ROOT
===================================================== */
app.get("/", (req, res) => {
  res.send("🚀 PestIQ Backend running successfully!");
});

/* =====================================================
   SERVER
===================================================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`⚡ Server running on port ${PORT}`)
);
