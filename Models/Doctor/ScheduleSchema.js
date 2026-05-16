import mongoose from "mongoose";

const doctorScheduleSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "doctors",
      required: true,
    },

    date: { type: Date, required: true },
    dayName: { type: String },

    isLeaveDay: {
      type: Boolean,
      default: false,
    },

    leaveRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "doctorLeave",
      default: null,
    },

    workingHours: {
      start: { type: String, required: true }, // "09:00"
      end: { type: String, required: true }, // "17:00"
    },

    workType: {
      type: String,
      enum: [
        "Full Day",
        "Half Day - Morning",
        "Half Day - Afternoon",
        "Custom",
      ],
      default: "Custom",
    },

    totalWorkingHours: { type: Number, default: 0 },

    slotDuration: {
      type: Number,
      default: 30,
    },

    preset: {
      type: String,
      enum: ["morning", "afternoon", "evening", "full-day", "custom"],
      default: "custom",
    },

    breaks: [{ start: String, end: String }],

    slots: [
      {
        start: String,
        end: String,
        duration: Number,
        isBooked: { type: Boolean, default: false },
        onlineFee: { type: Number, default: 100 },
        offlineFee: { type: Number, default: 80 },
      },
    ],
  },
  { timestamps: true }
);

doctorScheduleSchema.index({ doctor: 1, date: 1 }, { unique: true });

const DoctorSchedule = mongoose.model("doctorSchedule", doctorScheduleSchema);
export default DoctorSchedule;
