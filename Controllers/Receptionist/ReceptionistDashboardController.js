import Appointment from "../../Models/Appointment/Appointment.js";
import userModel from "../../Models/User/UserModels.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import Payment from "../../Models/Payments/paymentSchema.js";
import MedicalRecord from "../../Models/MedicalRecord/MedicalRecord.js";
import Prescription from "../../Models/prescription/prescription.js";

// Helper: Get today's date range
const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// Get comprehensive receptionist dashboard data
export const getReceptionistDashboard = async (req, res) => {
  try {
    const { start, end } = getTodayRange();
    const now = new Date();

    // Get today's appointments
    const todayAppointments = await Appointment.find({
      appointmentDate: { $gte: start, $lte: end },
    })
      .populate({
        path: "patient",
        select: "fullName email contact patientId gender age",
      })
      .populate({
        path: "doctor",
        populate: [
          {
            path: "userId",
            select: "fullName profileImage",
          },
          {
            path: "department",
            select: "name description",
          },
        ],
      })
      .sort({ appointmentDate: 1 });

    // Get upcoming appointments (next 5)
    const upcomingAppointments = await Appointment.find({
      appointmentDate: { $gt: end },
      status: { $nin: ["Cancelled", "Completed", "Missed"] },
    })
      .populate({
        path: "patient",
        select: "fullName email contact",
      })
      .populate({
        path: "doctor",
        populate: [
          {
            path: "userId",
            select: "fullName",
          },
          {
            path: "department",
            select: "name description",
          },
        ],
      })
      .sort({ appointmentDate: 1 })
      .limit(5);

    // Get waiting room (Pending, Confirmed, With-Doctor)
    const waitingRoom = todayAppointments.filter((apt) =>
      ["Pending", "Confirmed", "With-Doctor"].includes(apt.status)
    );

    // Get status counts
    const statusCounts = todayAppointments.reduce(
      (acc, apt) => {
        acc[apt.status] = (acc[apt.status] || 0) + 1;
        return acc;
      },
      { Pending: 0, Confirmed: 0, "With-Doctor": 0, Completed: 0, Cancelled: 0 }
    );

    // Get today's registered patients
    const todayRegisteredPatients = await userModel.countDocuments({
      role: "patient",
      createdAt: { $gte: start, $lte: end },
    });

    // Get total patients
    const totalPatients = await userModel.countDocuments({ role: "patient" });

    // Get available doctors today
    const doctorsWithAppointments = await Appointment.distinct("doctor", {
      appointmentDate: { $gte: start, $lte: end },
      status: { $in: ["Confirmed", "With-Doctor"] },
    });

    const availableDoctors = await doctorModel
      .find({ _id: { $in: doctorsWithAppointments } })
      .populate({
        path: "userId",
        select: "fullName profileImage",
      })
      .populate({
        path: "department",
        select: "departmentName",
      })
      .limit(10);

    // Get recent activity (last 10 appointments created today)
    const recentActivity = await Appointment.find({
      createdAt: { $gte: start, $lte: end },
    })
      .populate({
        path: "patient",
        select: "fullName",
      })
      .populate({
        path: "doctor",
        populate: {
          path: "userId",
          select: "fullName",
        },
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Format recent activity
    const formattedActivity = recentActivity.map((act) => ({
      id: act._id,
      type: "appointment",
      patientName: act.patient?.fullName || "Unknown",
      doctorName: act.doctor?.userId?.fullName || "Unknown",
      timestamp: act.createdAt,
      status: act.status,
    }));

    // Calculate total revenue today
    const todayPayments = await Payment.find({
      createdAt: { $gte: start, $lte: end },
      status: "Paid",
    });

    const totalRevenue = todayPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

    res.json({
      success: true,
      data: {
        stats: {
          todayAppointments: todayAppointments.length,
          upcomingAppointments: upcomingAppointments.length,
          waitingRoom: waitingRoom.length,
          todayRegisteredPatients,
          totalPatients,
          totalRevenue,
          statusCounts,
        },
        appointments: {
          today: todayAppointments,
          upcoming: upcomingAppointments,
          waitingRoom,
        },
        availableDoctors,
        recentActivity: formattedActivity,
      },
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get patient complete details (appointments, payments, medical records)
export const getPatientCompleteDetails = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Get patient info
    const patient = await userModel.findById(patientId).select("-password");
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    // Get all appointments
    const appointments = await Appointment.find({ patient: patientId })
      .populate({
        path: "doctor",
        populate: [
          {
            path: "userId",
            select: "fullName profileImage",
          },
          {
            path: "department",
            select: "name description",
          },
        ],
      })
      .populate("receptionist", "fullName email")
      .sort({ appointmentDate: -1 });

    // Get all payments
    const payments = await Payment.find({ patient: patientId })
      .populate("appointment")
      .sort({ createdAt: -1 });

    // Get all medical records
    const medicalRecords = await MedicalRecord.find({ patient: patientId })
      .populate({
        path: "doctor",
        populate: {
          path: "userId",
          select: "fullName",
        },
      })
      .populate("appointment")
      .populate("prescription")
      .sort({ createdAt: -1 });

    // Get all prescriptions
    const prescriptions = await Prescription.find({ patient: patientId })
      .populate({
        path: "doctor",
        populate: {
          path: "userId",
          select: "fullName",
        },
      })
      .populate("medicalRecord")
      .sort({ createdAt: -1 });

    // Calculate total spent
    const totalSpent = payments
      .filter((p) => p.status === "Paid")
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    res.json({
      success: true,
      data: {
        patient,
        appointments,
        payments,
        medicalRecords,
        prescriptions,
        summary: {
          totalAppointments: appointments.length,
          completedAppointments: appointments.filter((a) => a.status === "Completed").length,
          totalSpent,
          totalPayments: payments.length,
          totalMedicalRecords: medicalRecords.length,
          totalPrescriptions: prescriptions.length,
        },
      },
    });
  } catch (error) {
    console.error("Patient Details Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
