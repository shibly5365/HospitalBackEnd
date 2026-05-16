import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema(
  {
    name: String,
    date: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: ["National", "Hospital"],
      default: "Hospital",
    },
  },
  { timestamps: true },
);

holidaySchema.index({ date: 1 });

export default mongoose.model("holidays", holidaySchema);
