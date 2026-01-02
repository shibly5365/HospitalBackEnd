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

const doctorModel = mongoose.model("doctors", doctorSchema);
export default doctorModel;
