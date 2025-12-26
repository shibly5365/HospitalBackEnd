import Prescription from "../../Models/prescription/prescription.js";
import MedicalRecord from "../../Models/MedicalRecord/MedicalRecord.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";

// 🟢 DOCTOR: Create Prescription
export const createPrescription = async (req, res) => {
  try {
    const doctorUserId = req.user._id;

    const { medicalRecord, patient, medicines, notes } = req.body;

    // 1️⃣ Validate medical record exists
    const record = await MedicalRecord.findById(medicalRecord);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Medical record not found",
      });
    }

    // 2️⃣ Find doctor by userId
    const doctor = await doctorModel.findOne({ userId: doctorUserId });
    if (!doctor) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized doctor",
      });
    }

    // 3️⃣ Validate doctor permission
    if (record.doctor.toString() !== doctor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized doctor",
      });
    }

    // 4️⃣ Validate patient match
    if (record.patient.toString() !== patient.toString()) {
      return res.status(400).json({
        success: false,
        message: "Patient does not match the medical record",
      });
    }

    // 5️⃣ Check if prescription already exists
    if (record.prescription) {
      return res.status(400).json({
        success: false,
        message: "Prescription already exists for this visit",
      });
    }

    // 6️⃣ Create prescription
    const newPrescription = await Prescription.create({
      medicalRecord,
      doctor: doctor._id,
      patient,
      medicines,
      notes,
      date: new Date(),
    });

    // 7️⃣ Attach prescription to medical record
    record.prescription = newPrescription._id;
    await record.save();

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
export const doctorGetAllPrescriptions = async (req, res) => {
  try {
    const doctorId = req.user._id;

    // Fetch ALL prescriptions by doctor
    const prescriptions = await Prescription.find({ doctor: doctorId })
      .populate("patient", "_id fullName age gender contact patientId")
      .populate("medicalRecord");

    // TOTAL prescriptions count
    const totalPrescriptions = prescriptions.length;

    // Unique patients
    const uniquePatients = [];
    const uniqueSet = new Set();

    // Completed
    const completedList = [];
    const completedSet = new Set();

    // Archived
    const archivedList = [];
    const archivedSet = new Set();


    for (const p of prescriptions) {
      if (!p.patient) continue;

      const pid = p.patient._id.toString();

      // UNIQUE PATIENT LIST
      if (!uniqueSet.has(pid)) {
        uniqueSet.add(pid);
        uniquePatients.push(p);
      }

      // COMPLETED LIST
      if ((p.status === "Completed" || p.status === "completed") && !completedSet.has(pid)) {
        completedSet.add(pid);
        completedList.push(p);
      }

      // ARCHIVED LIST
      if ((p.status === "Archived" || p.status === "archived") && !archivedSet.has(pid)) {
        archivedSet.add(pid);
        archivedList.push(p);
      }
    }

    res.json({
      success: true,

      // 🔵 All unique patients with any prescription
      uniquePatientsCount: uniquePatients.length,
      uniquePatients,

      // 🟣 Total prescriptions (even duplicates)
      totalPrescriptions,

      // 🟢 Completed list + count
      completedCount: completedList.length,
      completedList,

      // 🟡 Archived list + count
      archivedCount: archivedList.length,
      archivedList
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};




// 🟢 DOCTOR: Get Prescription by ID
export const doctorGetPrescriptionById = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const { id } = req.params;

    const prescription = await Prescription.findById(id)
      .populate("patient","_id fullName age gender contact patientId")
      .populate("medicalRecord");

    if (!prescription)
      return res.status(404).json({ success: false, message: "Not found" });

    if (prescription.doctor.toString() !== doctorId.toString())
      return res.status(403).json({ success: false, message: "Unauthorized doctor" });

    res.json({ success: true, prescription });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
      return res.status(403).json({ success: false, message: "Unauthorized doctor" });

    const updated = await Prescription.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

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
      return res.status(403).json({ success: false, message: "Unauthorized doctor" });

    // Remove from medical record
    await MedicalRecord.findByIdAndUpdate(
      prescription.medicalRecord,
      { $unset: { prescription: "" } }
    );

    await prescription.deleteOne();

    res.json({ success: true, message: "Prescription deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


