import userModel from "../../Models/User/UserModels.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import Appointment from "../../models/Appointment/Appointment.js";
import Payment from "../../models/Payments/paymentSchema.js";
import DoctorLeave from "../../Models/LeaveRequest/leaveSchema.js";
import DoctorSchedule from "../../Models/Doctor/ScheduleSchema.js";
import moment from "moment";

export const getAdminDashboardCounts = async (req, res) => {
  try {
    const [totalPatients, totalDoctors, totalAppointments, revenueResult] =
      await Promise.all([
        userModel.countDocuments({ role: "patient" }),
        doctorModel.countDocuments(),
        Appointment.countDocuments(),

        Payment.aggregate([
          {
            $match: {
              status: { $in: ["Paid", "Pending"] },
            },
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$amount" },
            },
          },
        ]),
      ]);

    const totalRevenue = revenueResult[0]?.totalRevenue || 0;

    res.status(200).json({
      success: true,
      data: {
        totalPatients,
        totalDoctors,
        totalAppointments,
        totalRevenue, // ✅ NEW FIELD
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
export const getPendingAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ status: "Pending" })
      .populate("patient", "fullName email contact gender")
      .populate({
        path: "doctor",
        populate: {
          path: "department",
          select: "name",
        },
      })
      .sort({ appointmentDate: 1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const getPatientMonthlyStats = async (req, res) => {
  try {
    const stats = await userModel.aggregate([
      {
        $match: { role: "patient" },
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            type: "$patientType",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const monthMap = {};

    stats.forEach((item) => {
      const month = item._id.month;
      const type = item._id.type;
      const count = item.count;

      if (!monthMap[month]) {
        monthMap[month] = {
          name: new Date(0, month - 1).toLocaleString("default", {
            month: "short",
          }),
          new: 0,
          old: 0,
          other: 0, // ✅ handle "Other"
        };
      }

      if (type === "New Patient") {
        monthMap[month].new += count;
      } else if (type === "Returning Patient") {
        monthMap[month].old += count;
      } else {
        monthMap[month].other += count; // ✅ safe fallback
      }
    });

    res.status(200).json({
      success: true,
      data: Object.values(monthMap),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const getTodayAvailableDoctors = async (req, res) => {
  try {
    const today = new Date().toLocaleString("en-US", { weekday: "long" });

    const doctors = await doctorModel
      .find({
        availableDays: today,
        status: "available",
      })
      .populate("userId", "fullName email contact")
      .populate("department", "name");

    res.status(200).json({
      success: true,
      count: doctors.length,
      data: doctors,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const getPatientGenderStats = async (req, res) => {
  try {
    const stats = await userModel.aggregate([
      {
        $match: { role: "patient" },
      },
      {
        $group: {
          _id: "$gender",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const getPatientAgeStats = async (req, res) => {
  try {
    const stats = await userModel.aggregate([
      {
        $match: { role: "patient" },
      },
      {
        $bucket: {
          groupBy: "$age",
          boundaries: [0, 18, 35, 50, 65, 100],
          default: "Other",
          output: {
            count: { $sum: 1 },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminOverview = async (req, res) => {
  try {
    const now = new Date();

    // ✅ FIX DATE RANGE (IMPORTANT)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // =========================
    // ✅ TOTAL COUNTS
    // =========================
    const totalDoctors = await doctorModel.countDocuments();

    const totalReceptionists = await userModel.countDocuments({
      role: "receptionist",
    });

    const totalStaff = totalDoctors + totalReceptionists;

    // =========================
    // ✅ AVAILABLE DOCTORS
    // =========================
    const availableDoctors = await doctorModel.countDocuments({
      status: "available",
    });

    // =========================
    // ✅ RECEPTIONIST LEAVE (TEMP FIX)
    // ⚠️ you don’t have receptionist leave model yet
    // =========================
    const receptionistsOnLeave = 0;

    const availableReceptionists = totalReceptionists - receptionistsOnLeave;

    // =========================
    // ✅ TOTAL AVAILABLE STAFF
    // =========================
    const totalAvailableStaff = availableDoctors + availableReceptionists;

    // =========================
    // ✅ DOCTORS ON LEAVE
    // =========================
    const doctorsOnLeave = await DoctorLeave.countDocuments({
      status: "approved",
      startDate: { $lte: now },
      endDate: { $gte: now },
    });

    // =========================
    // ✅ TOTAL STAFF ON LEAVE
    // =========================
    const totalStaffOnLeave = doctorsOnLeave + receptionistsOnLeave;

    // =========================
    // ✅ TODAY SCHEDULE
    // =========================
    const todaySchedules = await DoctorSchedule.find({
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    }).populate({
      path: "doctor",
      populate: {
        path: "userId",
        select: "fullName role",
      },
    });

    const availability = todaySchedules.map((s) => ({
      doctorName: s.doctor?.userId?.fullName,
      shift: s.preset,
      isLeave: s.isLeaveDay,
      status: s.isLeaveDay ? "Not Available" : "Available",
    }));

    // =========================
    // ✅ LEAVE REQUESTS
    // =========================
    const leaveRequests = await DoctorLeave.find()
      .populate({
        path: "doctor",
        populate: {
          path: "userId",
          select: "fullName role",
        },
      })
      .sort({ createdAt: -1 });

    const formattedLeaves = leaveRequests.map((l) => ({
      doctorName: l.doctor?.userId?.fullName,
      role: "doctor",
      from: l.startDate,
      to: l.endDate,
      type: l.type,
      reason: l.description,
      status: l.status,
    }));

    // =========================
    // ✅ FINAL RESPONSE
    // =========================
    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalDoctors,
          totalReceptionists,
          totalStaff,

          availableDoctors,
          availableReceptionists,
          totalAvailableStaff,

          doctorsOnLeave,
          totalStaffOnLeave,
        },
        availability,
        leaveRequests: formattedLeaves,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const getAdminAnalytics = async (req, res) => {
  try {
    const { range = "month" } = req.query;

    let startDate;

    // 🔹 Date range logic
    switch (range) {
      case "day":
        startDate = moment().startOf("day").toDate();
        break;
      case "week":
        startDate = moment().startOf("week").toDate();
        break;
      case "year":
        startDate = moment().startOf("year").toDate();
        break;
      default:
        startDate = moment().startOf("month").toDate();
    }

    const endDate = new Date();

    // 🔥 1. TOTAL APPOINTMENTS
    const totalAppointments = await Appointment.countDocuments({
      appointmentDate: { $gte: startDate, $lte: endDate },
    });

    // 🔥 2. COMPLETED APPOINTMENTS
    const completedAppointments = await Appointment.countDocuments({
      status: "Completed",
      appointmentDate: { $gte: startDate, $lte: endDate },
    });

    // 🔥 3. DAILY APPOINTMENT TREND
    const dailyTrends = await Appointment.aggregate([
      {
        $match: {
          appointmentDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$appointmentDate" },
          },
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", "Completed"] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 🔥 4. WEEKLY TREND
    const weeklyTrends = await Appointment.aggregate([
      {
        $match: {
          appointmentDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $week: "$appointmentDate" },

          total: { $sum: 1 },

          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", "Completed"] }, 1, 0],
            },
          },

          cancelled: {
            $sum: {
              $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0],
            },
          },

          // 🔁 Rescheduled logic
          rescheduled: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $ne: ["$previousAppointment", null] },
                    { $ne: ["$nextAppointment", null] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 🔥 5. TOP PERFORMING DOCTORS
    const topDoctors = await Appointment.aggregate([
      {
        $match: {
          status: "Completed",
          appointmentDate: { $gte: startDate, $lte: endDate },
        },
      },

      // 🔹 group by doctor
      {
        $group: {
          _id: "$doctor",

          totalConsultations: { $sum: 1 },

          patients: { $addToSet: "$patient" }, // unique patients
        },
      },

      // 🔹 count unique patients
      {
        $addFields: {
          totalPatients: { $size: "$patients" },
        },
      },

      // 🔹 get ratings
      {
        $lookup: {
          from: "feedbacks", // ⚠️ make sure collection name is correct
          localField: "_id",
          foreignField: "doctor",
          as: "feedbacks",
        },
      },

      {
        $addFields: {
          avgRating: { $avg: "$feedbacks.rating" },
          totalReviews: { $size: "$feedbacks" },
        },
      },

      // 🔹 get doctor info
      {
        $lookup: {
          from: "doctors",
          localField: "_id",
          foreignField: "_id",
          as: "doctor",
        },
      },
      { $unwind: "$doctor" },

      // 🔹 get user (name)
      {
        $lookup: {
          from: "users",
          localField: "doctor.userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },

      // 🔥 final score
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: [{ $ifNull: ["$avgRating", 0] }, 2] },
              "$totalConsultations",
            ],
          },
        },
      },

      // 🔹 sort by best
      {
        $sort: { score: -1 },
      },

      { $limit: 5 },

      // 🔹 clean output
      {
        $project: {
          _id: 0,
          doctorId: "$doctor._id",
          name: "$user.fullName",
          totalConsultations: 1,
          totalPatients: 1,
          avgRating: { $ifNull: ["$avgRating", 0] },
          totalReviews: 1,
          score: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,

      overview: {
        totalAppointments,
        completedAppointments,
      },

      dailyTrends,
      weeklyTrends,
      topDoctors,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
