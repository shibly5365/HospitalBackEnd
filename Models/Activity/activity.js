import mongoose from "mongoose";

const activitySchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
  patientName: { type: String },
  action: { type: String, required: true },        // e.g., "Completed consultation"
  type: { type: String, required: true },          // e.g., "consultation", "prescription"
  createdAt: { type: Date, default: Date.now }
});

const activityModel =mongoose.model("activitys",activitySchema)
export default activityModel
    