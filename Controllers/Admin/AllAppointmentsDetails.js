import Appointment from "../../Models/Appointment/Appointment.js";

export const getAllAppointmentsDetails = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(
      1,
      Math.min(200, parseInt(req.query.limit || "50", 10)),
    );
    const skip = (page - 1) * limit;

    const [appointments, total] = await Promise.all([
      Appointment.find()
        .select("_id patient doctor appointmentDate treatment status createdAt")
        .populate("patient", "fullName email") // ✅ extra info if needed
        .populate({
          path: "doctor",
          select: "specialization department userId",
          populate: [
            { path: "userId", select: "fullName email" },
            { path: "department", select: "name" },
          ],
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Appointment.countDocuments(),
    ]);

    // 🔥 Transform safely

    const transformedAppointments = appointments.map((appt) => {
      const patientName = appt.patient?.fullName;

      return {
        _id: appt._id,

        // ✅ Handle missing patient properly
        patientName: patientName ? patientName : "No Patient Linked", // 🔥 clearer than N/A

        appointmentDate: appt.appointmentDate,

        doctorName: appt.doctor?.userId?.fullName || "Unknown Doctor",

        departmentName: appt.doctor?.department?.name || "Unknown Department",

        treatment: appt.treatment || "Not Specified",

        status: appt.status || "Pending",

        // 🔍 DEBUG FLAG (optional, helps you fix DB later)
        hasPatient: !!appt.patient,
      };
    });

    res.status(200).json({
      success: true,
      page,
      limit,
      total,
      appointments: transformedAppointments,
    });
  } catch (error) {
    console.error("❌ Get all appointments details error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params; // appointment id from URL

    // check if exists
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
    }

    await Appointment.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Appointment deleted successfully",
    });
  } catch (error) {
    console.error("deleteAppointment error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // ✅ dynamic status

    // ✅ allowed statuses
    const allowedStatus = ["Confirmed", "Cancelled"];

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    appointment.status = status;
    await appointment.save();

    res.status(200).json({
      success: true,
      message: `Appointment ${status} successfully`,
      data: {
        _id: appointment._id,
        status: appointment.status,
      },
    });
  } catch (error) {
    console.error("updateAppointmentStatus error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getLatestAppointments = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const appointments = await Appointment.find({
      status: { $nin: ["Pending", "Cancelled"] }, // ❌ exclude
    })
      .populate("patient", "fullName patientId profileImage") // ✅ get patientId
      .populate({
        path: "doctor",
        populate: {
          path: "userId",
          select: "fullName profileImage",
        },
      })
      .sort({ createdAt: -1 }) // 🔥 latest first
      .limit(limit)
      .lean();

    const transformed = appointments.map((appt) => ({
      _id: appt._id,

      // ✅ PATIENT
      patientId: appt.patient?.patientId || "N/A",
      patientName: appt.patient?.fullName || "Unknown",
      patientImage: appt.patient?.profileImage || null, // ✅ ADD THIS

      // ✅ DOCTOR
      doctorName: appt.doctor?.userId?.fullName || "Unknown",
      doctorImage: appt.doctor?.userId?.profileImage || null, // ✅ ADD THIS

      // ✅ TYPE
      consultationType: appt.consultationType || "Offline",

      // ✅ DATE + TIME
      date: appt.appointmentDate,
      time: `${appt.timeSlot?.start || ""} - ${appt.timeSlot?.end || ""}`,

      // ✅ STATUS
      status: appt.status,
    }));
    res.status(200).json({
      success: true,
      count: transformed.length,
      data: transformed,
    });
  } catch (error) {
    console.error("getLatestAppointments error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
