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
      ref: "payments",
    },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "doctors",
      required: true,
    },

    // 🩺 Clinical Info
    chiefComplaint: String,
    symptoms: String,
    diagnosis: [{ type: String }],

    // ✨ Single Prescription Connected Here
    prescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "prescription",
    },

    // 📌 Patient Vitals
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
      spo2: String,
      glucose: String,
      respiratoryRate: String,
    },

    // 🧪 Lab / Blood Tests
    labTests: [
      {
        testName: String,
        reason: String,
      },
    ],

    labReports: [
      {
        reportType: String,
        summary: String,
        fileUrl: String,
        date: { type: Date, default: Date.now },
      },
    ],

    bloodTests: [
      {
        testName: String,
        result: String,
        unit: String,
        date: { type: Date, default: Date.now },
      },
    ],

    // 📄 Doctor Notes / Follow-ups
    notes: String,
    followUpDate: Date,
    followUpNote: String,

    // 📎 Attachments
    attachments: [
      {
        fileUrl: String,
        fileType: String,
      },
    ],

    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
    },
  },
  { timestamps: true }
);

// ⭐ Performance Indexes
medicalRecordSchema.index({ patient: 1, createdAt: -1 }); // Patient's records sorted by date
medicalRecordSchema.index({ doctor: 1 }); // Doctor's records
medicalRecordSchema.index({ appointment: 1 }); // Lookup by appointment
medicalRecordSchema.index({ status: 1 }); // Active/archived records
medicalRecordSchema.index({ patient: 1, status: 1 }); // Patient's active records

const MedicalRecord =
  mongoose.models.medicalRecord ||
  mongoose.model("medicalRecord", medicalRecordSchema);

export default MedicalRecord;
