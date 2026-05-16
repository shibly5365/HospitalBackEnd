import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      unique: true,
    },

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

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "doctors",
      required: true,
    },

    method: {
      type: String,
      enum: ["UPI", "Card", "Cash", "NetBanking"],
      required: true,
    },

    channel: {
      type: String,
      enum: ["Online", "WalkIn"],
      default: "Online",
    },

    amount: {
      type: Number,
      required: true,
    },

    // For UI (Consultation / Pharmacy etc)
    type: {
      type: String,
      enum: ["Consultation", "Pharmacy", "Surgery", "Lab", "Other"],
      default: "Consultation",
    },

    status: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      default: "Pending",
    },

    // Itemized bill
    items: [
      {
        title: String,
        amount: Number,
      },
    ],

    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    receiptUrl: String,
  },
  { timestamps: true },
);

// Indexes
paymentSchema.index({ doctor: 1, createdAt: -1 });
paymentSchema.index({ patient: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });

const Payment =
  mongoose.models.payments || mongoose.model("payments", paymentSchema);

export default Payment;
