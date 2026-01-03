import mongoose from "mongoose";
import Appointment from "../../Models/Appointment/Appointment.js";
import userModel from "../../Models/User/UserModels.js";
import activityModel from "../../Models/Activity/activity.js";

// Helper function for today's date range
const getTodayRange = () => {
  const start = new Date().setHours(0, 0, 0, 0);
  const end = new Date().setHours(23, 59, 59, 999);
  return { start, end };
};

// Get all appointments
export const getAllAppointments = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || "50", 10)));
    const skip = (page - 1) * limit;

    const [appointments, total] = await Promise.all([
      Appointment.find()
        .select("_id patient doctor appointmentDate timeSlot status")
        .populate("patient", "fullName patientId contact profileImage")
        .populate({ path: "doctor", select: "userId specialization" , populate: { path: "userId", select: "fullName profileImage" } })
        .sort({ appointmentDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Appointment.countDocuments(),
    ]);

    res.status(200).json({ success: true, page, limit, total, data: appointments });
  } catch (error) {
    console.error("Error fetching all appointments:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Today's appointments
export const getTodayAppointments = async (req, res) => {
  try {
    const { start, end } = getTodayRange();
    const appointments = await Appointment.find({ appointmentDate: { $gte: start, $lte: end } })
      .select("_id patient doctor appointmentDate timeSlot status")
      .populate("patient", "fullName contact patientId")
      .populate({ path: "doctor", select: "userId", populate: { path: "userId", select: "fullName" } })
      .sort({ "timeSlot.start": 1 })
      .lean();

    res.status(200).json({ success: true, count: appointments.length, data: appointments });
  } catch (error) {
    console.error("Error fetching today's appointments:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Today's appointment summary (count per status)
export const getTodayStatusCounts = async (req, res) => {
  try {
    const { start, end } = getTodayRange();
    const statusCounts = await Appointment.aggregate([
      {
        $match: {
          appointmentDate: { $gte: new Date(start), $lte: new Date(end) },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({ success: true, data: statusCounts });
  } catch (error) {
    console.error("Error getting today's status counts:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Get all patients with count
export const getPatientsWithCount = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || "25", 10)));
    const skip = (page - 1) * limit;

    const [patients, count] = await Promise.all([
      userModel.find({ role: "patient" }).select("fullName email contact patientId profileImage").skip(skip).limit(limit).lean(),
      userModel.countDocuments({ role: "patient" }),
    ]);

    res.status(200).json({ success: true, page, limit, count, data: patients });
  } catch (error) {
    console.error("Error getting patients:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Waiting room list for today (Pending, Confirmed, With-Doctor)
export const getWaitingRoomList = async (req, res) => {
  try {
    const { start, end } = getTodayRange();
    const waitingList = await Appointment.find({ appointmentDate: { $gte: start, $lte: end }, status: { $in: ["Pending", "Confirmed", "With-Doctor"] } })
      .select("_id patient doctor appointmentDate timeSlot status")
      .populate("patient", "fullName contact patientId")
      .populate({ path: "doctor", select: "userId", populate: { path: "userId", select: "fullName" } })
      .sort({ "timeSlot.start": 1 })
      .lean();

    res.status(200).json({ success: true, data: waitingList });
  } catch (error) {
    console.error("Error getting waiting room list:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Upcoming appointments (after today)
export const getUpcomingAppointments = async (req, res) => {
  try {
    const { end } = getTodayRange();
    const upcoming = await Appointment.find({ appointmentDate: { $gt: new Date(end) } })
      .select("_id patient doctor appointmentDate timeSlot status")
      .populate("patient", "fullName contact")
      .populate({ path: "doctor", select: "userId", populate: { path: "userId", select: "fullName" } })
      .sort({ appointmentDate: 1 })
      .lean();

    res.status(200).json({ success: true, data: upcoming });
  } catch (error) {
    console.error("Error getting upcoming appointments:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Receptionist activity
export const getReceptionistActivity = async (req, res) => {
  try {
    const receptionistId = req.user._id; // Assuming auth middleware sets req.user
    const activities = await activityModel
      .find({ doctorId: receptionistId })
      .sort({
        createdAt: -1,
      });

    res.status(200).json({ success: true, data: activities });
  } catch (error) {
    console.error("Error getting receptionist activity:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getDoctorsOnDutyToday = async (req, res) => {
  try {
    const { start, end } = getTodayRange();
    const doctorIds = await Appointment.distinct("doctor", {
      appointmentDate: { $gte: start, $lte: end },
    });
    const doctors = await userModel.find({ _id: { $in: doctorIds }, role: "doctor" }).select("fullName profileImage").lean();
    res.status(200).json({ success: true, data: doctors });
  } catch (error) {
    console.error("Error getting today's doctors on duty:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
