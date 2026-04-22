import { fetchMeetingReport } from "../models/reportModel.js";

// ================================================================
// ✅ FIXED - Get Meeting Report Controller
// ================================================================
export const getMeetingReport = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { start_date, end_date, location_id, customer_id } = req.query;

    const data = await fetchMeetingReport(
      company_id,
      start_date,
      end_date,
      location_id,
      customer_id
    );

    res.json({
      success: true,
      count: data.length,
      data
    });

  } catch (error) {
    console.error("Meeting Report Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
