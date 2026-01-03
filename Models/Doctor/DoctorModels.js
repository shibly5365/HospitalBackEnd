import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
      required: true,
    },

    specialization: { type: String, required: true },
    qualification: { type: String, required: true },
    experience: { type: Number, default: 0 },
    salary: { type: Number, default: 0 },
    doctorId: { type: String, unique: true },

    consultationType: {
      type: String,
      enum: ["online", "offline"],
      default: "offline",
    },

    availableDays: [{ type: String }],
    availableSlots: [
      {
        start: String,
        end: String,
      },
    ],

    // ⭐ Appointment duration
    duration: {
      type: Number,
      default: 15,
      required: true,
    },

    // ⭐ Maximum patients allowed per day
    maxPatientsPerDay: {
      type: Number,
      default: 20,
      required: true,
    },

    consultationFee: { type: Number, default: 0 },
    bio: { type: String },

    status: {
      type: String,
      enum: ["available", "unavailable"],
      default: "available",
    },
  },
  { timestamps: true }
);

// ⭐ Performance Indexes
doctorSchema.index({ userId: 1 }); // Fast doctor lookup by userId
doctorSchema.index({ department: 1 }); // Fast filtering by department
doctorSchema.index({ status: 1 }); // For availability queries
doctorSchema.index({ doctorId: 1 }); // Fast lookup by doctor ID
doctorSchema.index({ createdAt: -1 }); // For sorting
doctorSchema.index({ department: 1, status: 1 }); // Compound for department queries

const doctorModel = mongoose.model("doctors", doctorSchema);
export default doctorModel;
