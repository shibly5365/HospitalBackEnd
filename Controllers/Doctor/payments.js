import mongoose from "mongoose";
import Payment from "../../Models/Payments/paymentSchema.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";

export const getAllDoctorPayments = async (req, res) => {
  try {
    // ✅ Get doctor from logged-in user
    const doctor = await doctorModel.findOne({
      userId: req.user._id,
    });

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doctor._id;

    // ✅ Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // ✅ Query params
    const { status, method, search } = req.query;

    let matchQuery = {
      doctor: doctorId,
    };

    // ===============================
    // ✅ STATUS FILTER
    // ===============================
    if (status && status !== "all") {
      if (status === "Completed") {
        matchQuery.status = { $in: ["Paid", "Completed"] };
      } else {
        matchQuery.status = status;
      }
    }

    // ===============================
    // ✅ METHOD FILTER (MAIN FIX)
    // ===============================
    if (method && method !== "all") {
      if (method === "Online") {
        matchQuery.method = { $in: ["UPI", "Card", "NetBanking"] };
      } else if (method === "Cash") {
        matchQuery.method = "Cash";
      }
    }

    // ===============================
    // ✅ SEARCH (paymentId)
    // ===============================
    if (search) {
      matchQuery.paymentId = {
        $regex: search,
        $options: "i",
      };
    }

    // ===============================
    // ✅ FETCH DATA
    // ===============================
    const payments = await Payment.find(matchQuery)
      .populate("patient", "fullName patientId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Payment.countDocuments(matchQuery);

    // ===============================
    // ✅ FORMAT DATA FOR UI
    // ===============================
    const data = payments.map((p) => {
      const d = new Date(p.createdAt);

      return {
        _id: p._id,
        patientName: p.patient?.fullName || "N/A",
        patientId: p.patient?.patientId || "N/A",
        paymentId: p.paymentId,
        date: d.toLocaleDateString(),
        time: d.toLocaleTimeString(),
        type: p.type,
        amount: p.amount,

        // ✅ Status mapping for frontend
        status:
          p.status === "Paid"
            ? "Completed"
            : p.status === "Pending"
              ? "Pending"
              : p.status === "Failed"
                ? "Failed"
                : "Refunded",

        method: p.method,
      };
    });

    // ===============================
    // ✅ RESPONSE
    // ===============================
    res.json({
      success: true,
      page,
      total,
      totalPages: Math.ceil(total / limit),
      data,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
export const getPaymentById = async (req, res) => {
  try {
    // 🔥 Get doctor from logged-in user
    const doctor = await doctorModel.findOne({
      userId: req.user._id,
    });

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // 🔥 Only fetch payment that belongs to this doctor
    const payment = await Payment.findOne({
      _id: req.params.id,
      doctor: doctor._id,
    }).populate("patient", "fullName patientId gender contact");

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found or not authorized",
      });
    }

    res.json({
      success: true,
      data: {
        patientInfo: {
          name: payment.patient?.fullName,
          patientId: payment.patient?.patientId,
          gender: payment.patient?.gender,
          contact: payment.patient?.contact,
        },

        paymentInfo: {
          paymentId: payment.paymentId,
          type: payment.type,
          amount: payment.amount,
          date: payment.createdAt,
          method: payment.method,

          // 🔥 Convert for UI
          status:
            payment.status === "Paid"
              ? "Completed"
              : payment.status === "Pending"
                ? "Pending"
                : payment.status === "Failed"
                  ? "Failed"
                  : "Refunded",
        },

        bill: payment.items?.length
          ? payment.items
          : [{ title: "Service", amount: payment.amount }],

        totalAmount: payment.amount,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
export const refundPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (payment.status === "Refunded") {
      return res.json({ message: "Already refunded" });
    }

    payment.status = "Refunded";
    await payment.save();

    res.json({
      success: true,
      message: "Payment refunded successfully",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
export const getDoctorStats = async (req, res) => {
  try {
    const doctor = await doctorModel.findOne({
      userId: req.user._id,
    });

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doctor._id;

    const stats = await Payment.aggregate([
      {
        $match: {
          doctor: new mongoose.Types.ObjectId(doctorId),
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          totalTransactions: { $sum: 1 },
          totalEarnings: {
            $sum: {
              $cond: [
                { $in: ["$status", ["Paid", "Completed"]] },
                "$amount",
                0,
              ],
            },
          },
          pendingPayments: {
            $sum: {
              $cond: [{ $eq: ["$status", "Pending"] }, "$amount", 0],
            },
          },
        },
      },
    ]);

    res.json({
      success: true,
      data: stats[0] || {},
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getWeeklyRevenue = async (req, res) => {
  try {
    const doctor = await doctorModel.findOne({
      userId: req.user._id,
    });

    const doctorId = doctor._id;

    const data = await Payment.aggregate([
      {
        $match: {
          doctor: new mongoose.Types.ObjectId(doctorId),
          status: "Paid",
        },
      },
      {
        $group: {
          _id: {
            week: { $isoWeek: "$createdAt" },
          },
          revenue: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.week": 1 } },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
export const getPaymentMethods = async (req, res) => {
  try {
    const doctor = await doctorModel.findOne({
      userId: req.user._id,
    });

    const doctorId = doctor._id;

    const data = await Payment.aggregate([
      {
        $match: {
          doctor: new mongoose.Types.ObjectId(doctorId),
        },
      },
      {
        $group: {
          _id: "$method",
          count: { $sum: 1 },
          total: { $sum: "$amount" },
        },
      },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
