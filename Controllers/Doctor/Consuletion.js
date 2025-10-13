import Appointment from "../../Models/Appointment/Appointment";

export const getAllConsultations = async (req, res) => {
  try {
    const consultations = await Appointment.find({ consultationType: "Online" })
      .populate("doctor", "fullName specialization email")
      .populate("patient", "fullName age gender")
      .sort({ appointmentDate: -1 });

    if (!consultations.length) {
      return res
        .status(404)
        .json({ success: false, message: "No consultations found" });
    }

    res.json({ success: true, data: consultations });
  } catch (error) {
    console.log("getAllConsultations error", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ➝ Get single consultation by Appointment ID
export const getConsultationById = async (req, res) => {
  try {
    const { id } = req.params;

    const consultation = await Appointment.findById(id)
      .populate("doctor", "fullName specialization email")
      .populate("patient", "fullName age gender");

    if (!consultation) {
      return res
        .status(404)
        .json({ success: false, message: "Consultation not found" });
    }

    res.json({ success: true, data: consultation });
  } catch (error) {
    console.log("getConsultationById error", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
export const getUpcomingConsultations = async (req, res) => {
  try {
    const doctorId = req.user.id;

    const upcoming = await Appointment.find({
      doctor: doctorId,
      consultationType: "Online",
      status: { $in: ["Pending", "Confirmed", "With-Doctor"] },
    })
      .populate("patient", "fullName age gender")
      .sort({ appointmentDate: 1 });

    res.json({ success: true, data: upcoming });
  } catch (error) {
    console.log("getUpcomingConsultations error", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ➝ Get consulted patients (doctor only)
export const getConsultedPatients = async (req, res) => {
  try {
    const doctorId = req.user.id;

    const consulted = await Appointment.find({
      doctor: doctorId,
      consultationType: "Online",
      status: "Completed",
    })
      .populate("patient", "fullName age gender")
      .sort({ appointmentDate: -1 });

    res.json({ success: true, data: consulted });
  } catch (error) {
    console.log("getConsultedPatients error", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
