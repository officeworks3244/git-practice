import { fetchInsectData } from "../models/insectModel.js";

export const getInsectData = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { start_date, end_date, trap_id, location_id } = req.query;

    const data = await fetchInsectData(company_id, start_date, end_date, trap_id, location_id);

    res.json({ success: true, data });
  } catch (error) {
    console.error("Insect Data Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
