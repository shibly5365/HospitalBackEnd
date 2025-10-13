import mongoose from "mongoose";

const doctorScheduleSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "doctors",
      required: true,
    },
    dayName: { type: String },
    date: { type: Date, required: true },
    workingHours: {
      start: { type: String, required: true },
      end: { type: String, required: true },
    },
    slots: [
      {
        start: { type: String, required: true },
        end: { type: String, required: true },
        duration: { type: Number, default: 30 },
        isBooked: { type: Boolean, default: false },
        onlineFee: { type: Number, required: true, default: 100 },
        offlineFee: { type: Number, required: true, default: 80 },
      },
    ],
    breaks: [{ start: String, end: String }],
  },
  { timestamps: true }
);

doctorScheduleSchema.index({ doctor: 1, date: 1 }, { unique: true });

const DoctorSchedule = mongoose.model("doctorSchedule", doctorScheduleSchema);
export default DoctorSchedule;
