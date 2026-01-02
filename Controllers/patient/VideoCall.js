import Appointment from "../../Models/Appointment/Appointment.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";

// ==========================================
// Generate Video Call Room ID
// ==========================================
export const generateVideoCallRoom = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    // Verify appointment exists
    const appointment = await Appointment.findById(appointmentId)
      .populate("patient", "name email")
      .populate("doctor", "name email");
    // console.log("appiijt",appointment);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Only allow patient owner or the assigned doctor to create the room
    const isPatient = appointment.patient._id.toString() === userId.toString();
    // resolve doctor document to compare its userId to current user
    const doctorDoc = await doctorModel.findById(appointment.doctor);
    const isDoctor =
      doctorDoc &&
      doctorDoc.userId &&
      doctorDoc.userId.toString() === userId.toString();
    if (!isPatient && !isDoctor) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Not part of this appointment",
      });
    }

    // Check if appointment is confirmed
    console.log(appointment.status);
    
    if (appointment.status !== "Confirmed") {
      return res.status(400).json({
        success: false,
        message: `Video call not allowed. Appointment status is "${appointment.status}"`,
      });
    }

    // Check if appointment is online
    if (appointment.consultationType?.toLowerCase() !== "online") {
      return res.status(400).json({
        success: false,
        message: "This is an offline appointment",
      });
    }

    // Check appointment time window for patients only. Doctors may create the room any time after confirmation.
    const appointmentDateTime = new Date(
      `${appointment.appointmentDate}T${appointment.timeSlot.start}`
    );
    const currentTime = new Date();
    const diffMinutes = (appointmentDateTime - currentTime) / 60000;

    if (userRole !== "doctor") {
      if (diffMinutes > 30 || diffMinutes < -30) {
        return res.status(400).json({
          success: false,
          message:
            "Video call can only be joined 30 minutes before or after appointment time",
        });
      }
    }

    // Generate unique room ID if not exists
    let roomId = appointment.videoLink;
    if (!roomId) {
      roomId = `room_${appointmentId}_${Date.now()}`;
      appointment.videoLink = roomId;
      await appointment.save();
    }

    return res.status(200).json({
      success: true,
      message: "Video call room created",
      data: {
        roomId,
        appointmentId,
        patientName: appointment.patient.name,
        doctorName: appointment.doctor.name,
        appointmentTime: appointmentDateTime,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error generating video call",
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

    const isPatientEnd = appointment.patient.toString() === userId.toString();
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
