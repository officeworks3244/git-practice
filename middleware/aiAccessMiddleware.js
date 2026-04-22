import db from "../config/db.js";

export const ensureCompanyAiAccess = async (req, res, next) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company context is required for AI access",
      });
    }

    const [rows] = await db.execute(
      `SELECT is_ai_enabled FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    if (!Boolean(rows[0].is_ai_enabled)) {
      return res.status(403).json({
        success: false,
        message: "AI access is disabled for this company",
        data: {
          company_id: companyId,
          is_ai_enabled: false,
        },
      });
    }

    return next();
  } catch (error) {
    console.error("ensureCompanyAiAccess error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify AI access",
    });
  }
};
