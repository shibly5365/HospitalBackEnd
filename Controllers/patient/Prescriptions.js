import Prescription from "../../Models/prescription/prescription.js";

// 🟢 PATIENT: Get All Prescriptions
export const patientGetAllPrescriptions = async (req, res) => {
  try {
    const patientId = req.user._id;

    const prescriptions = await Prescription.find({
      patient: patientId,
    })
      .populate({
        path: "doctor",
        select: "userId specialization profileImage department isActive",
        populate: [
          {
            path: "department",
            select: "name",
          },
          {
            path: "userId",
            select: "fullName",
          },
        ],
      })
      .populate({
        path: "medicalRecord",
        select: `
          diagnosis
          symptoms
          followUpDate
          consultationDate
          status
          vitals
        `,
      })
      .sort({ createdAt: -1 });

    // ======================
    // Empty State
    // ======================

    if (!prescriptions.length) {
      return res.json({
        success: true,
        stats: {
          totalPrescriptions: 0,
          activeMedicines: 0,
          lastConsultation: null,
          primaryDoctor: null,
          latestDoctor: null,
        },
        prescriptions: [],
      });
    }

    // ======================
    // Stats
    // ======================

    const totalPrescriptions = prescriptions.length;

    let activeMedicines = 0;

    prescriptions.forEach((p) => {
      activeMedicines += p.medicines?.length || 0;
    });

    const lastConsultation =
      prescriptions[0]?.medicalRecord?.consultationDate ||
      prescriptions[0]?.createdAt;

    // ======================
    // Doctor Count Logic
    // ======================

    const doctorCount = {};

    prescriptions.forEach((p) => {
      const doctorId = p.doctor?._id?.toString();

      if (doctorId) {
        doctorCount[doctorId] = (doctorCount[doctorId] || 0) + 1;
      }
    });

    let primaryDoctorId = null;
    let maxCount = 0;

    Object.keys(doctorCount).forEach((doctorId) => {
      if (doctorCount[doctorId] > maxCount) {
        maxCount = doctorCount[doctorId];
        primaryDoctorId = doctorId;
      }
    });

    const primaryDoctorData = prescriptions.find(
      (p) => p.doctor?._id?.toString() === primaryDoctorId,
    )?.doctor;

    const latestDoctorData = prescriptions[0]?.doctor || null;

    const formatDoctor = (doctor) => {
  if (!doctor) return null;

  return {
    doctorId: doctor._id,

    doctorName: doctor.userId?.fullName || "",

    specialization: doctor.specialization,

    department: {
      departmentId: doctor.department?._id,

      departmentName: doctor.department?.name,
    },

    profileImage: doctor.profileImage,

    isActive: doctor.isActive,
  };
};

    // ======================
    // Prescription List
    // ======================

    const formattedPrescriptions = prescriptions.map((prescription) => ({
      prescriptionId: prescription._id,

      consultationDate: prescription.medicalRecord?.consultationDate || null,

      followUpDate: prescription.medicalRecord?.followUpDate || null,

      diagnosis: prescription.medicalRecord?.diagnosis || [],

      symptoms: prescription.medicalRecord?.symptoms || "",

      status: prescription.medicalRecord?.status || "active",

      medicineCount: prescription.medicines?.length || 0,

      doctor: formatDoctor(prescription.doctor),

      createdAt: prescription.createdAt,
    }));

    // ======================
    // Final Response
    // ======================

    return res.json({
      success: true,

      stats: {
        totalPrescriptions,
        activeMedicines,
        lastConsultation,

        primaryDoctor: formatDoctor(primaryDoctorData),

        latestDoctor: formatDoctor(latestDoctorData),
      },

      prescriptions: formattedPrescriptions,
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// 🟢 PATIENT: Get Prescription By ID
export const patientGetPrescriptionById = async (req, res) => {
  try {
    const patientId = req.user._id;

    const { id } = req.params;

    const prescription = await Prescription.findById(id)
      .populate({
        path: "doctor",
        select: `
            fullName
            specialization
            department
            profileImage
            isActive
          `,
      })
      .populate({
        path: "medicalRecord",
        select: `
            chiefComplaint
            symptoms
            diagnosis
            vitals
            notes
            followUpDate
            followUpNote
            labTests
            labReports
            bloodTests
            attachments
            consultationDate
            status
          `,
      });

    // Not Found
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
    }

    // Security Check
    if (prescription.patient.toString() !== patientId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized patient",
      });
    }

    // ======================
    // Final Formatted Response
    // ======================

    const formattedPrescription = {
      prescriptionId: prescription._id,

      createdAt: prescription.createdAt,

      consultationDate: prescription.medicalRecord?.consultationDate,

      followUpDate: prescription.medicalRecord?.followUpDate,

      followUpNote: prescription.medicalRecord?.followUpNote,

      status: prescription.medicalRecord?.status,

      chiefComplaint: prescription.medicalRecord?.chiefComplaint,

      symptoms: prescription.medicalRecord?.symptoms,

      diagnosis: prescription.medicalRecord?.diagnosis || [],

      doctorNotes: prescription.notes || prescription.medicalRecord?.notes,

      // ======================
      // Doctor
      // ======================

      doctor: {
        id: prescription.doctor?._id,

        fullName: prescription.doctor?.fullName,

        specialization: prescription.doctor?.specialization,

        department: prescription.doctor?.department,

        profileImage: prescription.doctor?.profileImage,

        isActive: prescription.doctor?.isActive,
      },

      // ======================
      // Medicines
      // ======================

      medicines: prescription.medicines.map((med) => ({
        medicineName: med.medicineName,

        dosage: med.dosage,

        frequency: med.frequency,

        duration: med.duration,

        timing: med.timing,

        instructions: med.instructions,
      })),

      // ======================
      // Vitals
      // ======================

      vitals: prescription.medicalRecord?.vitals || {},

      // ======================
      // Lab Tests
      // ======================

      labTests: prescription.medicalRecord?.labTests || [],

      bloodTests: prescription.medicalRecord?.bloodTests || [],

      labReports: prescription.medicalRecord?.labReports || [],

      // ======================
      // Attachments
      // ======================

      attachments: prescription.medicalRecord?.attachments || [],
    };

    res.json({
      success: true,
      prescription: formattedPrescription,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
