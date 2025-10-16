import mongoose from "mongoose";

const medicalRecordSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "appointment",
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "payments", // 👈 add this line
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "doctors",
      required: true,
    },

    prescription: [
      {
        medicineName: { type: String, required: true },
        dosage: { type: String },
        frequency: { type: String },
        duration: { type: String },
      },
    ],
    vitals: {
      bloodPressure: String,
      heartRate: String,
      temperature: String,
      weight: String,
      height: String,
      bloodGroup: {
        type: String,
        enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      },
      bloodSugar: String,
      hemoglobin: String,
    },
    bloodTests: [
      {
        testName: { type: String }, // e.g., "HbA1c"
        result: { type: String }, // e.g., "6.2"
        unit: { type: String }, // e.g., "%"
        date: { type: Date, default: Date.now },
      },
    ],
    notes: { type: String },
    diagnosis: { type: String },
    followUpDate: { type: Date },
    attachments: [String],
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
    },
  },
  { timestamps: true }
);

const MedicalRecord =
  mongoose.models.medicalRecord ||
  mongoose.model("medicalRecord", medicalRecordSchema);

export default MedicalRecord;
