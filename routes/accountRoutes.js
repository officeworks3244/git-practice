import express from "express";
import {
  getProfile,
  updateProfile,
  getInvoices,
  getSubscription,
  getAccessStatus,
  renewSubscription,
  cancelSubscription,
  getPayments,
    uploadProfileImage
} from "../controllers/accountController.js";
import upload from "../middleware/upload.js";


const router = express.Router();

// profile
router.get("/profile", getProfile);
// Add multer middleware for file upload
router.put("/profile", upload.single("profile_image"), updateProfile);


router.post("/profile/image", upload.single("profile_image"), uploadProfileImage);


// invoices & payments
router.get("/get-invoices", getInvoices);
router.get("/get-payments", getPayments);

// subscription
router.get("/get-subscription", getSubscription);
router.get("/access-status", getAccessStatus);
router.post("/subscription/renew", renewSubscription);
router.post("/subscription/cancel", cancelSubscription);

export default router;
