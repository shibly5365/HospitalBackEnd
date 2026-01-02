import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "doctors",
      required: true,
    },

    startDate: { type: Date, required: true },   // 1st Feb
    endDate: { type: Date, required: true },     // 3rd Feb (multi-day leave)

    type: {
      type: String,
      enum: ["sick", "casual", "emergency", "personal"],
      required: true,
    },

    // Full/half/hour-based leave
    durationType: {
      type: String,
      enum: ["Full Day", "Half Day - Morning", "Half Day - Afternoon", "Hourly"],
      required: true,
      default: "Full Day",
    },

    // For half-day or hourly leave
    startTime: { type: String }, // "09:00"
    endTime: { type: String },   // "13:00"

    description: { type: String, required: true },

    // Auto-calculated fields
    totalHours: { type: Number, default: 0 },
    totalDays: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const DoctorLeave = mongoose.model("doctorLeave", leaveSchema);
export default DoctorLeave;
