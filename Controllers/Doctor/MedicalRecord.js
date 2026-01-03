import doctorModel from "../../Models/Doctor/DoctorModels.js";
import MedicalRecord from "../../Models/MedicalRecord/MedicalRecord.js";
import userModel from "../../Models/User/UserModels.js";

export const createMedicalRecord = async (req, res) => {
  try {
    const doctorUserId = req.user._id;

    // 🔥 Get doctorModel ID
    const doctor = await doctorModel.findOne({ userId: doctorUserId });
    if (!doctor)
      return res.status(404).json({ success: false, message: "Doctor not found" });

    const {
      appointment,
      patient,
      payment,
      chiefComplaint,
      symptoms,
      diagnosis,
      vitals,
      labTests,
      bloodTests,
      notes,
      followUpDate,
      attachments,
    } = req.body;

    if (!appointment || !patient)
      return res.status(400).json({
        success: false,
        message: "Appointment & patient are required",
      });

    // ⭐ Create recordData
    const recordData = {
      appointment,
      patient,
      payment,
      doctor: doctor._id,   // 🔥 FIXED
      chiefComplaint,
      symptoms,
      diagnosis,
      vitals,
      labTests,
      bloodTests: bloodTests || [],
      notes,
      followUpDate,
      attachments,
    };

    // 🩸 Auto blood group save
    if (vitals?.bloodGroup) {
      const bloodGroupValue = vitals.bloodGroup;

      const hasBloodGroupTest = recordData.bloodTests.some(
        (t) => t.testName?.toLowerCase() === "blood group"
      );

      if (!hasBloodGroupTest) {
        recordData.bloodTests.push({
          testName: "Blood Group",
          result: bloodGroupValue,
          unit: "",
        });
      }

      await userModel.findByIdAndUpdate(
        patient,
        { bloodGroup: bloodGroupValue },
        { new: true }
      );
    }

    // SAVE MEDICAL RECORD
    const record = await MedicalRecord.create(recordData);

    return res.status(201).json({
      success: true,
      message: "Medical record created",
      record,
    });
  } catch (err) {
    console.error("createMedicalRecord Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


export const doctorGetAllMedicalRecords = async (req, res) => {
  try {
    const doctorUserId = req.user._id;
    const doctor = await doctorModel.findOne({ userId: doctorUserId }).select("_id").lean();
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    const records = await MedicalRecord.find({ doctor: doctor._id })
      .select("_id appointment patient doctor chiefComplaint diagnosis vitals createdAt")
      .populate({ path: "patient", select: "fullName patientId profileImage" })
      .populate({ path: "appointment", select: "appointmentDate timeSlot" })
      .lean();

    return res.json({ success: true, records });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
export const doctorGetMedicalRecordById = async (req, res) => {
  try {
    const doctorUserId = req.user._id;
    const { id } = req.params;

    const doctor = await doctorModel.findOne({ userId: doctorUserId }).select("_id").lean();
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    const record = await MedicalRecord.findById(id)
      .populate({ path: "patient", select: "fullName patientId" })
      .populate({ path: "appointment", select: "appointmentDate timeSlot reason" })
      .populate({ path: "prescription", select: "medicines notes" })
      .lean();

    if (!record) return res.status(404).json({ success: false, message: "Not found" });

    if (record.doctor.toString() !== doctor._id.toString())
      return res.status(403).json({ success: false, message: "Unauthorized doctor" });

    return res.json({ success: true, record });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
export const updateMedicalRecord = async (req, res) => {
  try {
    const doctorUserId = req.user._id;
    const { id } = req.params;

    const doctor = await doctorModel.findOne({ userId: doctorUserId }).select("_id").lean();
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    const record = await MedicalRecord.findById(id);
    if (!record) return res.status(404).json({ success: false, message: "Record not found" });

    if (record.doctor.toString() !== doctor._id.toString())
      return res.status(403).json({ success: false, message: "Unauthorized doctor" });

    Object.assign(record, req.body);
    await record.save();

    return res.json({ success: true, message: "Updated", record });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
export const deleteMedicalRecord = async (req, res) => {
  try {
    const doctorUserId = req.user._id;
    const { id } = req.params;

    const doctor = await doctorModel.findOne({ userId: doctorUserId }).select("_id").lean();
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    const record = await MedicalRecord.findById(id);
    if (!record) return res.status(404).json({ success: false, message: "Record not found" });

    if (record.doctor.toString() !== doctor._id.toString())
      return res.status(403).json({ success: false, message: "Unauthorized doctor" });

    await MedicalRecord.findByIdAndDelete(id);
    return res.json({ success: true, message: "Medical record deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};


