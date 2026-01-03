import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "appointment",
    required: true,
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  method: {
    type: String,
    enum: ["UPI", "Card", "Cash", "NetBanking"],
    required: true,
  },
  channel: { type: String, enum: ["Online", "WalkIn"], default: "Online" },
  amount: { type: Number, required: true },
  type: {
    type: String,
    enum: ["Initial", "Balance", "Refund"],
    default: "Initial",
  },
  status: {
    type: String,
    enum: ["Pending", "Paid", "Failed", "Refunded"],
    default: "Pending",
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  receiptUrl: String,
  createdAt: { type: Date, default: Date.now },
});

// ⭐ Performance Indexes
paymentSchema.index({ appointment: 1 }); // Find payments by appointment
paymentSchema.index({ patient: 1, createdAt: -1 }); // Patient's payments sorted by date
paymentSchema.index({ status: 1 }); // Filter by payment status
paymentSchema.index({ createdAt: -1 }); // Recent payments
paymentSchema.index({ patient: 1, status: 1 }); // Patient's payment status

const Payment =
  mongoose.models.payments || mongoose.model("payments", paymentSchema);
export default Payment;
