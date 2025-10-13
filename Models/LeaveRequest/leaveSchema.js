import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "doctors",
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    type: {
      type: String,
      enum: ["sick", "casual"],
      required: true,
    },
    description: { type: String, required: true },
    duration: {
      type: String,
      enum: ["Full Day", "Half Day"],
      default: "Full Day",
      required: true,
    },
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
