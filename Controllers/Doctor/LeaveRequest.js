import doctorModel from "../../Models/Doctor/DoctorModels.js";
import DoctorLeave from "../../Models/LeaveRequest/leaveSchema.js";
import DoctorSchedule from "../../Models/Doctor/ScheduleSchema.js";
import Appointment from "../../Models/Appointment/Appointment.js";
import moment from "moment";

const blockDoctorScheduleForLeave = async (doctorId, startDate, endDate) => {
  const start = moment(startDate);
  const end = moment(endDate);

  while (start <= end) {
    const date = start.format("YYYY-MM-DD");

    await DoctorSchedule.updateMany(
      {
        doctor: doctorId,
        date: date,
      },
      { $set: { isAvailable: false } }
    );

    start.add(1, "day");
  }
};

const cancelAppointmentsDuringLeave = async (doctorId, startDate, endDate) => {
  await Appointment.updateMany(
    {
      doctor: doctorId,
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    },
    {
      $set: { status: "cancelled_by_hospital" },
    }
  );
};

export const createLeaveRequest = async (req, res) => {
  try {
    const doctor = req.user.id; // from auth middleware

    let { startDate, endDate, type, description, duration } = req.body;

    if (!endDate) endDate = startDate; // single-day leave

    // Validation
    if (!startDate || !type || !description || !duration) {
      return res.status(400).json({
        success: false,
        message: "All fields required: startDate, type, description, duration",
      });
    }

    if (!["sick", "casual"].includes(type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid leave type",
      });
    }

    if (!["Full Day", "Half Day"].includes(duration)) {
      return res.status(400).json({
        success: false,
        message: "Invalid duration (Full Day / Half Day only)",
      });
    }

    const leave = await DoctorLeave.create({
      doctor,
      startDate,
      endDate,
      type: type.toLowerCase(),
      description,
      duration,
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
    const { doctorId } = req.params;

    const leaves = await DoctorLeave.find({ doctor: doctorId });

    res.status(200).json({
      success: true,
      leaves,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
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
      leave.endDate
    );
    await cancelAppointmentsDuringLeave(
      leave.doctor,
      leave.startDate,
      leave.endDate
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
