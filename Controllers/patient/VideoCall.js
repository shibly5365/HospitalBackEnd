import Appointment from "../../Models/Appointment/Appointment.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";

// =====================================================
// Helpers
// =====================================================
const parseAppointmentDateTime = (appointment) => {
  const baseDate = new Date(appointment.appointmentDate);
  if (Number.isNaN(baseDate.getTime())) return null;

  const timeText = appointment?.timeSlot?.start;
  if (!timeText) return baseDate;

  const normalized = String(timeText).trim().toUpperCase();
  const match = normalized.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/);
  if (!match) return baseDate;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3];

  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  const dateTime = new Date(baseDate);
  dateTime.setHours(hours, minutes, 0, 0);
  return dateTime;
};

const isVideoEligibleAppointment = (appointment) =>
  appointment?.status?.toLowerCase() === "confirmed" &&
  appointment?.consultationType?.toLowerCase() === "online";

const resolveAccess = async (appointment, userId) => {
  const normalizedPatientId =
    appointment?.patient?._id?.toString?.() ||
    appointment?.patient?.toString?.();

  const isPatient = normalizedPatientId === userId.toString();

  const doctorId = appointment?.doctor?._id || appointment?.doctor;
  const doctorDoc = await doctorModel.findById(doctorId).select("userId");

  const isDoctor = doctorDoc?.userId?.toString() === userId.toString();

  return {
    isPatient,
    isDoctor,
    role: isDoctor ? "doctor" : isPatient ? "patient" : null,
  };
};

// =====================================================
// Create OR Get Video Call Room (NO TIME LIMIT NOW)
// =====================================================
export const createOrGetVideoCallRoom = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user._id;

    const appointment = await Appointment.findById(appointmentId)
      .populate("patient", "fullName email")
      .populate({
        path: "doctor",
        populate: { path: "userId", select: "fullName email role" },
      });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // ✅ Only confirmed + online
    if (!isVideoEligibleAppointment(appointment)) {
      return res.status(400).json({
        success: false,
        message:
          "Video call is available only for confirmed online appointments",
      });
    }

    // ✅ Only patient or doctor can access
    const { isPatient, isDoctor, role } = await resolveAccess(
      appointment,
      userId,
    );

    if (!isPatient && !isDoctor) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    // ✅ Create room if not exists
    if (!appointment.videoLink) {
      appointment.videoLink = `video_${appointmentId}`;
      await appointment.save();
    }

    return res.status(200).json({
      success: true,
      message: "Video call ready",
      data: {
        roomId: appointment.videoLink,
        appointmentId,
        patientName: appointment.patient?.fullName || "Patient",
        doctorName: appointment.doctor?.userId?.fullName || "Doctor",
        role,
        canJoin: true, // ✅ always true if confirmed + online
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error creating video call",
      error: error.message,
    });
  }
};

// =====================================================
// Get Video Call Status (NO TIME LIMIT NOW)
// =====================================================
export const getVideoCallStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user._id;

    const appointment = await Appointment.findById(appointmentId)
      .populate("patient", "fullName")
      .populate({
        path: "doctor",
        populate: { path: "userId", select: "fullName role" },
      });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // ✅ Only patient or doctor can check
    const { isPatient, isDoctor, role } = await resolveAccess(
      appointment,
      userId,
    );

    if (!isPatient && !isDoctor) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // (still calculated for display, but not used for restriction)
    const appointmentDateTime = parseAppointmentDateTime(appointment);
    const diffMinutes = appointmentDateTime
      ? (appointmentDateTime - new Date()) / 60000
      : null;

    // ✅ If confirmed + online -> canJoin true
    const canJoin = isVideoEligibleAppointment(appointment);

    return res.status(200).json({
      success: true,
      data: {
        canJoin,
        roomId: appointment.videoLink,
        status: appointment.status,
        consultationType: appointment.consultationType,
        appointmentTime: appointmentDateTime,
        timeUntilCall: diffMinutes,
        role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error checking video call status",
      error: error.message,
    });
  }
};

// =====================================================
// End Video Call
// =====================================================
export const endVideoCall = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user._id;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    const { isPatient, isDoctor } = await resolveAccess(appointment, userId);

    if (!isPatient && !isDoctor) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // ✅ Mark appointment completed when call ends
    appointment.status = "Completed";
    await appointment.save();

    return res.status(200).json({
      success: true,
      message: "Video call ended",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error ending video call",
      error: error.message,
    });
  }
};

// Backward-compatible export name used by older imports.
export const generateVideoCallRoom = createOrGetVideoCallRoom;
