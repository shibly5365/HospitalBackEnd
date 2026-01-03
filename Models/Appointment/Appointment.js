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

// ⭐ Performance Indexes
// Existing index for overlapping appointment check
appointmentSchema.index({ doctor: 1, appointmentDate: 1 });

// Additional critical indexes for query optimization
appointmentSchema.index({ patient: 1, appointmentDate: -1 }); // Patient's appointments sorted by date
appointmentSchema.index({ doctor: 1, status: 1 }); // Doctor's appointments by status
appointmentSchema.index({ patient: 1, status: 1 }); // Patient's appointments by status
appointmentSchema.index({ appointmentDate: -1 }); // General sorting by date
appointmentSchema.index({ status: 1 }); // Filtering by status
appointmentSchema.index({ paymentStatus: 1 }); // Payment status queries
appointmentSchema.index({ createdAt: -1 }); // Recent appointments
appointmentSchema.index({ doctor: 1, appointmentDate: 1, status: 1 }); // Compound for doctor daily view

const Appointment =
  mongoose.models.appointment ||
  mongoose.model("appointment", appointmentSchema);
export default Appointment;
