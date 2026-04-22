import jwt from "jsonwebtoken";
import {
  hasPhotoCredits,
  getAvailablePhotos,
  isSubscriptionOverdue,
} from "../utils/photoCreditService.js";

/* Middleware: Check if company has photo credits available */
export const checkPhotoCredits = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const company_id = decoded.company_id;

    // Check if subscription is overdue
    const isOverdue = await isSubscriptionOverdue(company_id);
    if (isOverdue) {
      return res.status(403).json({
        success: false,
        message: "Your subscription has expired. Please renew your subscription to continue.",
        errorCode: "SUBSCRIPTION_EXPIRED",
      });
    }

    // Check if photo credits available
    const hasCredits = await hasPhotoCredits(company_id);
    if (!hasCredits) {
      const availablePhotos = await getAvailablePhotos(company_id);
      return res.status(403).json({
        success: false,
        message: "You have used all your photo credits. Please upgrade your plan.",
        errorCode: "NO_PHOTO_CREDITS",
        data: {
          photosRemaining: availablePhotos,
        },
      });
    }

    // Attach available photos to request
    req.availablePhotos = await getAvailablePhotos(company_id);
    next();
  } catch (error) {
    console.error("checkPhotoCredits error:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking photo credits",
    });
  }
};

/* Middleware: Extract token data and attach to request */
export const extractTokenData = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    req.company_id = decoded.company_id;
    req.user_id = decoded.id;

    next();
  } catch (error) {
    console.error("extractTokenData error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};
