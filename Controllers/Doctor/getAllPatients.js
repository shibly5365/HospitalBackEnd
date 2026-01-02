import Appointment from "../../Models/Appointment/Appointment.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import MedicalRecord from "../../Models/MedicalRecord/MedicalRecord.js";
import userModel from "../../Models/User/UserModels.js";

// ⭐ Get all patients of the doctor
export const getDoctorAllPatients = async (req, res) => {
  try {
    const doctorUserId = req.user._id;

    // 1️⃣ Find doctor profile
    const doctor = await doctorModel.findOne({ userId: doctorUserId });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // 2️⃣ Fetch all appointments for this doctor
    const appointments = await Appointment.find({
      doctor: doctor._id,
    })
      .populate(
        "patient",
        "fullName email contact gender dob age profileImage address"
      )
      .sort({ appointmentDate: -1 });

    const patientMap = new Map();

    for (const a of appointments) {
      if (!a.patient) continue;

      const uniqueKey = a.patient._id.toString();
      if (!patientMap.has(uniqueKey)) {
        patientMap.set(uniqueKey, {
          id: a.patient._id,
          fullName: a.patient.fullName,
          email: a.patient.email,
          gender: a.patient.gender,
          age: a.patient.age,
          dob: a.patient.dob,
          phone: a.patient.contact,
          profileImage: a.patient.profileImage,
          address: a.patient.address || {},

          totalVisits: 0,
          lastVisit: null,

          appointmentHistory: [],
        });
      }

      const patient = patientMap.get(uniqueKey);
      patient.appointmentHistory.push({
        appointmentId: a._id,
        appointmentDate: a.appointmentDate,
        timeSlot: a.timeSlot,
        status: a.status,
        reason: a.reason,
        type: a.type,
        address: a.address || {},
      });

      patient.totalVisits++;
      if (
        !patient.lastVisit ||
        new Date(a.appointmentDate) > new Date(patient.lastVisit)
      ) {
        patient.lastVisit = a.appointmentDate;
      }
    }
    const patients = Array.from(patientMap.values());

    res.status(200).json({
      success: true,
      message: "Doctor all unique patients fetched",
      totalPatients: patients.length,
      patients,
    });
  } catch (err) {
    console.error("getDoctorAllPatients Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getPatientById = async (req, res) => {
  try {
    const doctorUserId = req.user._id;
    const patientId = req.params.id;

    const doctor = await doctorModel.findOne({ userId: doctorUserId });
    if (!doctor)
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });

    const isLinked = await Appointment.findOne({
      doctor: doctor._id,
      patient: patientId,
    });

    if (!isLinked)
      return res.status(403).json({
        success: false,
        message: "This patient has never visited this doctor",
      });

    const patient = await userModel
      .findById(patientId)
      .select(
        "fullName email phone contact gender dob age bloodGroup address profileImage emergencyContact"
      );

    if (!patient)
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });

    // -------------------------------------------------------
    // 1️⃣ FETCH MEDICAL RECORDS
    // -------------------------------------------------------
    const medicalRecords = await MedicalRecord.find({
      patient: patientId,
      doctor: doctor._id,
    })
      .populate({
        path: "prescription",
        populate: [
          { path: "doctor", select: "fullName specialization" },
          {
            path: "patient",
            select: "fullName email phone gender age address profileImage",
          },
        ],
      })
      .populate("appointment")
      .populate("payment")
      .sort({ createdAt: -1 });

    // -------------------------------------------------------
    // 2️⃣ AUTO-SYNC APPOINTMENT STATUS BASED ON MEDICAL RECORD STATUS
    // -------------------------------------------------------
    for (const record of medicalRecords) {
      if (record.appointment) {
        const newStatus = record.status === "archived" ? "completed" : "active";

        await Appointment.findByIdAndUpdate(
          record.appointment._id,
          { status: newStatus },
          { new: true }
        );
      }
    }

    // -------------------------------------------------------
    // 3️⃣ FETCH UPDATED APPOINTMENTS
    // -------------------------------------------------------
    const appointments = await Appointment.find({
      doctor: doctor._id,
      patient: patientId,
    })
      .sort({ appointmentDate: -1 })
      .select(
        "appointmentDate timeSlot reason type status paymentStatus payment method address"
      );

    const lastVisit = appointments[0] || null;
    const nextFollowUp = medicalRecords.find((m) => m.followUpDate) || null;

    // -------------------------------------------------------
    // 4️⃣ DOCTOR NOTES
    // -------------------------------------------------------
    const doctorNotes = medicalRecords.map((record) => ({
      note: record.notes || "",
      createdAt: record.createdAt,
    }));

    // -------------------------------------------------------
    // 5️⃣ TREATMENT HISTORY
    // -------------------------------------------------------
    const treatmentHistory = medicalRecords.map((record) => ({
      id: record._id,
      date: record.createdAt,
      status: record.status || "completed",

      diagnosis: record.diagnosis || "Not provided",

      prescription: record.prescription
        ? record.prescription.medicines?.map((m) => ({
            medicineName: m.medicineName,
            dosage: m.dosage,
            frequency: m.frequency,
            duration: m.duration,
            instructions: m.instructions,
          }))
        : [],

      notes: record.notes || "",
      amount: record.payment?.amount || 0,
      duration: record.duration || null,
      followUpRequired: record.followUpRequired || false,
      followUpDate: record.followUpDate || null,

      appointmentId: record.appointment?._id,
    }));

    // -------------------------------------------------------
    // 6️⃣ FINANCIAL HISTORY
    // -------------------------------------------------------
    const financialHistory = medicalRecords.map((record) => ({
      id: record.payment?._id,
      date: record.createdAt,
      amount: record.payment?.amount || 0,
      status: record.payment?.status || "Not paid",
      method: record.payment?.method || "Unknown",
    }));

    const totalRevenue = financialHistory.reduce(
      (sum, item) => sum + (item.amount || 0),
      0
    );

    // -------------------------------------------------------
    // 7️⃣ VISIT HISTORY
    // -------------------------------------------------------
    const visitHistory = appointments.map((a) => ({
      appointmentId: a._id,
      date: a.appointmentDate,
      timeSlot: a.timeSlot,
      reason: a.reason,
      status: a.status,
      type: a.type,
      paymentStatus: a.paymentStatus,
      address: a.address || {},
      paymentDetails: {
        amount: a.payment?.amount || null,
        method: a.payment?.method || null,
        status: a.payment?.status || "Not Paid",
      },
    }));

    // -------------------------------------------------------
    // 8️⃣ FINAL RESPONSE
    // -------------------------------------------------------
    res.status(200).json({
      success: true,
      message: "Patient full overview loaded successfully",

      overview: {
        totalVisits: appointments.length,
        lastVisit: lastVisit
          ? {
              id: lastVisit._id,
              date: lastVisit.appointmentDate,
              timeSlot: lastVisit.timeSlot,
              reason: lastVisit.reason,
              status: lastVisit.status,
              address: lastVisit.address,
            }
          : null,

        nextFollowUp: nextFollowUp
          ? {
              date: nextFollowUp.followUpDate,
              note: nextFollowUp.followUpNote,
            }
          : null,

        totalRevenue,
      },

      patient: {
        id: patient._id,
        fullName: patient.fullName,
        email: patient.email,
        phone: patient.phone || patient.contact,
        gender: patient.gender,
        age: patient.age,
        dob: patient.dob,
        bloodGroup:
          patient.bloodGroup ||
          medicalRecords[0]?.vitals?.bloodGroup ||
          "Not Provided",
        address: patient.address || {},
        emergencyContact: patient.emergencyContact || {},
        profileImage: patient.profileImage || null,
      },

      doctorNotes,
      treatmentHistory,
      financialHistory,
      visitHistory,
      appointments,
      medicalRecords,
    });
  } catch (err) {
    console.error("getPatientById Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
