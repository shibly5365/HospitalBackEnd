import Appointment from "../../Models/Appointment/Appointment.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";

// ==========================================
// Generate Video Call Room ID
// ==========================================
export const generateVideoCallRoom = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user._id;

    // Find appointment
    const appointment = await Appointment.findById(appointmentId)
      .populate("patient", "name email")
      .populate("doctor", "name email");

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Check appointment is confirmed
    if (appointment.status !== "Confirmed") {
      return res.status(400).json({
        success: false,
        message: "Video call available only for confirmed appointments",
      });
    }

    // Check online consultation
    if (appointment.consultationType !== "online") {
      return res.status(400).json({
        success: false,
        message: "This appointment is not online",
      });
    }

    // Authorization: patient or doctor
    const isPatient =
      appointment.patient._id.toString() === userId.toString();

    const doctorDoc = await doctorModel.findById(appointment.doctor);
    const isDoctor =
      doctorDoc?.userId?.toString() === userId.toString();

    if (!isPatient && !isDoctor) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    // Create room if not exists
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
        patientName: appointment.patient.name,
        doctorName: appointment.doctor.name,
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


// ==========================================
// Get Video Call Status
// ==========================================
export const getVideoCallStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user._id;

    const appointment = await Appointment.findById(appointmentId)
      .populate("patient", "name")
      .populate("doctor", "name");

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Allow patient or doctor to query status
    const isPatientStatus =
      appointment.patient._id.toString() === userId.toString();
    const doctorDoc = await doctorModel.findById(appointment.doctor);
    const isDoctorStatus =
      doctorDoc &&
      doctorDoc.userId &&
      doctorDoc.userId.toString() === userId.toString();
    if (!isPatientStatus && !isDoctorStatus) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const appointmentDateTime = new Date(
      `${appointment.appointmentDate}T${appointment.timeSlot.start}`
    );
    const currentTime = new Date();
    const diffMinutes = (appointmentDateTime - currentTime) / 60000;

    // doctors can join once confirmed (no time restriction); patients only within ±30 minutes
    const userRole = req.user.role;
    let canJoin = false;
    if (
      appointment.status?.toLowerCase() === "confirmed" &&
      appointment.consultationType?.toLowerCase() === "online"
    ) {
      if (userRole === "doctor") {
        canJoin = true;
      } else {
        canJoin = diffMinutes >= -30 && diffMinutes <= 30;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        canJoin,
        roomId: appointment.videoLink,
        status: appointment.status,
        consultationType: appointment.consultationType,
        appointmentTime: appointmentDateTime,
        timeUntilCall: diffMinutes,
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

// ==========================================
// End Video Call
// ==========================================
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

    const isPatientEnd = appointment.patient._id.toString() === userId.toString();
    const doctorDoc = await doctorModel.findById(appointment.doctor);
    const isDoctorEnd =
      doctorDoc &&
      doctorDoc.userId &&
      doctorDoc.userId.toString() === userId.toString();
    if (!isPatientEnd && !isDoctorEnd) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Update appointment status to completed
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
