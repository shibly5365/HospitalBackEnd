import Appointment from "../../Models/Appointment/Appointment.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import MedicalRecord from "../../Models/MedicalRecord/MedicalRecord.js";
import userModel from "../../Models/User/UserModels.js";

// ⭐ Get all patients of the doctor - OPTIMIZED with pagination and aggregation
export const getDoctorAllPatients = async (req, res) => {
  try {
    const doctorUserId = req.user._id;
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || "25", 10))); // Max 50 per page
    const skip = (page - 1) * limit;

    // 1️⃣ Find doctor profile
    const doctor = await doctorModel.findOne({ userId: doctorUserId }).lean();
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // 2️⃣ Use aggregation pipeline to get unique patients with their visit counts in ONE query (no N+1!)
    const patientData = await Appointment.aggregate([
      {
        $match: {
          doctor: doctor._id,
        },
      },
      {
        $group: {
          _id: "$patient",
          lastVisit: { $max: "$appointmentDate" },
          totalVisits: { $sum: 1 },
          appointments: {
            $push: {
              appointmentId: "$_id",
              appointmentDate: "$appointmentDate",
              timeSlot: "$timeSlot",
              status: "$status",
              reason: "$reason",
              type: "$type",
            },
          },
        },
      }, 
      {
        $sort: { lastVisit: -1 },
      },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ]);

    const total = patientData[0]?.metadata[0]?.total || 0;
    const appointments = patientData[0]?.data || [];

    // 3️⃣ Get patient details in ONE query using $in (not in loop!)
    const patientIds = appointments.map((a) => a._id);
    const patientDetails = await userModel
      .find({ _id: { $in: patientIds } })
      .select("fullName email contact gender dob age profileImage address")
      .lean();

    // Create a map for O(1) lookup
    const patientMap = new Map(patientDetails.map((p) => [p._id.toString(), p]));

    // 4️⃣ Merge appointment data with patient details
    const patients = appointments.map((apptData) => {
      const patient = patientMap.get(apptData._id.toString());
      return {
        id: apptData._id,
        fullName: patient?.fullName || "Unknown",
        email: patient?.email || "",
        gender: patient?.gender || "",
        age: patient?.age || "",
        dob: patient?.dob || null,
        phone: patient?.contact || "",
        profileImage: patient?.profileImage || "",
        address: patient?.address || {},
        totalVisits: apptData.totalVisits,
        lastVisit: apptData.lastVisit,
        appointmentHistory: apptData.appointments,
      };
    });

    res.status(200).json({
      success: true,
      message: "Doctor all unique patients fetched",
      page,
      limit,
      total,
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
    const doctorNotes = medicalRecords.map((record) => ({
      note: record.notes || "",
      createdAt: record.createdAt,
    }));
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

export const createPatientByDoctor = async (req, res) => {
  try {
    const doctorUserId = req.user._id;
    const doctor = await doctorModel.findOne({ userId: doctorUserId });
    if (!doctor) {
      return res.status(403).json({
        success: false,
        message: "Only doctors can create patients",
      });
    }
    const {
      fullName,
      email,
      contact,
      dob,
      age,
      gender,
      patientType,
      address,
      emergencyContact,
      chronicConditions,
    } = req.body;
    if (!fullName || !email || !contact) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, and contact are required",
      });
    }
    const existingPatient = await userModel.findOne({
      $or: [{ email }, { contact }],
    });

    if (!existingPatient) {
      return res.status(409).json({
        success: false,
        message: "Patient already exists with this email or phone",
      });
    }
    const patient = await userModel.create({
      fullName,
      email,
      contact,
      role: "patient",
      dob,
      age,
      gender,
      patientType: patientType || "New Patient",
      address: {
        street: address?.street,
        city: address?.city,
        state: address?.state,
        zip: address?.zip,
      },
      emergencyContact: {
        name: emergencyContact?.name,
        number: emergencyContact?.number,
      },
      chronicConditions,
      createdByDoctor: doctor._id,
      isAccountVerified: true, 
    });

    res.status(201).json({
      success: true,
      message: "Patient created successfully",
      patient: {
        id: patient._id,
        fullName: patient.fullName,
        email: patient.email,
        contact: patient.contact,
        patientId: patient.patientId,
        bloodGroup: patient.bloodGroup,
      },
    });
  } catch (err) {
    console.error("createPatientByDoctor Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

