
import jwt from "jsonwebtoken";
import {
  addLocation,
  getLocationsWithCustomer,
  updateLocation,
  fetchTrapStatistics,
  getLocationByIds,
  removeLocation
} from "../models/locationModel.js";


// ✅ Add Location
export const createLocation = async (req, res) => {
  try {
    const {
      customer_id,
      name,
      address,
      street,
      city,
      state,
      country,
      post_code,
      latitude,
      longitude,
      status,
    } = req.body;

    // ✅ Extract company_id from token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const company_id = decoded?.company_id;

    if (!company_id) {
      return res.status(400).json({ success: false, message: "Invalid token or missing company_id" });
    }

    // ✅ Validate required fields
    if (!customer_id || !name || !address) {
      return res.status(400).json({ success: false, message: "All required fields are missing" });
    }

    // ✅ Save to DB
    const locationId = await addLocation(
      company_id,
      customer_id,
      name,
      address,
      street,
      city,
      state,
      country,
      post_code,
      latitude,
      longitude,
      status
    );

    return res.status(201).json({
      success: true,
      message: "Location added successfully",
      data: { id: locationId },
    });

  } catch (err) {
    console.error("Add Location Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};




export const fetchLocations = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { role, company_id } = decoded;   // 🟢 Role + company_id from token
    const { customer_id } = req.query;

    let locations;

    // 🟢 ADMIN → Get ALL Locations (no company filter)
    if (role === "admin") {
      locations = await getLocationsWithCustomer(null, customer_id, true); 
    }

    // 🔵 NORMAL USER → Only his company
    else {
      if (!company_id) {
        return res.status(400).json({
          success: false,
          message: "Invalid token or missing company_id",
        });
      }
      locations = await getLocationsWithCustomer(company_id, customer_id, false);
    }

    return res.status(200).json({
      success: true,
      message: "Locations fetched successfully",
      data: locations,
    });

  } catch (err) {
    console.error("Get Locations Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};



export const editLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, latitude, longitude } = req.body;

    const updated = await updateLocation(id, name, address, latitude, longitude);

    if (!updated) {
      return res.status(404).json({ success: false, message: "Location not found" });
    }

    res.status(200).json({ success: true, message: "Location updated successfully" });
  } catch (err) {
    console.error("Update Location Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};




export const getTrapStatistics = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { start_date, end_date, trap_id, location_id } = req.query;

    const data = await fetchTrapStatistics(company_id, start_date, end_date, trap_id, location_id);

    res.json({ success: true, data });
  } catch (error) {
    console.error("Trap Statistics Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// controllers/locationController.js
export const getLocationById = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No token provided"
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const company_id = decoded?.company_id;

    if (!company_id) {
      return res.status(400).json({
        success: false,
        message: "Invalid token or missing company_id"
      });
    }

    const location_id = req.params.id;

    if (!location_id) {
      return res.status(400).json({
        success: false,
        message: "Location ID is required"
      });
    }

    // Get location by ID
    const location = await getLocationByIds(company_id, location_id);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "Location not found or you don't have permission to access it"
      });
    }

    // Format response to match your existing structure
    const formattedLocation = {
      id: location.location_id,
      name: location.location_name,
      address: location.address,
      street: location.street,
      city: location.city,
      state: location.state,
      country: location.country,
      post_code: location.post_code,
      latitude: location.latitude,
      longitude: location.longitude,
      status: location.status,
      created_at: location.created_at,
      updated_at: location.updated_at,
      customer: location.customer_id ? {
        id: location.customer_id,
        name: location.customer_name,
        email: location.customer_email,
        phone: location.customer_phone,
        address: location.customer_address
      } : null,
      company: {
        id: location.company_id,
        name: location.company_name,
        email: location.company_email,
        phone: location.company_phone,
        address: location.company_address
      }
    };

    return res.status(200).json({
      success: true,
      message: "Location fetched successfully",
      data: formattedLocation
    });

  } catch (err) {
    console.error("Get Location By ID Error:", err);

    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    }

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Token expired"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};


export const deleteLocation = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Token check
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const company_id = decoded?.company_id;

    if (!company_id) {
      return res.status(400).json({
        success: false,
        message: "Invalid token or missing company_id",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Location id is required",
      });
    }

    // ✅ Delete from DB
    const affectedRows = await removeLocation(id, company_id);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Location not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Location deleted successfully",
    });

  } catch (err) {
    console.error("Delete Location Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};