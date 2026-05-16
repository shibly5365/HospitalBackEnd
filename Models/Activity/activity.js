import mongoose from "mongoose";

const activitySchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "doctors", required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
  patientName: { type: String },
  action: { type: String, required: true },        // e.g., "Completed consultation"
  type: { type: String, required: true },          // e.g., "consultation", "prescription"
  createdAt: { type: Date, default: Date.now }
});

activitySchema.index({ doctorId: 1, createdAt: -1 });
activitySchema.index({ patientId: 1, createdAt: -1 });

const activityModel =mongoose.model("activitys",activitySchema)
export default activityModel
    