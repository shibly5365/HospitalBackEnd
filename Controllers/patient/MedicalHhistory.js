import Appointment from "../../Models/Appointment/Appointment.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import MedicalRecord from "../../Models/MedicalRecord/MedicalRecord.js";
import activityModel from "../../Models/Activity/activity.js";

// ➝ Generate video link for online consultation
const generateVideoLink = (appointmentId) => {
  return `https://meet.jit.si/${appointmentId}-${Date.now()}`;
};

// ==========================
// Consultation Workflow
// ==========================

// ➝ Get doctor's queue for online consultations
export const getDoctorQueue = async (req, res) => {
  try {
    const doctorId = req.user.id;

    const appointments = await Appointment.find({
      doctor: doctorId,
      consultationType: "Online",
      status: { $in: ["Pending", "Confirmed"] },
    })
      .populate("patient", "fullName age gender")
      .sort({ appointmentDate: 1 });

    res.status(202).json({ success: true, appointments });
  } catch (error) {
    console.log("getDoctorQueue error", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ➝ Start video consultation
export const startConsultation = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId)
      .populate("patient", "fullName age gender")
      .populate("doctor", "specialization");

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    const videoLink = generateVideoLink(appointmentId);
    appointment.status = "With-Doctor";
    await appointment.save();

    await activityModel.create({
      doctorId: appointment.doctor,
      patientId: appointment.patient,
      patientName: appointment.patient.fullName,
      action: "Started video consultation",
      type: "consultation",
    });

    res.json({ success: true, videoLink, appointment });
  } catch (error) {
    console.log("startConsultation error", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================
// Medical Record Workflow
// ==========================

// ➝ Create medical record (includes prescriptions)
export const createMedicalRecord = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "doctor") {
      return res.status(403).json({ success: false, message: "Only doctors can create medical records" });
    }

    const {
      appointmentId,
      patientId,
      prescription,
      diagnosis,
      notes,
      followUpDate,
      attachments,
      vitals,
    } = req.body;

    const doctor = await doctorModel.findOne({ userId: req.user._id });
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor profile not found" });

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patient: patientId,
      doctor: doctor._id,
      status: { $in: ["Confirmed", "With-Doctor"] },
    });

    if (!appointment) return res.status(404).json({ success: false, message: "No valid appointment found" });

    // Preserve existing bloodGroup if already set
    const existingRecord = await MedicalRecord.findOne({ patient: patientId, "vitals.bloodGroup": { $exists: true } });
    const bloodGroupToSet = existingRecord ? existingRecord.vitals.bloodGroup : vitals?.bloodGroup;

    const record = await MedicalRecord.create({
      appointment: appointmentId,
      patient: patientId,
      doctor: doctor._id,
      prescription,
      diagnosis,
      notes,
      followUpDate,
      attachments,
      vitals: {
        bloodPressure: vitals?.bloodPressure,
        heartRate: vitals?.heartRate,
        temperature: vitals?.temperature,
        weight: vitals?.weight,
        height: vitals?.height,
        bloodGroup: bloodGroupToSet,
        bloodSugar: vitals?.bloodSugar,
        hemoglobin: vitals?.hemoglobin,
      },
    });

    // Mark appointment as completed
    appointment.status = "Completed";
    await appointment.save();

    // Log activity
    await activityModel.create({
      doctorId: doctor._id,
      patientId,
      patientName: req.body.patientName || "Unknown",
      action: "Created medical record / Issued prescription",
      type: "medicalRecord",
    });

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.log("createMedicalRecord error", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ➝ Update medical record (doctor only)
export const updateMedicalRecord = async (req, res) => {
  try {
    if (req.user.role !== "doctor") {
      return res.status(403).json({ success: false, message: "Only doctors can update" });
    }

    const record = await MedicalRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: "Not found" });

    // Prevent changing bloodGroup if already set
    const newVitals = { ...req.body.vitals };
    if (record.vitals?.bloodGroup) delete newVitals.bloodGroup;

    // Merge vitals
    record.vitals = { ...record.vitals, ...newVitals };

    // Update other fields
    if (req.body.prescription) record.prescription = req.body.prescription;
    if (req.body.diagnosis) record.diagnosis = req.body.diagnosis;
    if (req.body.notes) record.notes = req.body.notes;
    if (req.body.followUpDate) record.followUpDate = req.body.followUpDate;
    if (req.body.attachments) record.attachments = req.body.attachments;

    await record.save();

    await activityModel.create({
      doctorId: req.user._id,
      patientId: record.patient,
      action: "Updated medical record",
      type: "medicalRecord",
    });

    res.json({ success: true, data: record });
  } catch (error) {
    console.log("updateMedicalRecord error", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ➝ Archive medical record (soft delete)
export const archiveMedicalRecord = async (req, res) => {
  try {
    if (req.user.role !== "doctor") {
      return res.status(403).json({ success: false, message: "Only doctors can archive records" });
    }

    const archived = await MedicalRecord.findByIdAndUpdate(
      req.params.id,
      { status: "archived" },
      { new: true }
    );

    if (!archived) return res.status(404).json({ success: false, message: "Not found" });

    await activityModel.create({
      doctorId: req.user._id,
      patientId: archived.patient,
      action: "Archived medical record",
      type: "medicalRecord",
    });

    res.json({ success: true, data: archived });
  } catch (error) {
    console.log("archiveMedicalRecord error", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ==========================
// Medical Record Retrieval
// ==========================

// ➝ Patient gets all their own medical history
export const getMyMedicalHistory = async (req, res) => {
  try {
    if (req.user.role !== "patient") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Find all medical records for this patient
    const records = await MedicalRecord.find({ patient: req.user._id })
      .populate({
        path: "doctor",
        select: "fullName email specialization phone experience",
      })
      .populate({
        path: "appointment",
        select: "date time department status",
      })
      .populate({
        path: "payment",
        select: "amount method status transactionId createdAt",
      })
      .sort({ createdAt: -1 });

    if (!records.length) {
      return res.status(404).json({ success: false, message: "No medical records found" });
    }

    // Format and enrich response
    const formattedRecords = records.map((rec) => ({
      id: rec._id,
      doctor: rec.doctor,
      checkupDate: rec.appointment?.date || rec.createdAt,
      department: rec.appointment?.department,
      consultationNotes: rec.consultationNotes,
      medicalHistory: rec.medicalHistory,
      prescription: rec.prescription,
      payment: rec.payment
        ? {
            amount: rec.payment.amount,
            method: rec.payment.method,
            status: rec.payment.status,
            billDate: rec.payment.createdAt,
            transactionId: rec.payment.transactionId,
          }
        : null,
    }));

    res.json({ success: true, data: formattedRecords });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// ➝ Doctor gets all records for a specific patient
export const getMedicalRecordById = async (req, res) => {
  try {
    if (req.user.role !== "doctor") return res.status(403).json({ success: false, message: "Access denied" });

    const { id } = req.params;

    const records = await MedicalRecord.find({ patient: id })
      .populate("doctor", "fullName email specialization")
      .populate("patient", "fullName age gender")
      .sort({ createdAt: -1 });

    if (!records.length) return res.status(404).json({ success: false, message: "Record not found" });

    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ➝ Patient gets records only for one doctor
export const getMyMedicalHistoryByDoctor = async (req, res) => {
  try {
    if (req.user.role !== "patient") return res.status(403).json({ success: false, message: "Access denied" });

    const { doctorId } = req.params;

    const records = await MedicalRecord.find({
      patient: req.user._id,
      doctor: doctorId,
    })
      .populate("doctor", "fullName email specialization")
      .sort({ createdAt: -1 });

    if (!records.length) return res.status(404).json({ success: false, message: "No records found for this doctor" });

    res.json({ success: true, data: records });
  } catch (err) {
    console.log("getMyMedicalHistoryByDoctor error", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
