import mongoose from "mongoose";
import { getDateRange } from "../../Units/dateFilter.js";
import Appointment from "../../Models/Appointment/Appointment.js";
import Payment from "../../Models/Payments/paymentSchema.js";
import ReviewModel from "../../Models/Receptionist/Receptionist.js";
import userModel from "../../Models/User/UserModels.js";

export const getDoctorAnalyticsDashboard = async (req, res) => {
  try {
    const { filter = "monthly" } = req.query;
    const doctorId = req.user.id;

    const { startDate, endDate } = getDateRange(filter);

    const doctorObjectId = new mongoose.Types.ObjectId(doctorId);

    // ===============================
    // 1. TOTAL CONSULTATIONS
    // ===============================
    const totalConsultations = await Appointment.countDocuments({
      doctor: doctorObjectId,
      createdAt: { $gte: startDate, $lte: endDate },
      status: "completed"
    });

    // ===============================
    // 2. TOTAL EARNINGS
    // ===============================
    const earningsData = await Payment.aggregate([
      {
        $match: {
          doctor: doctorObjectId,
          createdAt: { $gte: startDate, $lte: endDate },
          status: "success"
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const totalEarnings = earningsData[0]?.total || 0;

    // ===============================
    // 3. TOTAL PATIENTS (ALL TIME)
    // ===============================
    const totalPatientsList = await Appointment.distinct("patient", {
      doctor: doctorObjectId
    });

    // ===============================
    // 4. NEW PATIENTS (FILTER BASED)
    // ===============================
    const newPatientsList = await Appointment.distinct("patient", {
      doctor: doctorObjectId,
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // ===============================
    // 5. SATISFACTION RATING
    // ===============================
    const ratingData = await ReviewModel.aggregate([
      {
        $match: {
          doctor: doctorObjectId,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" }
        }
      }
    ]);

    const rating = ratingData[0]?.avgRating || 0;

    // ===============================
    // 6. EARNINGS BREAKDOWN (FOR PIE CHART)
    // ===============================
    const earningsBreakdownRaw = await Payment.aggregate([
      {
        $match: {
          doctor: doctorObjectId,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$method", // card / cash / insurance
          total: { $sum: "$amount" }
        }
      }
    ]);

    // 👉 Convert for frontend chart
    const earningsBreakdown = earningsBreakdownRaw.map(item => ({
      name: item._id,
      value: item.total
    }));

    // ===============================
    // 7. PENDING AMOUNT
    // ===============================
    const pendingData = await Payment.aggregate([
      {
        $match: {
          doctor: doctorObjectId,
          status: "pending"
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const pendingAmount = pendingData[0]?.total || 0;

    // ===============================
    // 8. PATIENT DEMOGRAPHICS (FIXED)
    // ===============================
    const patientIds = await Appointment.distinct("patient", {
      doctor: doctorObjectId
    });

    const demographicsRaw = await userModel.aggregate([
      {
        $match: {
          _id: { $in: patientIds }
        }
      },
      {
        $group: {
          _id: "$gender",
          count: { $sum: 1 }
        }
      }
    ]);

    const demographics = demographicsRaw.map(item => ({
      name: item._id || "Other",
      value: item.count
    }));

    // ===============================
    // 9. APPOINTMENT TRENDS
    // ===============================
    const appointmentTrendsRaw = await Appointment.aggregate([
      {
        $match: {
          doctor: doctorObjectId,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    const appointmentTrends = appointmentTrendsRaw.map(item => ({
      name: item._id,
      value: item.count
    }));

    // ===============================
    // FINAL RESPONSE
    // ===============================
    res.json({
      success: true,
      data: {
        totalConsultations,
        totalEarnings,
        totalPatients: totalPatientsList.length,
        newPatients: newPatientsList.length,
        rating,
        averageRating: rating,
        pendingAmount,
        earningsBreakdown,
        demographics,
        appointmentTrends
      }
    });

  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ message: "Analytics error" });
  }
};