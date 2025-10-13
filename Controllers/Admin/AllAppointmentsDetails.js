import Appointment from "../../Models/Appointment/Appointment.js";

export const getAllAppointmentsDetails = async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate("patient", "fullName")
      .populate({
        path: "doctor",
        select: "specialization department userId",
        populate: [
          { path: "userId", select: "fullName" },
               { path: "department", select: "name" },
        ],
      })
      .sort({ createdAt: -1 });

      // console.log(appointments);
      
    // Transform data to only send required fields
    const transformedAppointments = appointments.map((appt) => ({
      _id: appt._id,
      patientName: appt.patient?.fullName || "N/A",
      appointmentDate: appt.appointmentDate,
      doctorName: appt.doctor?.userId?.fullName || "N/A",
         departmentName: appt.doctor?.department?.name || "N/A",
      treatment: appt.treatment || "N/A",
      status: appt.status || "Pending",
    }));

    res.status(200).json({ appointments: transformedAppointments });
  } catch (error) {
    console.log("getAllAppointmentsDetails in admin:", error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params; // appointment id from URL

    // check if exists
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
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

export const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params; // appointment id

    // check if appointment exists
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    // update status to Cancelled
    appointment.status = "Cancelled";
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully",
      appointment: {
        _id: appointment._id,
        status: appointment.status,
      },
    });
  } catch (error) {
    console.error("cancelAppointment error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};