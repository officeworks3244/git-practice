import {
  createTrap,
  fetchTraps,
  updateTrap,
  deleteTrap,
} from "../models/trapModel.js";

export const addTrap = async (req, res) => {
  try {
    const company_id = req.user.company_id; // from token
    const trapData = { ...req.body, company_id, added_by: req.user.id };

    const trapId = await createTrap(trapData);

    res.json({ success: true, message: "Trap added successfully", trap_id: trapId });
  } catch (error) {
    console.error("Error creating trap:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const getTraps = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const traps = await fetchTraps(company_id, req.query);

    res.json({ success: true, data: traps });
  } catch (error) {
    console.error("Error fetching traps:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const editTrap = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;
    await updateTrap(id, company_id, req.body);

    res.json({ success: true, message: "Trap updated successfully" });
  } catch (error) {
    console.error("Error updating trap:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const removeTrap = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;
    await deleteTrap(id, company_id);

    res.json({ success: true, message: "Trap deleted successfully" });
  } catch (error) {
    console.error("Error deleting trap:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
