import mongoose from "mongoose";
import Appointment from "../../Models/Appointment/Appointment.js";
import MedicalRecord from "../../Models/MedicalRecord/MedicalRecord.js";
import userModel from "../../Models/User/UserModels.js";
import Payment from "../../Models/Payments/paymentSchema.js";

// ===============================
// Helper: Format Date & Time
// ===============================
const formatDateTime = (date) => {
  if (!date) return { date: null, time: null, dateTime: null };
  const d = new Date(date);

  return {
    date: d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    time: d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    dateTime: d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
};

// ===============================
// Main Controller
// ===============================
export const getPatientDashboardSummary = async (req, res) => {
  try {
    const patientId = req.user.id;
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    // ===============================
    // 1. Patient Info
    // ===============================
    let patient = await userModel
      .findById(patientId)
      .select(
        "fullName age gender bloodGroup patientType insuranceInfo emergencyContact contact email address profileImage"
      )
      .lean();

    if (!patient)
      return res.status(404).json({ success: false, message: "Patient not found" });

    // Profile Image
    patient.profileImage = patient.profileImage
      ? `${baseUrl}/uploads/patients/${patient.profileImage}`
      : `${baseUrl}/uploads/defaults/default-patient.png`;

    // ===============================
    // 2. DATE RANGE
    // ===============================
    const now = new Date();

    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );

    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

    // ===============================
    // 3. APPOINTMENT QUERIES
    // ===============================
    const populateDoctor = {
      path: "doctor",
      populate: [
        { path: "department", select: "name" },
        { path: "userId", select: "fullName profileImage contact email" },
      ],
    };

    const [
      todaysAppointmentsRaw,
      upcomingAppointmentsRaw,
      pastAppointmentsRaw,
      canceledAppointmentsRaw,
    ] = await Promise.all([
      // Today's appointments
      Appointment.find({
        patient: patientId,
        appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      })
        .populate(populateDoctor)
        .lean(),

      // Upcoming
      Appointment.find({
        patient: patientId,
        appointmentDate: { $gt: endOfDay },
        status: { $in: ["Pending", "Confirmed"] },
      })
        .populate(populateDoctor)
        .sort({ appointmentDate: 1 })
        .limit(5)
        .lean(),

      // Past (Only Completed)
      Appointment.find({
        patient: patientId,
        appointmentDate: { $lt: startOfDay },
        status: "Completed",
      })
        .populate(populateDoctor)
        .sort({ appointmentDate: -1 })
        .limit(5)
        .lean(),

      // Canceled
      Appointment.find({
        patient: patientId,
        status: "Cancelled",
      })
        .populate(populateDoctor)
        .sort({ appointmentDate: -1 })
        .limit(5)
        .lean(),
    ]);

    // ===============================
    // Helper to Map Appointments
    // ===============================
    const mapAppointments = (list) =>
      list.map((a) => {
        const dt = formatDateTime(a.appointmentDate);

        const doctorImage = a.doctor?.userId?.profileImage
          ? `${baseUrl}/uploads/doctors/${a.doctor.userId.profileImage}`
          : `${baseUrl}/uploads/defaults/default-doctor.png`;

        return {
          id: a._id,
          date: dt.date,
          time: dt.time,
          dateTime: dt.dateTime,
          status: a.status,
          timeSlot: a.timeSlot,
          doctor: {
            id: a.doctor?._id,
            name: a.doctor?.userId?.fullName || "Unknown Doctor",
            image: doctorImage,
            contact: a.doctor?.userId?.contact || null,
            email: a.doctor?.userId?.email || null,
            department: a.doctor?.department?.name || "General",
          },
        };
      });

    // ===============================
    // 4. Appointment Stats
    // ===============================
    const totalAppointments = await Appointment.countDocuments({
      patient: patientId,
    });

    const appointmentStats = await Appointment.aggregate([
      { $match: { patient: new mongoose.Types.ObjectId(patientId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // ===============================
    // 5. MEDICAL RECORDS + PRESCRIPTIONS
    // ===============================
    const allRecords = await MedicalRecord.find({ patient: patientId })
      .populate({
        path: "doctor",
        populate: { path: "userId", select: "fullName profileImage" },
      })
      .populate("prescription")
      .sort({ createdAt: -1 })
      .lean();

    const prescriptions = allRecords.flatMap((record) => {
      const doctorImage = record.doctor?.userId?.profileImage
        ? `${baseUrl}/uploads/doctors/${record.doctor.userId.profileImage}`
        : `${baseUrl}/uploads/defaults/default-doctor.png`;

      let presArray = [];

      if (Array.isArray(record.prescription)) presArray = record.prescription;
      else if (record.prescription) presArray = [record.prescription];

      return presArray.map((p) => ({
        ...p,
        recordId: record._id,
        doctor: record.doctor?.userId?.fullName || "Doctor",
        doctorImage,
        date: record.createdAt,
      }));
    });

    // ===============================
    // 6. PAYMENTS
    // ===============================
    const payments = await Payment.find({ patient: patientId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const totalPayments = await Payment.aggregate([
      { $match: { patient: new mongoose.Types.ObjectId(patientId) } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // ===============================
    // 7. COMPLETED CONSULTATIONS
    // ===============================
    const completedVisits = await Appointment.find({
      patient: patientId,
      status: "Completed",
    })
      .populate(populateDoctor)
      .sort({ appointmentDate: -1 })
      .lean();

    const consultations = completedVisits.map((v) => {
      const doctorImage = v.doctor?.userId?.profileImage
        ? `${baseUrl}/uploads/doctors/${v.doctor.userId.profileImage}`
        : `${baseUrl}/uploads/defaults/default-doctor.png`;

      return {
        id: v._id,
        date: formatDateTime(v.appointmentDate).date,
        doctor: v.doctor?.userId?.fullName || "Unknown Doctor",
        profileImage: doctorImage,
      };
    });

    // ===============================
    // 8. LAST VISITED DOCTORS (Top 3)
    // ===============================
    const lastVisitedDoctors = completedVisits.slice(0, 3).map((visit) => {
      const doctorImage = visit.doctor?.userId?.profileImage
        ? `${baseUrl}/uploads/doctors/${visit.doctor.userId.profileImage}`
        : `${baseUrl}/uploads/defaults/default-doctor.png`;

      return {
        doctorId: visit.doctor?._id,
        name: visit.doctor?.userId?.fullName || "Unknown Doctor",
        department: visit.doctor?.department?.name || "General",
        reason: visit.reason || "Consultation",
        nextAppointment: visit.nextAppointment || null,
        rating: visit.rating || 4.7,
        lastVisited: visit.appointmentDate,
        profileImage: doctorImage,
      };
    });

    // ===============================
    // 9. RECENT ACTIVITY
    // ===============================
    let recentActivity = [
      ...todaysAppointmentsRaw.map((a) => ({
        type: "Appointment",
        title: `Appointment with ${a.doctor?.userId?.fullName || "Doctor"}`,
        status: a.status,
        date: a.createdAt,
      })),
      ...allRecords.map((r) => ({
        type: "Medical Record",
        title: `Record by ${r.doctor?.userId?.fullName || "Doctor"}`,
        status: "Completed",
        date: r.createdAt,
      })),
      ...prescriptions.map((p) => ({
        type: "Prescription",
        title: `Prescription by ${p.doctor}`,
        status: "Issued",
        date: p.date,
      })),
      ...payments.map((pay) => ({
        type: "Payment",
        title: `Payment of ₹${pay.amount}`,
        status: pay.status || "Completed",
        date: pay.createdAt,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // ===============================
    // Date Info
    // ===============================
    const dateInfo = {
      fullDate: now.toDateString(),
      day: now.getDate(),
      month: now.toLocaleString("default", { month: "long" }),
      year: now.getFullYear(),
    };

    // ===============================
    // Final Response
    // ===============================
    return res.status(200).json({
      success: true,
      dateInfo,
      patientInfo: patient,
      medicalRecords: allRecords,
      prescriptions,
      consultations: {
        total: consultations.length,
        list: consultations,
      },
      appointments: {
        stats: appointmentStats,
        total: totalAppointments,
        today: mapAppointments(todaysAppointmentsRaw),
        upcoming: mapAppointments(upcomingAppointmentsRaw),
        past: mapAppointments(pastAppointmentsRaw),
        canceled: mapAppointments(canceledAppointmentsRaw),
      },
      payments: {
        summary: totalPayments[0] || { totalAmount: 0, count: 0 },
        list: payments,
      },
      recentActivity,
      lastVisitedDoctors,
    });
  } catch (error) {
    console.error("Patient Dashboard Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
