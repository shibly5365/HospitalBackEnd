import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
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
    receptionist: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    appointmentDate: { type: Date, required: true },
    timeSlot: {
      start: { type: String, required: true },
      end: { type: String, required: true },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    consultationType: {
      type: String,
      enum: ["Online", "Offline"],
      default: "Offline",
    },
    videoLink: { type: String, default: null }, // Added for online consultations
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Refunded", "PartialPaid"],
      default: "Pending",
    },

    payments: [{ type: mongoose.Schema.Types.ObjectId, ref: "payments" }],
    status: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Cancelled",
        "With-Doctor",
        "Completed",
        "Missed",
      ], 
      default: "Pending",
    },
    previousAppointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "appointment",
      default: null,
    },
    nextAppointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "appointment",
      default: null,
    },
    reason: { type: String },
    tokenNumber: { type: Number, default: null },
    notes: { type: String },
    duration: { type: Number, default: 30 },
    medicalRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "medicalRecords",
    },
    reminderSent: { type: Boolean, default: false },
    isFollowUp: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index to avoid overlapping appointments for the same doctor
appointmentSchema.index({ doctor: 1, appointmentDate: 1 });

const Appointment =
  mongoose.models.appointment ||
  mongoose.model("appointment", appointmentSchema);
export default Appointment;
