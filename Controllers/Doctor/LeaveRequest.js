import doctorModel from "../../Models/Doctor/DoctorModels.js";
import DoctorLeave from "../../Models/LeaveRequest/LeaveSchema.js";


export const createLeaveRequest = async (req, res) => {
  try {
    // Get doctor ID from logged-in user (from middleware/auth)
    const doctor = req.user.id; // assuming your auth middleware sets req.user

    let { startDate, endDate, type, description, duration } = req.body;

    // If endDate not provided, assume one-day leave
    if (!endDate) endDate = startDate;

    // Validation
    if (!startDate || !type || !description || !duration) {
      return res.status(400).json({ 
        success: false, 
        message: "All fields are required: startDate, type, description, duration" 
      });
    }

    // Validate type
    if (!["sick", "casual"].includes(type.toLowerCase())) {
      return res.status(400).json({ success: false, message: "Invalid leave type" });
    }

    // Validate duration
    if (!["Full Day", "Half Day"].includes(duration)) {
      return res.status(400).json({ success: false, message: "Invalid duration" });
    }

    // Create leave request
    const leave = await DoctorLeave.create({
      doctor,
      startDate,
      endDate,
      type: type.toLowerCase(),
      description,
      duration,
    });

    // Log the leave request
    console.log("Leave Request Created:", leave);

    res.status(201).json({ success: true, message: "Leave request submitted", leave });
  } catch (error) {
    console.error("Error creating leave:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDoctorLeaves = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const leaves = await DoctorLeave.find({ doctor: doctorId, status: "approved" });

    res.status(200).json({ success: true, leaves });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approveLeave = async (req, res) => {
  try {
    const { leaveId } = req.params;

    const leave = await DoctorLeave.findById(leaveId);
    if (!leave) return res.status(404).json({ success: false, message: "Leave not found" });

    leave.status = "approved";
    await leave.save();

    // Optional: block doctor's schedule slots for leave period
    // await blockDoctorSlotsForLeave(leave.doctor, leave.startDate, leave.endDate);

    res.status(200).json({ success: true, message: "Leave approved", leave });
  } catch (error) {
    console.error("approveLeave error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectLeave = async (req, res) => {
  try {
    const { leaveId } = req.params;

    const leave = await DoctorLeave.findById(leaveId);
    if (!leave) return res.status(404).json({ success: false, message: "Leave not found" });

    leave.status = "rejected";
    await leave.save();

    res.status(200).json({ success: true, message: "Leave rejected", leave });
  } catch (error) {
    console.error("rejectLeave error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
