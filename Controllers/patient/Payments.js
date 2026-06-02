import Payment from "../../Models/Payments/paymentSchema.js";

export const patientGetMyPayments = async (req, res) => {
  try {
    const userId = req.user._id;

    const { status } = req.query;

    // ✅ Filter Object
    const filter = {
      patient: userId,
    };

    // ✅ Add status filter if provided
    if (status && status !== "All") {
      filter.status = status;
    }

    const payments = await Payment.find(filter)
      .populate({
        path: "patient",
        select: "fullName patientId profileImage",
      })
      .populate({
        path: "doctor",
        populate: [
          {
            path: "userId",
            select: "fullName profileImage",
          },
          {
            path: "department",
            select: "name",
          },
        ],
      })
      .populate({
        path: "appointment",
        select: "appointmentDate timeSlot consultationType status",
      })
      .sort({ createdAt: -1 });

    // ✅ Patient Info
    const patientInfo = payments[0]?.patient
      ? {
          _id: payments[0].patient._id,

          name: payments[0].patient.fullName,

          patientId: payments[0].patient.patientId,

          profileImage: payments[0].patient.profileImage,
        }
      : null;

    // ✅ Total Appointment Count
    const totalAppointments = payments.length;

    // ✅ Total Amount Spent
    const totalSpent = payments
      .filter((p) => p.status === "Paid")
      .reduce((sum, p) => sum + p.amount, 0);

    // ✅ Last Payment
    const lastPayment = payments[0]
      ? {
          paymentId: payments[0].paymentId,

          status: payments[0].status,

          amount: payments[0].amount,

          date: payments[0].createdAt,
        }
      : null;

    // ✅ Payment List
    const formattedPayments = payments.map((payment) => ({
      _id: payment._id,

      paymentId: payment.paymentId,
doctor: {
  _id: payment.doctor?._id,

  name: payment.doctor?.userId?.fullName,

  profileImage: payment.doctor?.userId?.profileImage,
  specialization: payment.doctor?.specialization,

  specialization: payment.doctor?.department?.name,

  department: payment.doctor?.department?.name,
},

      appointment: {
        _id: payment.appointment?._id,

        date: payment.appointment?.appointmentDate,

        time: payment.appointment?.timeSlot,

        type: payment.appointment?.consultationType,

        appointmentStatus: payment.appointment?.status,
      },

      amount: payment.amount,

      paymentMethod: payment.method,

      paymentStatus: payment.status,
    }));

    res.status(200).json({
      success: true,

      filter: status || "All",

      patient: patientInfo,

      summary: {
        totalAppointments,

        totalSpent,

        lastPayment,
      },

      payments: formattedPayments,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
export const patientGetPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id)
      .populate({
        path: "doctor",
        populate: [
          {
            path: "userId",
            select: "fullName email contact profileImage",
          },
          {
            path: "department",
            select: "name",
          },
        ],
      })
      .populate({
        path: "appointment",
        select: "appointmentDate timeSlot consultationType status",
      });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const responseData = {
      paymentId: payment.paymentId,

      doctor: {
        name: payment.doctor?.userId?.fullName,

        department: payment.doctor?.department?.name,
          specialization: payment.doctor?.specialization,

        email: payment.doctor?.userId?.email,

        contact: payment.doctor?.userId?.contact,

        profileImage: payment.doctor?.userId?.profileImage,
      },

      appointment: {
        date: payment.appointment?.appointmentDate,

        time: payment.appointment?.timeSlot,

        type: payment.appointment?.consultationType,

        appointmentStatus: payment.appointment?.status,
      },

      paymentMethod: payment.method,

      paymentChannel: payment.channel,

      paymentStatus: payment.status,

      amount: payment.amount,

      billBreakdown: {
        items: payment.items,

        consultationFee:
          payment.items.find((item) => item.title === "Consultation Fee")
            ?.amount || 0,

        serviceCharge:
          payment.items.find((item) => item.title === "Service Charge")
            ?.amount || 0,

        total: payment.amount,
      },

      razorpay: {
        orderId: payment.razorpayOrderId,

        paymentId: payment.razorpayPaymentId,
      },

      createdAt: payment.createdAt,
    };

    res.status(200).json({
      success: true,
      payment: responseData,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
