import Appointment from "../../Models/Appointment/Appointment.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";

export const joinVideoCall = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // ✅ logged user id
    const userId = req.user._id;

    // ✅ find appointment
    const appointment = await Appointment.findById(appointmentId);
    console.log(appointment);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Appointment not found",
      });
    }

    // ✅ find doctor document
    const doctor = await doctorModel.findOne({
      userId: userId,
    });

    // ✅ patient check
    const isPatient =
      appointment.patient.toString() === userId.toString();

    // ✅ doctor check
    const isDoctor =
      doctor &&
      appointment.doctor.toString() === doctor._id.toString();

    // 🔒 only doctor or patient can join
    if (!isPatient && !isDoctor) {
      return res.status(403).json({
        success: false,
        error: "Not allowed",
      });
    }

    // 🔒 online only
    if (appointment.consultationType !== "Online") {
      return res.status(400).json({
        success: false,
        error: "Not online consultation",
      });
    }

    // 🔒 appointment must be active
    if (
      !["Confirmed", "With-Doctor"].includes(
        appointment.status
      )
    ) {
      return res.status(400).json({
        success: false,
        error: "Appointment not active",
      });
    }

    // 🔒 video enabled
    if (!appointment.videoCallEnabled) {
      return res.status(400).json({
        success: false,
        error: "Video call not enabled",
      });
    }

    // ✅ activate call first time
    if (appointment.videoCallStatus === "ready") {
      appointment.videoCallStatus = "active";

      await appointment.save();
    }

    // ✅ success response
    return res.status(200).json({
      success: true,
      data: {
        roomId: appointment.videoCallRoomId,
        status: appointment.videoCallStatus,
        canJoin: true,
      },
    });

  } catch (err) {
    console.error("joinVideoCall:", err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};
export const endVideoCall = async (req, res) => {
  try {
    const { appointmentId } = req.body;

    const userId = req.user._id;

    const appointment = await Appointment.findById(
      appointmentId
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Appointment not found",
      });
    }

    const doctor = await doctorModel.findOne({
      userId,
    });

    const isPatient =
      appointment.patient.toString() ===
      userId.toString();

    const isDoctor =
      doctor &&
      appointment.doctor.toString() ===
        doctor._id.toString();

    if (!isPatient && !isDoctor) {
      return res.status(403).json({
        success: false,
        error: "Not allowed",
      });
    }

    // ✅ END CALL
    appointment.videoCallStatus = "ended";

    // ✅ COMPLETE CONSULTATION
    appointment.status = "Completed";

    appointment.completedAt = new Date();

    await appointment.save();

    return res.json({
      success: true,
      message: "Consultation completed",
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};
export const getCallStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({ error: "Not found" });
    }

    return res.json({
      status: appointment.videoCallStatus,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
