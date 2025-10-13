import Appointment from "../../Models/Appointment/Appointment.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import MedicalRecord from "../../Models/MedicalRecord/MedicalRecord.js";
import userModel from "../../Models/User/UserModels.js";

export const addPatient = async (req, res) => {
  try {
    const {
      fullName,
      email,
      contact,
      age,
      gender,
      dob,
      address,
      patientType,
      medicalInfo,
      emergencyContact,
    } = req.body;

    // Check if email already exists
    const existingPatient = await userModel.findOne({ email });
    if (existingPatient) {
      return res.status(400).json({
        success: false,
        message: "Patient with this email already exists",
      });
    }

    const doctor = await doctorModel.findOne({ userId: req.user._id });
    const newPatient = new userModel({
      fullName,
      email,
      contact,
      age,
      gender,
      dob,
      address,
      medicalInfo,
      emergencyContact,
      patientType,
      role: "patient",
      createdByDoctor: doctor ? doctor._id : null, // ✅ link doctor
    });

    await newPatient.save();
    res.status(201).json({
      success: true,
      message: "Patient added successfully",
      patient: newPatient,
    });
  } catch (error) {
    console.error("Add Patient Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Get all patients created by doctor or linked via appointments
export const getDoctorAllPatients = async (req, res) => {
  try {
    const doctorUserId = req.user._id;

    // 1️⃣ Get doctor document
    const doctor = await doctorModel.findOne({ userId: doctorUserId });
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    // 2️⃣ Get patients created directly by doctor
    const createdPatients = await userModel
      .find({
        role: "patient",
        createdByDoctor: doctor._id,
      })
      .select("-password");

    // 3️⃣ Get patients from appointments
    const appointments = await Appointment.find({ doctor: doctor._id })
      .populate("patient") // get full patient object
      .sort({ appointmentDate: 1 });

    // 4️⃣ Merge patients into a map to avoid duplicates
    const patientMap = new Map();

    // Add created patients
    for (let patient of createdPatients) {
      const records = await MedicalRecord.find({ patient: patient._id });
      patientMap.set(patient._id.toString(), {
        id: patient._id,
        fullName: patient.fullName,
        email: patient.email,
        gender: patient.gender,
        age: patient.age || 0,
        dob: patient.dob,
        address: patient.address,
        medicalInfo: patient.medicalInfo,
        emergencyContact: patient.emergencyContact,
        prescriptions: [], // if prescriptions are separate, fetch similarly
        medicalRecords: records,
        lastVisit: null,
        nextAppointment: null,
        reason: null,
      });
    }

    // Add patients from appointments
    for (let appt of appointments) {
      if (!appt.patient) continue;

      const patientId = appt.patient._id.toString();
      const appointmentDate = appt.appointmentDate;

      if (!patientMap.has(patientId)) {
        const records = await MedicalRecord.find({ patient: patientId });

        patientMap.set(patientId, {
          id: appt.patient._id,
          fullName: appt.patient.fullName,
          email: appt.patient.email,
          gender: appt.patient.gender,
          age: appt.patient.age || 0,
          dob: appt.patient.dob,
          address: appt.patient.address,
          medicalInfo: appt.patient.medicalInfo,
          emergencyContact: appt.patient.emergencyContact,
          prescriptions: [], // add prescriptions if needed
          medicalRecords: records,
          lastVisit: appointmentDate,
          nextAppointment:
            appointmentDate >= new Date() ? appointmentDate : null,
          reason: appt.reason || null,
        });
      } else {
        const patientData = patientMap.get(patientId);

        // update last visit
        if (!patientData.lastVisit || appointmentDate > patientData.lastVisit) {
          patientData.lastVisit = appointmentDate;
        }

        // update next appointment
        if (appointmentDate >= new Date() && !patientData.nextAppointment) {
          patientData.nextAppointment = appointmentDate;
        }
      }
    }

    const patients = Array.from(patientMap.values());

    res.status(200).json({
      success: true,
      message: patients.length
        ? "All patients fetched successfully"
        : "No patients found",
      patients,
    });
  } catch (error) {
    console.error("Get Doctor All Patients Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
