import MedicalRecord from "../../Models/MedicalRecord/MedicalRecord.js";
import userModel from "../../Models/User/UserModels.js";
import Prescription from "../../Models/prescription/prescription.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import Appointment from "../../Models/Appointment/Appointment.js";
import Payment from "../../Models/Payments/paymentSchema.js";

// ===============================
// 1️⃣ GET ALL MEDICAL RECORDS (PATIENT) - Formatted for Frontend
// ===============================
export const patientGetAllMedicalRecords = async (req, res) => {
  try {
    const patientId = req.user._id;

    // Get patient info
    const patient = await userModel.findById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    // Get all medical records
    const records = await MedicalRecord.find({ patient: patientId })
      .populate({
        path: "doctor",
        populate: [
          {
            path: "userId",
            select: "fullName profileImage",
          },
          {
            path: "department",
            select: "departmentName",
          },
        ],
      })
      .populate("appointment")
      .populate("prescription")
      .sort({ createdAt: -1 });

    // Get all prescriptions
    const prescriptions = await Prescription.find({ patient: patientId })
      .populate({
        path: "doctor",
        populate: [
          {
            path: "userId",
            select: "fullName",
          },
          {
            path: "department",
            select: "departmentName",
          },
        ],
      })
      .populate({
        path: "medicalRecord",
        populate: {
          path: "appointment",
        },
      })
      .sort({ createdAt: -1 });

    // Format prescriptions for frontend
    const formattedPrescriptions = prescriptions.map((prescription) => {
      const doctor = prescription.doctor;
      const doctorName = doctor?.userId?.fullName || "Unknown Doctor";
      const departmentName = doctor?.department?.departmentName || "Unknown Department";
      const record = prescription.medicalRecord;
      const appointment = record?.appointment;

      return {
        id: prescription._id,
        date: appointment?.appointmentDate
          ? new Date(appointment.appointmentDate).toISOString().split("T")[0]
          : prescription.createdAt
          ? new Date(prescription.createdAt).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        doctor: `Dr. ${doctorName}`,
        department: departmentName,
        medicines: prescription.medicines.map((med) => ({
          name: med.medicineName,
          dosage: med.dosage || "",
          duration: med.duration || "",
          frequency: med.frequency || "",
          instructions: med.instructions || "",
        })),
        notes: prescription.notes || "",
      };
    });

    // Format consultations from medical records
    const formattedConsultations = records
      .filter((record) => record.appointment)
      .map((record) => {
        const doctor = record.doctor;
        const doctorName = doctor?.userId?.fullName || "Unknown Doctor";
        const departmentName = doctor?.department?.departmentName || "Unknown Department";
        const appointment = record.appointment;

        return {
          id: record._id,
          date: appointment?.appointmentDate
            ? new Date(appointment.appointmentDate).toISOString().split("T")[0]
            : record.createdAt
            ? new Date(record.createdAt).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          doctor: `Dr. ${doctorName}`,
          department: departmentName,
          reason: record.chiefComplaint || appointment?.reason || "General Consultation",
          notes: record.notes || record.symptoms || "",
          diagnosis: record.diagnosis || [],
        };
      });

    // Format lab reports
    const formattedLabReports = records
      .filter((record) => record.labReports && record.labReports.length > 0)
      .flatMap((record) => {
        return record.labReports.map((labReport) => ({
          id: labReport._id || record._id,
          date: labReport.date
            ? new Date(labReport.date).toISOString().split("T")[0]
            : record.createdAt
            ? new Date(record.createdAt).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          test: labReport.reportType || "Lab Report",
          file: labReport.fileUrl ? labReport.fileUrl.split("/").pop() : "Report.pdf",
          url: labReport.fileUrl || "#",
          type: labReport.fileUrl?.split(".").pop() || "pdf",
          summary: labReport.summary || "",
        }));
      });

    // Get vitals from latest record or patient profile
    const latestRecord = records[0];
    const vitals = latestRecord?.vitals || {};

    // Calculate age from DOB
    const calculateAge = (dob) => {
      if (!dob) return null;
      const today = new Date();
      const birthDate = new Date(dob);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    };

    // Format patient data for frontend
    const patientData = {
      name: patient.fullName || "Unknown",
      age: patient.age || calculateAge(patient.dob) || null,
      gender: patient.gender || "Not Specified",
      bloodGroup: patient.bloodGroup || vitals.bloodGroup || "Not Specified",
      contact: patient.email || "",
      phone: patient.contact || "",
      photo: patient.profileImage || "https://randomuser.me/api/portraits/men/32.jpg",
      allergies: patient.allergies || "None",
      chronic: patient.chronicConditions || "None",
      height: patient.height || (vitals.height ? parseInt(vitals.height) : null),
      weight: patient.weight || (vitals.weight ? parseFloat(vitals.weight) : null),
    };

    return res.json({
      success: true,
      data: {
        patient: patientData,
        prescriptions: formattedPrescriptions,
        consultations: formattedConsultations,
        labReports: formattedLabReports,
        vitals: {
          height: patient.height || (vitals.height ? parseInt(vitals.height) : null),
          weight: patient.weight || (vitals.weight ? parseFloat(vitals.weight) : null),
          bloodGroup: patient.bloodGroup || vitals.bloodGroup || null,
          bloodPressure: vitals.bloodPressure || null,
          heartRate: vitals.heartRate || null,
          temperature: vitals.temperature || null,
          bloodSugar: vitals.bloodSugar || null,
          hemoglobin: vitals.hemoglobin || null,
          spo2: vitals.spo2 || null,
          glucose: vitals.glucose || null,
          respiratoryRate: vitals.respiratoryRate || null,
        },
      },
    });
  } catch (err) {
    console.error("Error fetching medical records:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ===============================
// 2️⃣ GET MEDICAL RECORD BY ID (PATIENT)
// ===============================
export const patientGetMedicalRecordById = async (req, res) => {
  try {
    const patientId = req.user._id;
    const { id } = req.params;

    const record = await MedicalRecord.findOne({
      _id: id,
      patient: patientId,
    })
      .populate("doctor")
      .populate("appointment")
      .populate("prescription");

    if (!record)
      return res.status(404).json({ success: false, message: "Not found" });

    return res.json({ success: true, record });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ===============================
// 3️⃣ DELETE MEDICAL RECORD (PATIENT)
// ===============================
export const patientDeleteMedicalRecord = async (req, res) => {
  try {
    const patientId = req.user._id;
    const { id } = req.params;

    const record = await MedicalRecord.findOne({ _id: id, patient: patientId });
    if (!record)
      return res
        .status(404)
        .json({ success: false, message: "Medical record not found" });

    await record.deleteOne();
    res.json({ success: true, message: "Medical record deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ===============================
// 4️⃣ GET PATIENT CONSULTATIONS GROUPED BY DOCTOR (PATIENT)
// ===============================
export const patientGetConsultationsByDoctor = async (req, res) => {
  try {
    const patientId = req.user._id;

    // Get all appointments for the patient
    const appointments = await Appointment.find({ patient: patientId })
      .populate({
        path: "doctor",
        populate: [
          {
            path: "userId",
            select: "fullName profileImage",
          },
          {
            path: "department",
            select: "departmentName",
          },
        ],
      })
      .sort({ appointmentDate: -1 });

    // Get all medical records
    const medicalRecords = await MedicalRecord.find({ patient: patientId })
      .populate({
        path: "doctor",
        populate: [
          {
            path: "userId",
            select: "fullName",
          },
          {
            path: "department",
            select: "departmentName",
          },
        ],
      })
      .populate("appointment")
      .populate("prescription")
      .sort({ createdAt: -1 });

    // Get all prescriptions
    const prescriptions = await Prescription.find({ patient: patientId })
      .populate({
        path: "doctor",
        populate: [
          {
            path: "userId",
            select: "fullName",
          },
          {
            path: "department",
            select: "departmentName",
          },
        ],
      })
      .populate({
        path: "medicalRecord",
        populate: {
          path: "appointment",
        },
      })
      .sort({ createdAt: -1 });

    // Get all payments
    const payments = await Payment.find({ patient: patientId })
      .populate("appointment")
      .sort({ createdAt: -1 });

    // Create a map to group by doctor
    const doctorsMap = new Map();

    // Process appointments and medical records to build doctor history
    medicalRecords.forEach((record) => {
      if (!record.doctor || !record.appointment) return;

      const doctorId = record.doctor._id.toString();
      const doctor = record.doctor;
      const appointment = record.appointment;
      const doctorUserId = doctor.userId;

      if (!doctorsMap.has(doctorId)) {
        doctorsMap.set(doctorId, {
          id: doctorId,
          doctorId: doctor._id,
          avatar: doctorUserId?.profileImage || "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop",
          name: `Dr. ${doctorUserId?.fullName || "Unknown"}`,
          department: doctor.department?.departmentName || "Unknown",
          specialization: doctor.specialization || "General",
          rating: 4.8, // Default rating, can be enhanced later
          nextAppointment: null,
          medicalHistory: [],
        });
      }

      // Find payment for this appointment
      const payment = payments.find(
        (p) => p.appointment?._id?.toString() === appointment._id.toString()
      );

      // Find prescription for this record
      const prescription = prescriptions.find(
        (p) => p.medicalRecord?._id?.toString() === record._id.toString()
      );

      // Format prescription text
      let prescriptionText = "";
      if (prescription && prescription.medicines && prescription.medicines.length > 0) {
        prescriptionText = prescription.medicines
          .map(
            (med) =>
              `${med.medicineName}${med.dosage ? ` (${med.dosage})` : ""}${med.duration ? ` - ${med.duration}` : ""}`
          )
          .join(", ");
      } else if (prescription?.notes) {
        prescriptionText = prescription.notes;
      } else {
        prescriptionText = "No prescription provided";
      }

      // Format diagnosis
      const diagnosis =
        record.diagnosis && record.diagnosis.length > 0
          ? record.diagnosis.join(", ")
          : record.chiefComplaint || "General Consultation";

      // Get the actual date for sorting
      const appointmentDateObj = appointment.appointmentDate
        ? new Date(appointment.appointmentDate)
        : record.createdAt
        ? new Date(record.createdAt)
        : new Date();

      // Format date for display
      const date = appointmentDateObj.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      // Add to medical history with both formatted date and timestamp for sorting
      doctorsMap.get(doctorId).medicalHistory.push({
        date,
        dateTimestamp: appointmentDateObj.getTime(), // For sorting
        prescription: prescriptionText,
        payment: {
          status: payment?.status || "Pending",
          amount: payment?.amount ? `₹${payment.amount}` : "₹0",
        },
        notes: record.notes || record.symptoms || prescription?.notes || "No notes available",
        diagnosis,
        appointmentId: appointment._id,
        recordId: record._id,
      });
    });

    // Find next appointments for each doctor
    const upcomingAppointments = appointments.filter(
      (apt) =>
        apt.status !== "Completed" &&
        apt.status !== "Cancelled" &&
        apt.status !== "Missed" &&
        new Date(apt.appointmentDate) >= new Date()
    );

    upcomingAppointments.forEach((appointment) => {
      if (!appointment.doctor) return;
      const doctorId = appointment.doctor._id.toString();

      if (doctorsMap.has(doctorId)) {
        const appointmentDate = new Date(appointment.appointmentDate);
        const formattedDate = appointmentDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        const formattedTime = appointmentDate.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const existingNext = doctorsMap.get(doctorId).nextAppointment;
        const newAppointmentDate = appointmentDate;

        // Keep the earliest upcoming appointment
        if (!existingNext) {
          doctorsMap.get(doctorId).nextAppointment = `${formattedDate} • ${formattedTime}`;
        } else {
          // Parse existing date to compare
          const existingDateStr = existingNext.split(" • ")[0];
          const existingTimeStr = existingNext.split(" • ")[1];
          try {
            const existingDate = new Date(existingDateStr + " " + existingTimeStr);
            if (newAppointmentDate < existingDate) {
              doctorsMap.get(doctorId).nextAppointment = `${formattedDate} • ${formattedTime}`;
            }
          } catch (e) {
            // If parsing fails, use the new one
            doctorsMap.get(doctorId).nextAppointment = `${formattedDate} • ${formattedTime}`;
          }
        }
      }
    });

    // Convert map to array and sort by most recent consultation
    const doctorsArray = Array.from(doctorsMap.values()).map((doctor) => {
      // Sort medical history by timestamp (most recent first)
      const sortedHistory = doctor.medicalHistory.sort((a, b) => {
        return (b.dateTimestamp || 0) - (a.dateTimestamp || 0);
      });

      // Remove timestamp before sending to frontend (keep only formatted date)
      const cleanedHistory = sortedHistory.map(({ dateTimestamp, ...rest }) => rest);

      return {
        ...doctor,
        medicalHistory: cleanedHistory,
      };
    });

    // Sort doctors by most recent consultation
    doctorsArray.sort((a, b) => {
      if (a.medicalHistory.length === 0 && b.medicalHistory.length === 0) return 0;
      if (a.medicalHistory.length === 0) return 1;
      if (b.medicalHistory.length === 0) return -1;
      return new Date(b.medicalHistory[0].date) - new Date(a.medicalHistory[0].date);
    });

    // Calculate summary stats
    const totalDoctors = doctorsArray.length;
    const totalVisits = doctorsArray.reduce((acc, doc) => acc + doc.medicalHistory.length, 0);
    const upcomingCount = doctorsArray.filter((doc) => doc.nextAppointment !== null).length;

    return res.json({
      success: true,
      data: {
        doctors: doctorsArray,
        summary: {
          totalDoctors,
          totalVisits,
          upcoming: upcomingCount,
        },
      },
    });
  } catch (err) {
    console.error("Error fetching consultations by doctor:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};  
