import Prescription from "../../Models/prescription/prescription.js";
import MedicalRecord from "../../Models/MedicalRecord/MedicalRecord.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import appointmentModel from "../../Models/Appointment/Appointment.js";
import Appointment from "../../Models/Appointment/Appointment.js";
import conversationModel from "../../Models/messages/conversationSchema.js";

// 🟢 DOCTOR: Create Prescription
export const createPrescription = async (req, res) => {
  try {
    const doctorUserId = req.user._id;

    const { medicalRecord, patient, medicines, notes } = req.body;

    // =====================================================
    // ✅ Validate medical record exists
    // =====================================================

    const record = await MedicalRecord.findById(medicalRecord);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Medical record not found",
      });
    }

    // =====================================================
    // ✅ FIX PAYMENT FIELD
    // =====================================================

    if (record.payment) {
      // if array
      if (Array.isArray(record.payment)) {
        record.payment = record.payment[0]?._id || record.payment[0];
      }

      // if populated object
      else if (typeof record.payment === "object" && record.payment._id) {
        record.payment = record.payment._id;
      }
    }

    // =====================================================
    // ✅ Find doctor
    // =====================================================

    const doctor = await doctorModel.findOne({
      userId: doctorUserId,
    });

    if (!doctor) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized doctor",
      });
    }

    // =====================================================
    // ✅ Validate doctor permission
    // =====================================================

    if (record.doctor.toString() !== doctor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized doctor",
      });
    }

    // =====================================================
    // ✅ Validate patient match
    // =====================================================

    if (record.patient.toString() !== patient.toString()) {
      return res.status(400).json({
        success: false,
        message: "Patient does not match the medical record",
      });
    }

    // =====================================================
    // ✅ Check existing prescription
    // =====================================================

    if (record.prescription) {
      return res.status(400).json({
        success: false,
        message: "Prescription already exists",
      });
    }

    // =====================================================
    // ✅ Create prescription
    // =====================================================

    const newPrescription = await Prescription.create({
      medicalRecord,
      doctor: doctor._id,
      patient,
      medicines,
      notes,
    });

    // =====================================================
    // ✅ Attach prescription
    // =====================================================

    record.prescription = newPrescription._id;
    console.log("RECORD APPOINTMENT:", record.appointment);
    const appointment = await Appointment.findById(
  record.appointment
);

