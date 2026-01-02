import Payment from "../../Models/Payments/paymentSchema.js";
import Appointment from "../../Models/Appointment/Appointment.js";
import userModel from "../../Models/User/UserModels.js";

// Get all payments with filters
export const getAllPayments = async (req, res) => {
  try {
    const { status, patient, method, startDate, endDate, page = 1, limit = 20 } = req.query;

    let filter = {};

    if (status) filter.status = status;
    if (patient) filter.patient = patient;
    if (method) filter.method = method;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const payments = await Payment.find(filter)
      .populate({
        path: "patient",
        select: "fullName email contact patientId",
      })
      .populate({
        path: "appointment",
        populate: {
          path: "doctor",
          populate: {
            path: "userId",
            select: "fullName",
          },
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(filter);

    // Calculate totals
    const totalAmount = await Payment.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
        summary: {
          totalAmount: totalAmount[0]?.total || 0,
          totalCount: total,
        },
      },
    });
  } catch (error) {
    console.error("Get all payments error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get pending payments
export const getPendingPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ status: "Pending" })
      .populate({
        path: "patient",
        select: "fullName email contact",
      })
      .populate({
        path: "appointment",
        populate: {
          path: "doctor",
          populate: {
            path: "userId",
            select: "fullName",
          },
        },
      })
      .sort({ createdAt: -1 });

    const totalPending = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    res.json({
      success: true,
      data: {
        payments,
        totalPending,
        count: payments.length,
      },
    });
  } catch (error) {
    console.error("Get pending payments error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get completed payments
export const getCompletedPayments = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let filter = { status: "Paid" };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const payments = await Payment.find(filter)
      .populate({
        path: "patient",
        select: "fullName email contact",
      })
      .populate({
        path: "appointment",
        populate: {
          path: "doctor",
          populate: {
            path: "userId",
            select: "fullName",
          },
        },
      })
      .sort({ createdAt: -1 });

    const totalCompleted = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    res.json({
      success: true,
      data: {
        payments,
        totalCompleted,
        count: payments.length,
      },
    });
  } catch (error) {
    console.error("Get completed payments error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Generate bill for appointment
export const generateBill = async (req, res) => {
  try {
    const { appointmentId, amount, method, type = "Initial" } = req.body;

    const appointment = await Appointment.findById(appointmentId).populate("patient doctor");
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    // Check if payment already exists
    const existingPayment = await Payment.findOne({ appointment: appointmentId });
    if (existingPayment && existingPayment.status === "Paid") {
      return res.status(400).json({
        success: false,
        message: "Payment already completed for this appointment",
      });
    }

    const payment = await Payment.create({
      appointment: appointmentId,
      patient: appointment.patient._id,
      amount,
      method,
      type,
      status: "Pending",
      channel: "WalkIn",
    });

    const populatedPayment = await Payment.findById(payment._id)
      .populate({
        path: "patient",
        select: "fullName email contact patientId",
      })
      .populate({
        path: "appointment",
        populate: {
          path: "doctor",
          populate: {
            path: "userId",
            select: "fullName",
          },
        },
      });

    res.status(201).json({
      success: true,
      message: "Bill generated successfully",
      data: populatedPayment,
    });
  } catch (error) {
    console.error("Generate bill error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get payment by ID (for invoice printing)
export const getPaymentById = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId)
      .populate({
        path: "patient",
        select: "-password",
      })
      .populate({
        path: "appointment",
        populate: [
          {
            path: "doctor",
            populate: {
              path: "userId",
              select: "fullName",
            },
          },
          {
            path: "doctor",
            populate: {
              path: "department",
              select: "name description",
            },
          },
        ],
      });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("Get payment by ID error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
