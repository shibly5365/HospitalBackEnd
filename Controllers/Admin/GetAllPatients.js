import userModel from "../../Models/User/UserModels.js";
import Appointment from "../../Models/Appointment/Appointment.js";
import Payment from "../../Models/Payments/paymentSchema.js";
import MedicalRecord from "../../Models/MedicalRecord/MedicalRecord.js";
import Prescription from "../../Models/prescription/prescription.js";

const buildVisitHistory = (appointments, medicalRecords) => {
  const history = [];

  appointments.forEach(a => {
    history.push({
      type: "Appointment",
      appointmentId: a._id,
      doctor: a.doctor?.userId?.fullName,
      specialization: a.doctor?.specialization,
      date: a.appointmentDate,
      status: a.status,
      consultationType: a.consultationType,
    });
  });

  medicalRecords.forEach(m => {
    history.push({
      type: "MedicalRecord",
      recordId: m._id,
      doctor: m.doctor?.userId?.fullName,
      diagnosis: m.diagnosis,
      date: m.createdAt,
      notes: m.notes,
    });
  });

  return history.sort((a, b) => new Date(b.date) - new Date(a.date));
};

const calculateSummary = (appointments) => {
  const lastVisit = appointments
    .filter(a => a.status === "Completed")
    .sort((a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate))[0];

  const upcoming = appointments
    .filter(a => ["Pending", "Confirmed"].includes(a.status))
    .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate))[0];

  let onlineVisits = 0, offlineVisits = 0;
  const doctorsMap = {};

  appointments.forEach(a => {
    if (a.consultationType === "Online") onlineVisits++;
    if (a.consultationType === "Offline") offlineVisits++;

    if (a.doctor) {
      const docId = a.doctor._id.toString();
      if (!doctorsMap[docId]) {
        doctorsMap[docId] = {
          id: a.doctor._id,
          name: a.doctor.userId?.fullName,
          email: a.doctor.userId?.email,
          specialization: a.doctor.specialization,
          department: a.doctor.department,
          qualification: a.doctor.qualification,
          experience: a.doctor.experience,
          visits: [],
        };
      }
      doctorsMap[docId].visits.push({
        appointmentId: a._id,
        date: a.appointmentDate,
        status: a.status,
        consultationType: a.consultationType,
      });
    }
  });

  return {
    totalVisits: appointments.length,
    onlineVisits,
    offlineVisits,
    lastVisitDate: lastVisit?.appointmentDate || null,
    upcomingAppointment: upcoming || null,
    cancelledCount: appointments.filter(a => a.status === "Cancelled").length,
    doctorsSeen: Object.values(doctorsMap),
    departmentsVisited: [...new Set(Object.values(doctorsMap).map(d => d.department).filter(Boolean))],
  };
};

export const getAllPatients = async (req, res) => {
  try {
    const patients = await userModel.find({ role: "patient" })
      .select("-password -resetToken -verifyOtp");

    const appointments = await Appointment.find()
      .populate({
        path: "doctor",
        select: "specialization department qualification experience consultationFee userId",
        populate: [
          { path: "userId", select: "fullName email" },
          { path: "department", select: "name" }
        ]
      })
      .populate("patient", "fullName email phone age gender patientId address");

    const medicalRecords = await MedicalRecord.find()
      .populate({
        path: "doctor",
        populate: { path: "userId", select: "fullName email" }
      });

    const prescriptions = await Prescription.find()
      .populate({
        path: "doctor",
        populate: { path: "userId", select: "fullName email" }
      });

    const payments = await Payment.find();

    const mapByPatient = (items) =>
      items.reduce((acc, item) => {
        const pid = item.patient?.toString();
        if (!pid) return acc;
        acc[pid] = acc[pid] || [];
        acc[pid].push(item);
        return acc;
      }, {});

    const appMap = mapByPatient(appointments);
    const recordMap = mapByPatient(medicalRecords);
    const prescMap = mapByPatient(prescriptions);
    const payMap = mapByPatient(payments);

    const result = patients.map(p => {
      const pid = p._id.toString();
      const patientAppointments = appMap[pid] || [];
      const patientRecords = recordMap[pid] || [];
      const patientPrescriptions = prescMap[pid] || [];
      const patientPayments = payMap[pid] || [];

      return {
        id: p._id,
        fullName: p.fullName,
        email: p.email,
        contact: p.contact,
        gender: p.gender,
        age: p.age,
        dob: p.dob,
        patientId: p.patientId,
        address: p.address,
        status: p.status || "active",

        appointments: patientAppointments,
        medicalRecords: patientRecords,
        prescriptions: patientPrescriptions,
        payments: patientPayments,

        visitHistory: buildVisitHistory(patientAppointments, patientRecords),
        summary: calculateSummary(patientAppointments),
      };
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("getAllPatients Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await userModel.findById(id)
      .select("-password -resetToken -verifyOtp");

    if (!patient)
      return res.status(404).json({ success: false, message: "Patient not found" });

    const appointments = await Appointment.find({ patient: id })
      .populate({
        path: "doctor",
        select: "specialization department qualification experience consultationFee userId",
        populate: [
          { path: "userId", select: "fullName email" },
          { path: "department", select: "name" }
        ]
      })
      .populate("patient", "fullName email phone age gender patientId address");

    const medicalRecords = await MedicalRecord.find({ patient: id })
      .populate({
        path: "doctor",
        populate: { path: "userId", select: "fullName email" }
      })
      .populate("prescription");

    const prescriptions = await Prescription.find({ patient: id })
      .populate({
        path: "doctor",
        populate: { path: "userId", select: "fullName email" }
      });

    const payments = await Payment.find({ patient: id });

    res.status(200).json({
      id: patient._id,
      fullName: patient.fullName,
      email: patient.email,
      contact: patient.contact,
      gender: patient.gender,
      age: patient.age,
      dob: patient.dob,
      patientId: patient.patientId,
      address: patient.address,
      status: patient.status || "active",

      appointments,
      medicalRecords,
      prescriptions,
      payments,

      visitHistory: buildVisitHistory(appointments, medicalRecords),
      summary: calculateSummary(appointments),
    });

  } catch (error) {
    console.error("getPatientById error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;

    await Appointment.deleteMany({ patient: id });
    await MedicalRecord.deleteMany({ patient: id });
    await Prescription.deleteMany({ patient: id });
    await Payment.deleteMany({ patient: id });

    await userModel.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: "Patient deleted successfully" });
  } catch (error) {
    console.error("deletePatient error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const togglePatientStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "blocked"].includes(status.toLowerCase()))
      return res.status(400).json({ success: false, message: "Invalid status" });

    const patient = await userModel.findById(id);
    if (!patient)
      return res.status(404).json({ success: false, message: "Patient not found" });

    patient.status = status.toLowerCase();
    await patient.save();

    res.status(200).json({
      success: true,
      message: `Patient status updated to ${patient.status}`,
      patient: { id: patient._id, fullName: patient.fullName, status: patient.status }
    });
  } catch (error) {
    console.error("togglePatientStatus error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
