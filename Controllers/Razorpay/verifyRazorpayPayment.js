import crypto from "crypto";
import Payment from "../../Models/Payments/paymentSchema.js";
import Appointment from "../../Models/Appointment/Appointment.js";

export const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentId,
    } = req.body;

    // ✅ Generate Signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    // ✅ Verify Signature
    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    // ✅ Find Payment
    const payment = await Payment.findOne({
      paymentId,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // ✅ Update Payment
    payment.status = "Paid";

    payment.razorpayPaymentId = razorpay_payment_id;

    payment.razorpaySignature = razorpay_signature;

    await payment.save();

    // ✅ Update Appointment
    await Appointment.findByIdAndUpdate(payment.appointment, {
      paymentStatus: "Paid",
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const demoPaymentSuccess = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // ✅ Mark Payment Paid
    payment.status = "Paid";

    payment.razorpayPaymentId = "demo_payment_" + Date.now();

    await payment.save();

    // ✅ Update Appointment
    await Appointment.findByIdAndUpdate(payment.appointment, {
      paymentStatus: "Paid",
    });

    return res.status(200).json({
      success: true,
      message: "Demo payment success",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const demoPaymentFailed = async (req, res) => {
  try {
    const { paymentId } = req.params;

    // ✅ Find Payment
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // ✅ Find Appointment
    const appointment = await Appointment.findById(payment.appointment);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // ✅ Update Payment Status
    payment.status = "Failed";

    await payment.save();

    // ✅ Cancel Appointment
    appointment.status = "Cancelled";

    appointment.paymentStatus = "Pending";

    await appointment.save();

    // ✅ Reopen Slot
    await DoctorSchedule.updateOne(
      {
        doctor: appointment.doctor,

        date: appointment.appointmentDate,
      },
      {
        $set: {
          "slots.$[elem].isBooked": false,

          "slots.$[elem].bookingStatus": "Available",
        },
      },
      {
        arrayFilters: [
          {
            "elem.start": appointment.timeSlot.start,

            "elem.end": appointment.timeSlot.end,
          },
        ],
      },
    );

    return res.status(200).json({
      success: true,

      message: "Payment failed and slot reopened",
    });
  } catch (error) {
    console.error("demoPaymentFailed:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
