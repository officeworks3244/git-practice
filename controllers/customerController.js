import {
  addCustomerModel,
  getCustomersModel,
  getCustomerByEmailModel,
  updateCustomerModel,
  deleteCustomerModel,
  getCustomerByIdModel,
} from "../models/customerModel.js";

// ✅ Add Customer
export const addCustomer = async (req, res) => {
  try {
    const { company_id, name, email, phone, address } = req.body;

    if (!company_id || !name || !email || !phone)
      return res.status(400).json({ success: false, message: "All required fields must be filled" });

    // Duplicate check
    const existing = await getCustomerByEmailModel(email, company_id);
    if (existing)
      return res.status(409).json({
        success: false,
        message: "Customer with this email already exists in this company",
      });

    const customerId = await addCustomerModel({ company_id, name, email, phone, address });

    res.status(201).json({
      success: true,
      message: "Customer added successfully",
      data: { id: customerId, name, email, phone, address },
    });
  } catch (err) {
    console.error("Add Customer Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ✅ Get Customers
// export const getCustomers = async (req, res) => {
//   try {
//     const { company_id } = req.query;

//     if (!company_id)
//       return res.status(400).json({ success: false, message: "Company ID is required" });

//     const customers = await getCustomersModel(company_id);

//     res.status(200).json({
//       success: true,
//       message: "Customers fetched successfully",
//       data: customers,
//     });
//   } catch (err) {
//     console.error("Get Customers Error:", err);
//     res.status(500).json({ success: false, message: "Server error", error: err.message });
//   }
// };

export const getCustomers = async (req, res) => {
  try {
    const { company_id } = req.query;
    const { role } = req.user;   // 🔥 admin check

    // ------------------------------
    // 🔹 If admin → return all customers (NO company_id needed)
    // ------------------------------
    if (role === "admin") {
      const customers = await getCustomersModel(null);   // null → all
      return res.status(200).json({
        success: true,
        message: "All customers fetched successfully (Admin)",
        data: customers,
      });
    }

    // ------------------------------
    // 🔹 For company owner / normal user → company_id required
    // ------------------------------
    if (!company_id) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    const customers = await getCustomersModel(company_id);

    res.status(200).json({
      success: true,
      message: "Customers fetched successfully",
      data: customers,
    });

  } catch (err) {
    console.error("Get Customers Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};


// ✅ Update Customer
export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address } = req.body;

    if (!id)
      return res.status(400).json({ success: false, message: "Customer ID is required" });

    await updateCustomerModel(id, { name, email, phone, address });

    res.status(200).json({ success: true, message: "Customer updated successfully" });
  } catch (err) {
    console.error("Update Customer Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ✅ Delete Customer
export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id)
      return res.status(400).json({ success: false, message: "Customer ID is required" });

    await deleteCustomerModel(id);

    res.status(200).json({ success: true, message: "Customer deleted successfully" });
  } catch (err) {
    console.error("Delete Customer Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ✅ Get single customer by ID (and company from token)
export const getCustomerById = async (req, res) => {
  try {
    const user = req.user; // token se milay ga
    const { id } = req.params; // customer id from URL

    if (!user?.company_id) {
      return res.status(400).json({ success: false, message: "Company ID missing in token" });
    }

    if (!id) {
      return res.status(400).json({ success: false, message: "Customer ID is required" });
    }

    const customer = await getCustomerByIdModel(user.company_id, id);

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    res.status(200).json({
      success: true,
      message: "Customer fetched successfully",
      data: customer,
    });
  } catch (err) {
    console.error("Get Customer by ID Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};