if (appointment) {
  appointment.status = "Completed";
  appointment.completedAt = new Date();

  await appointment.save();
}

    await record.save();
    // =====================================================
    // ✅ Enable 48h consultation chat
    // =====================================================

    const existingConversation = await conversationModel.findOne({
      type: "private",
      members: {
        $all: [patient, doctor.userId],
      },
      $expr: {
        $eq: [{ $size: "$members" }, 2],
      },
    });

    if (existingConversation) {
      existingConversation.chatExpiresAt = new Date(
        Date.now() + 48 * 60 * 60 * 1000,
      );

      await existingConversation.save();
    }

    // =====================================================
    // ✅ Complete appointment
    // =====================================================

    return res.status(201).json({
      success: true,
      message: "Prescription created successfully",
      prescription: newPrescription,
    });
  } catch (err) {
    console.error("Create Prescription Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
// 🟢 DOCTOR: Get All Prescriptions Created by Doctor
// ======================================================
// 🟢 DOCTOR: GET ALL PRESCRIPTIONS
// ======================================================

export const doctorGetAllPrescriptions = async (req, res) => {
  try {
    const doctorUserId = req.user._id;

    // ✅ Find doctorModel
    const doctor = await doctorModel
      .findOne({
        userId: doctorUserId,
      })
      .select("_id")
      .lean();

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // ✅ Fetch prescriptions
    const prescriptions = await Prescription.find({
      doctor: doctor._id,
    })
      .populate(
        "patient",
        "_id fullName age gender contact patientId profileImage",
      )
      .populate({
        path: "medicalRecord",
        populate: [
          {
            path: "appointment",
          },
          {
            path: "payment",
          },
        ],
      })
      .sort({ createdAt: -1 });

    // ======================================================
    // STATS + FILTERED LISTS
    // ======================================================

    const totalPrescriptions = prescriptions.length;

    const uniquePatients = [];
    const uniqueSet = new Set();

    const completedList = [];
    const completedSet = new Set();

    const archivedList = [];
    const archivedSet = new Set();

    for (const p of prescriptions) {
      if (!p.patient) continue;

      const pid = p.patient._id.toString();

      // UNIQUE PATIENTS
      if (!uniqueSet.has(pid)) {
        uniqueSet.add(pid);
        uniquePatients.push(p);
      }

      // COMPLETED
      if (
        (p.medicalRecord?.status === "Completed" ||
          p.medicalRecord?.status === "completed") &&
        !completedSet.has(pid)
      ) {
        completedSet.add(pid);
        completedList.push(p);
      }

      // ARCHIVED
      if (
        (p.medicalRecord?.status === "Archived" ||
          p.medicalRecord?.status === "archived") &&
        !archivedSet.has(pid)
      ) {
        archivedSet.add(pid);
        archivedList.push(p);
      }
    }

    return res.json({
      success: true,

      totalPrescriptions,

      uniquePatientsCount: uniquePatients.length,
      uniquePatients,

      completedCount: completedList.length,
      completedList,

      archivedCount: archivedList.length,
      archivedList,
    });
  } catch (err) {
    console.error("doctorGetAllPrescriptions Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ======================================================
// 🟢 DOCTOR: GET PRESCRIPTION BY ID
// ======================================================

export const doctorGetPrescriptionById = async (req, res) => {
  try {
    const doctorUserId = req.user._id;

    const { id } = req.params;

    // ✅ Find doctorModel
    const doctor = await doctorModel
      .findOne({
        userId: doctorUserId,
      })
      .select("_id")
      .lean();

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // ✅ Find prescription
    const prescription = await Prescription.findById(id)
      .populate(
        "patient",
        "_id fullName age gender contact patientId profileImage bloodGroup",
      )
      .populate({
        path: "medicalRecord",
        populate: [
          {
            path: "appointment",
          },
          {
            path: "payment",
          },
        ],
      });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
    }

    // ✅ Security Check
    if (prescription.doctor.toString() !== doctor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized doctor",
      });
    }

    return res.json({
      success: true,
      prescription,
    });
  } catch (err) {
    console.error("doctorGetPrescriptionById Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// 🟡 DOCTOR: Update Prescription
export const updatePrescription = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const { id } = req.params;

    const prescription = await Prescription.findById(id);
    if (!prescription)
      return res.status(404).json({ success: false, message: "Not found" });

    if (prescription.doctor.toString() !== doctorId.toString())
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized doctor" });

    const updated = await Prescription.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    res.json({ success: true, message: "Updated", prescription: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔴 DOCTOR: Delete Prescription
export const deletePrescription = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const { id } = req.params;

    const prescription = await Prescription.findById(id);
    if (!prescription)
      return res.status(404).json({ success: false, message: "Not found" });

    if (prescription.doctor.toString() !== doctorId.toString())
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized doctor" });

    // Remove from medical record
    await MedicalRecord.findByIdAndUpdate(prescription.medicalRecord, {
      $unset: { prescription: "" },
    });

    await prescription.deleteOne();

    res.json({ success: true, message: "Prescription deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DOCTOR: Get Appointment By ID (for prescription page)
export const getAppointmentById = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await appointmentModel
      .findById(appointmentId)
      .populate({
        path: "doctor",
        select: "userId",
        populate: {
          path: "userId",
          select: "fullName",
        },
      })
      .populate({
        path: "patient",
        select: "fullName",
      });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Appointment fetched",
      appointment,
    });
  } catch (err) {
    console.error("Get Appointment By ID Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
