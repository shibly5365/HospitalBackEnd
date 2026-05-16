import bcrypt from "bcrypt";
import userModel from "../../Models/User/UserModels.js";
import Appointment from "../../Models/Appointment/Appointment.js";

// Function to generate employeeId
async function generateReceptionistId() {
  // Find the last receptionist created, sort by employeeId descending
  const lastReceptionist = await userModel
    .findOne({ role: "receptionist" })
    .sort({ createdAt: -1 });

  if (!lastReceptionist || !lastReceptionist.employeeId) {
    return "HOS-REC-0001"; // first ID
  }

  // Extract the number part (e.g., "HOS-REC-0007" → 7)
  const lastNumber = parseInt(lastReceptionist.employeeId.split("-").pop(), 10);
  const nextNumber = lastNumber + 1;

  return `HOS-REC-${String(nextNumber).padStart(4, "0")}`;
}

export const CreateReceptionists = async (req, res) => {
  try {
    const { fullName, email, password, contact, age, gender } = req.body;

    // Check existing user
    const existing = await userModel.findOne({ email });
    if (existing) {
      return res
        .status(400)
        .json({ message: "User already exists with this email" });
    }

    // Hash password
    const hashPassword = await bcrypt.hash(password, 10);

    // Auto-generate unique employeeId
    const employeeId = await generateReceptionistId();

    const newUser = new userModel({
      fullName,
      email,
      password: hashPassword,
      contact,
      employeeId,
      age,
      role: "receptionist",
      gender,
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: "Receptionist created successfully",
      user: newUser,
    });
  } catch (error) {
    console.error("Error creating receptionist:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const getAllReceptionists = async (req, res) => {
  try {
    // 🔹 Get all receptionists
    const receptionists = await userModel
      .find({ role: "receptionist" })
      .select("fullName email contact employeeId age gender createdAt");

    // 🔹 Map over receptionists and add extra info
    const receptionistWithStats = await Promise.all(
      receptionists.map(async (r) => {
        // Count how many patients this receptionist added
        const patientCount = await userModel.countDocuments({
          addedBy: r._id, // assuming you store receptionist id in `addedBy`
        });

        // Count how many appointments this receptionist booked
        const appointmentCount = await Appointment.countDocuments({
          bookedBy: r._id, // assuming you store receptionist id in `bookedBy`
        });

        return {
          _id: r._id,
          fullName: r.fullName,
          email: r.email,
          contact: r.contact,
          employeeId: r.employeeId,
          age: r.age,
          gender: r.gender,
          createdAt: r.createdAt,
          patientCount,
          appointmentCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: receptionistWithStats.length,
      data: receptionistWithStats,
    });
  } catch (error) {
    console.error("Error fetching receptionists:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};
export const getReceptionistById = async (req, res) => {
  try {
    const { id } = req.params;

    const receptionist = await userModel
      .findOne({ _id: id, role: "receptionist" })
      .select("fullName email contact employeeId age gender createdAt");

    if (!receptionist) {
      return res
        .status(404)
        .json({ success: false, message: "Receptionist not found" });
    }

    // Patients registered
    const patients = await userModel
      .find({ createdBy: id, role: "patient" })
      .select("fullName age gender email phone createdAt");

    // Appointments booked
    const appointments = await Appointment.find({ bookedBy: id })
      .populate({
        path: "patient",
        select: "fullName age gender",
      })
      .populate({
        path: "doctor",
        select: "specialization department userId",
        populate: [
          { path: "userId", select: "fullName" },
          { path: "department", select: "name" },
        ],
      })
      .sort({ createdAt: -1 });

    // Revenue
    const revenue = appointments.reduce(
      (sum, a) => sum + (a.consultationFee || 0),
      0
    );

    // Today’s appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const todaysAppointments = appointments.filter(
      (a) => a.createdAt >= today && a.createdAt < tomorrow
    ).length;

    // Recent Activity
    const recentActivity = [
      ...patients.slice(-5).map((p) => ({
        type: "Patient Registered",
        action: `Registered patient ${p.fullName}`,
        date: p.createdAt,
      })),
      ...appointments.slice(0, 5).map((a) => ({
        type: "Appointment Booked",
        action: `Booked appointment for ${a.patient?.fullName} with Dr. ${
          a.doctor?.userId?.fullName || "N/A"
        }`,
        date: a.createdAt,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Summary
    const summary = {
      patientsAdded: patients.length,
      appointmentsBooked: appointments.length,
      revenue,
      todayAppointments: todaysAppointments,
    };

    res.status(200).json({
      success: true,
      ...receptionist.toObject(),
      patients,
      appointments,
      recentActivity,
      summary,
    });
  } catch (error) {
    console.error("Error fetching receptionist:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

export const UpdateReceptionist = async (req, res) => {
  try {
    const { id } = req.params; // receptionist ID from URL
    const { fullName, email, password, contact, age, gender } = req.body;

    // find the receptionist
    const receptionist = await userModel.findOne({
      _id: id,
      role: "receptionist",
    });
    if (!receptionist) {
      return res
        .status(404)
        .json({ success: false, message: "Receptionist not found" });
    }

    // update fields if provided
    if (fullName) receptionist.fullName = fullName;
    if (email) receptionist.email = email;
    if (contact) receptionist.contact = contact;
    if (age) receptionist.age = age;
    if (gender) receptionist.gender = gender;

    // update password if given
    if (password) {
      receptionist.password = await bcrypt.hash(password, 10);
    }

    await receptionist.save();

    res.status(200).json({
      success: true,
      message: "Receptionist updated successfully",
      data: receptionist,
    });
  } catch (error) {
    console.error("Error updating receptionist:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

export const DeleteReceptionist = async (req, res) => {
  try {
    const { id } = req.params;
    const receptionist = await userModel.findByIdAndDelete({
      _id: id,
      role: "receptionist",
    });
    if (!receptionist) {
      return res
        .status(404)
        .json({ success: false, message: "Receptionist not found" });
    }
    res.status(200).json({
      success: true,
      message: "Receptionist deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting receptionist:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};
