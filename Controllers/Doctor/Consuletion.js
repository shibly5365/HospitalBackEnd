import Appointment from "../../Models/Appointment/Appointment.js";
import MedicalRecord from "../../Models/MedicalRecord/MedicalRecord.js";

export const getAllConsultations = async (req, res) => {
  try {
    const consultations = await Appointment.find({ consultationType: "Online" })
      .populate("doctor", "fullName specialization email")
      .populate("patient", "fullName age gender contact patientId ")
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

    // ===================================
    // CONSULTATION / APPOINTMENT
    // ===================================

    const consultation = await Appointment.findById(id)
      .populate(
        "patient",
        `
        fullName
        age
        gender
        contact
        patientId
        address
        email
        profileImage
        `,
      )
      .populate(
        "doctor",
        `
        fullName
        specialization
        email
        profileImage
        `,
      );

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: "Consultation not found",
      });
    }

    // ===================================
    // MEDICAL RECORD + PRESCRIPTION
    // ===================================

    const medicalRecord = await MedicalRecord.findOne({
      appointment: consultation._id,
    }).populate({
      path: "prescription",
      populate: [
        {
          path: "doctor",
          select: "fullName specialization",
        },
        {
          path: "patient",
          select: "fullName patientId",
        },
      ],
    });

    // ===================================
    // RESPONSE
    // ===================================

    res.status(200).json({
      success: true,

      data: {
        // ===================================
        // PATIENT INFORMATION
        // ===================================

        patient: {
          _id: consultation.patient?._id,

          fullName: consultation.patient?.fullName,

          patientId: consultation.patient?.patientId,

          age: consultation.patient?.age,

          gender: consultation.patient?.gender,

          contact: consultation.patient?.contact,

          email: consultation.patient?.email,

          address: consultation.patient?.address,

          profileImage: consultation.patient?.profileImage,
        },

        // ===================================
        // DOCTOR INFORMATION
        // ===================================

        doctor: {
          _id: consultation.doctor?._id,

          fullName: consultation.doctor?.fullName,

          specialization: consultation.doctor?.specialization,

          email: consultation.doctor?.email,

          profileImage: consultation.doctor?.profileImage,
        },

        // ===================================
        // CONSULTATION DETAILS
        // ===================================

        consultation: {
          consultationId: consultation._id,

          appointmentDate: consultation.appointmentDate,

          appointmentTime: consultation.appointmentTime,

          consultationType: consultation.consultationType,

          status: consultation.status,

          reason: consultation.reason,

          startedAt: consultation.startedAt,

          completedAt: consultation.completedAt,

          createdAt: consultation.createdAt,
        },

        // ===================================
        // MEDICAL RECORD
        // ===================================

        medicalRecord: medicalRecord
          ? {
              medicalRecordId: medicalRecord._id,

              chiefComplaint: medicalRecord.chiefComplaint,

              symptoms: medicalRecord.symptoms,

              diagnosis: medicalRecord.diagnosis,

              vitals: {
                bloodPressure: medicalRecord.vitals?.bloodPressure,

                heartRate: medicalRecord.vitals?.heartRate,

                temperature: medicalRecord.vitals?.temperature,

                weight: medicalRecord.vitals?.weight,

                height: medicalRecord.vitals?.height,

                bloodGroup: medicalRecord.vitals?.bloodGroup,

                spo2: medicalRecord.vitals?.spo2,

                bloodSugar: medicalRecord.vitals?.bloodSugar,

                respiratoryRate: medicalRecord.vitals?.respiratoryRate,
              },

              labTests: medicalRecord.labTests,

              bloodTests: medicalRecord.bloodTests,

              labReports: medicalRecord.labReports,

              notes: medicalRecord.notes,

              followUpDate: medicalRecord.followUpDate,

              followUpNote: medicalRecord.followUpNote,

              attachments: medicalRecord.attachments,

              status: medicalRecord.status,

              createdAt: medicalRecord.createdAt,
            }
          : null,

        // ===================================
        // PRESCRIPTION
        // ===================================

        prescription: medicalRecord?.prescription
          ? {
              prescriptionId: medicalRecord.prescription?._id,

              medicines: medicalRecord.prescription?.medicines,

              notes: medicalRecord.prescription?.notes,

              doctor: medicalRecord.prescription?.doctor,

              patient: medicalRecord.prescription?.patient,

              createdAt: medicalRecord.prescription?.createdAt,
            }
          : null,
      },
    });
  } catch (error) {
    console.log("getConsultationById error", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
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
