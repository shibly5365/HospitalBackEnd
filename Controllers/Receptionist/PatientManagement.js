import userModel from "../../Models/User/UserModels.js";
import Appointment from "../../Models/Appointment/Appointment.js";

// Get all patients with search and filters
export const getAllPatients = async (req, res) => {
  try {
    const { search, page = 1, limit = 20, sortBy = "createdAt", sortOrder = -1 } = req.query;

    let filter = { role: "patient" };
    
    // Search filter
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { contact: { $regex: search, $options: "i" } },
        { patientId: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: parseInt(sortOrder) };

    const patients = await userModel
      .find(filter)
      .select("-password")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await userModel.countDocuments(filter);

    res.json({
      success: true,
      data: {
        patients,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get all patients error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get patient by ID with complete details
export const getPatientById = async (req, res) => {
  try {
    const { patientId } = req.params;

    const patient = await userModel.findById(patientId).select("-password");
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    // Get appointment count
    const appointmentCount = await Appointment.countDocuments({ patient: patientId });

    res.json({
      success: true,
      data: {
        patient,
        appointmentCount,
      },
    });
  } catch (error) {
    console.error("Get patient by ID error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update patient information
export const updatePatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.password;
    delete updateData.role;
    delete updateData._id;

    const updatedPatient = await userModel
      .findByIdAndUpdate(patientId, updateData, { new: true, runValidators: true })
      .select("-password");

    if (!updatedPatient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    res.json({
      success: true,
      message: "Patient information updated successfully",
      data: updatedPatient,
    });
  } catch (error) {
    console.error("Update patient error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Search patients
export const searchPatients = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        data: { patients: [] },
      });
    }

    const patients = await userModel
      .find({
        role: "patient",
        $or: [
          { fullName: { $regex: query, $options: "i" } },
          { email: { $regex: query, $options: "i" } },
          { contact: { $regex: query, $options: "i" } },
          { patientId: { $regex: query, $options: "i" } },
        ],
      })
      .select("-password")
      .limit(50)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { patients },
    });
  } catch (error) {
    console.error("Search patients error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Register new patient (by receptionist)
export const registerPatient = async (req, res) => {
  try {
    const {
      fullName,
      email,
      contact,
      dob,
      age,
      gender,
      address,
      emergencyContact,
      insuranceInfo,
      patientType = "New Patient",
    } = req.body;

    // Check if patient already exists
    const existingPatient = await userModel.findOne({ email });
    if (existingPatient) {
      return res.status(400).json({
        success: false,
        message: "Patient already exists with this email",
      });
    }

    // Create new patient
    const newPatient = await userModel.create({
      fullName,
      email,
      contact,
      role: "patient",
      patientType,
      dob: dob ? new Date(dob) : undefined,
      age,
      gender,
      address: address
        ? {
            street: address.street || "",
            city: address.city || "",
            state: address.state || "",
            zip: address.zip || "",
          }
        : undefined,
      emergencyContact: emergencyContact
        ? {
            name: emergencyContact.name || "",
            number: emergencyContact.number || "",
          }
        : undefined,
      insuranceInfo,
    });

    const patientData = await userModel.findById(newPatient._id).select("-password");

    res.status(201).json({
      success: true,
      message: "Patient registered successfully",
      data: patientData,
    });
  } catch (error) {
    console.error("Register patient error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

