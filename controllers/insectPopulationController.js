import jwt from "jsonwebtoken";
import { getInsectPopulationData } from "../models/insectPopulationModel.js";

// export const fetchInsectPopulationData = async (req, res) => {
//   try {
//     // 🔐 Token
//     const token = req.headers.authorization?.split(" ")[1];
//     if (!token) {
//       return res.status(401).json({
//         success: false,
//         message: "Token missing",
//       });
//     }

//     // 🔓 Decode
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     const { company_id, role } = decoded;

//     if (!company_id) {
//       return res.status(400).json({
//         success: false,
//         message: "company_id missing in token",
//       });
//     }

//     // 📥 Query params
//     const {
//       start_date,
//       end_date,
//       location_id,
//       meeting_id,
//     } = req.query;

//     if (!start_date || !end_date) {
//       return res.status(400).json({
//         success: false,
//         message: "start_date and end_date are required",
//       });
//     }

//     // 📊 Model call
//     const data = await getInsectPopulationData({
//       company_id,
//       start_date,
//       end_date,
//       location_id: location_id ?? null,
//       meeting_id: meeting_id ?? null,
//     });

//     return res.json({
//       success: true,
//       data,
//     });

//   } catch (error) {
//     console.error("❌ Insect Population Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };


export const fetchInsectPopulationData = async (req, res) => {
  try {
    // 🔐 Token
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token missing",
      });
    }

    // 🔓 Decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { company_id, role } = decoded;

    // 📥 Query params
    const {
      start_date,
      end_date,
      location_id,
      meeting_id,
    } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: "start_date and end_date are required",
      });
    }

    // 📊 Model call
    const data = await getInsectPopulationData({
      role,
      company_id,
      start_date,
      end_date,
      location_id: location_id ?? null,
      meeting_id: meeting_id ?? null,
    });

    return res.json({
      success: true,
      data,
    });

  } catch (error) {
    console.error("❌ Insect Population Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};
