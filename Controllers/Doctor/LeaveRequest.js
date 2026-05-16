import doctorModel from "../../Models/Doctor/DoctorModels.js";
import DoctorLeave from "../../Models/LeaveRequest/leaveSchema.js";
import DoctorSchedule from "../../Models/Doctor/ScheduleSchema.js";
import Appointment from "../../Models/Appointment/Appointment.js";
import moment from "moment";

const blockDoctorScheduleForLeave = async (doctorId, startDate, endDate) => {
  const start = moment(startDate).startOf("day").toDate();
  const end = moment(endDate).endOf("day").toDate();

  await DoctorSchedule.updateMany(
    {
      doctor: doctorId,
      date: { $gte: start, $lte: end },
    },
    { $set: { isLeaveDay: true } },
  );
};

const cancelAppointmentsDuringLeave = async (doctorId, startDate, endDate) => {
  await Appointment.updateMany(
    {
      doctor: doctorId,
      appointmentDate: {
        $gte: moment(startDate).startOf("day").toDate(),
        $lte: moment(endDate).endOf("day").toDate(),
      },
      status: { $in: ["Pending", "Confirmed"] },
    },
    {
      $set: { status: "Cancelled", notes: "Cancelled due to approved leave" },
    },
  );
};

export const createLeaveRequest = async (req, res) => {
  try {
    const doctorData = await doctorModel.findOne({ userId: req.user._id });

    if (!doctorData) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    const doctor = doctorData._id;

    let {
      startDate,
      endDate,
      type,
      description,
      durationType,
      duration,
      startTime,
      endTime,
    } = req.body;

    durationType = durationType || duration || "Full Day";

    if (!endDate) endDate = startDate; // single-day leave

    // Validation
    if (!startDate || !type || !description || !durationType) {
      return res.status(400).json({
        success: false,
        message:
          "All fields required: startDate, type, description, durationType",
      });
    }

    if (
      !["sick", "casual", "emergency", "personal"].includes(type.toLowerCase())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid leave type",
      });
    }

    if (
      ![
        "Full Day",
        "Half Day - Morning",
        "Half Day - Afternoon",
        "Hourly",
      ].includes(durationType)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid durationType (Full Day / Half Day - Morning / Half Day - Afternoon / Hourly)",
      });
    }

    const existing = await DoctorLeave.findOne({
      doctor,
      status: { $in: ["pending", "approved"] },
      startDate: { $lte: moment(endDate).endOf("day").toDate() },
      endDate: { $gte: moment(startDate).startOf("day").toDate() },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Leave already requested for this date",
      });
    }

    const leave = await DoctorLeave.create({
      doctor,
      startDate,
      endDate,
      type: type.toLowerCase(),
      description,
      durationType,
      startTime,
      endTime,
      status: "pending", // default
    });

    res.status(201).json({
      success: true,
      message: "Leave request submitted",
      leave,
    });
  } catch (error) {
    console.error("Error creating leave:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getDoctorLeaves = async (req, res) => {
  try {
    const { id } = req.params;

    const leaves = await DoctorLeave.find({ doctor: id })
      .sort({ startDate: -1 })
      .lean();

    // 🔹 Split data
    const pendingLeaves = leaves.filter((l) => l.status === "pending");
    const approvedLeaves = leaves.filter((l) => l.status === "approved");
    const rejectedLeaves = leaves.filter((l) => l.status === "rejected");

    // 🔹 Stats
    const totalLeaves = leaves.length;
    const totalApproved = approvedLeaves.length;
    const totalRejected = rejectedLeaves.length;
    const totalPending = pendingLeaves.length;

    // 🔹 Format response (clean for frontend)
    res.json({
      success: true,

      stats: {
        totalLeaves,
        totalApproved,
        totalRejected,
        totalPending,
      },

      pending: pendingLeaves,
      history: leaves, // full history (or use only approved + rejected if you want)
    });
  } catch (err) {
    console.error("getDoctorLeaves error:", err);
    res.status(500).json({ success: false });
  }
};

export const approveLeave = async (req, res) => {
  try {
    const { leaveId } = req.params;

    const leave = await DoctorLeave.findById(leaveId);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave not found",
      });
    }

    leave.status = "approved";
    await leave.save();

    // Operations after approval
    await blockDoctorScheduleForLeave(
      leave.doctor,
      leave.startDate,
      leave.endDate,
    );
    await DoctorSchedule.updateMany(
      {
        doctor: leave.doctor,
        date: {
          $gte: moment(leave.startDate).startOf("day").toDate(),
          $lte: moment(leave.endDate).endOf("day").toDate(),
        },
      },
      { $set: { leaveRef: leave._id } },
    );
    await cancelAppointmentsDuringLeave(
      leave.doctor,
      leave.startDate,
      leave.endDate,
    );

    res.status(200).json({
      success: true,
      message: "Leave approved and doctor marked unavailable",
      leave,
    });
  } catch (error) {
    console.error("approveLeave error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const rejectLeave = async (req, res) => {
  try {
    const { leaveId } = req.params;

    const leave = await DoctorLeave.findById(leaveId);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave not found",
      });
    }

    leave.status = "rejected";
    await leave.save();

    res.status(200).json({
      success: true,
      message: "Leave rejected",
      leave,
    });
  } catch (error) {
    console.error("rejectLeave error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllLeaveRequests = async (req, res) => {
  try {
    const leaves = await DoctorLeave.find({
      status: { $in: ["pending", "approved"] },
    })
      .populate({
        path: "doctor",
        populate: {
          path: "userId",
          model: "users",
          select: "fullName email",
        },
      })
      .sort({ createdAt: -1 })
      .lean();

    // 🔥 Format for frontend
    const formattedLeaves = leaves.map((l) => ({
      id: l._id,

      // ✅ Correct name from User model
      staffName: l.doctor?.userId?.fullName || "Doctor",

      role: "Doctor",

      // ✅ Clean date format
      startDate: moment(l.startDate).format("YYYY-MM-DD"),
      endDate: moment(l.endDate).format("YYYY-MM-DD"),

      leaveType: l.type,
      reason: l.description,
      status: l.status,
    }));

    // 🔹 Separate data
    const pending = formattedLeaves.filter((l) => l.status === "pending");
    const approved = formattedLeaves.filter((l) => l.status === "approved");

    // 🔹 Stats
    const stats = {
      total: formattedLeaves.length,
      pending: pending.length,
      approved: approved.length,
    };

    return res.status(200).json({
      success: true,
      stats,
      pending,
      approved,
      requests: formattedLeaves, // 🔥 frontend friendly
    });
  } catch (error) {
    console.error("getAllLeaveRequests error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
