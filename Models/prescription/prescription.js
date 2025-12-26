import mongoose from "mongoose";

const prescriptionSchema = new mongoose.Schema(
  {
    medicalRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "medicalRecord",
      required: true,
    },

    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "doctors",
      required: true,
    },

    medicines: [
      {
        medicineName: { type: String, required: true },
        dosage: String, // e.g., "500mg"
        frequency: String, // e.g., "Twice a day"
        duration: String, // e.g., "5 days"
        instructions: String, // e.g., "After food"
      },
    ],

    notes: String,
  },
  { timestamps: true }
);

const Prescription =
  mongoose.models.prescription ||
  mongoose.model("prescription", prescriptionSchema);

export default Prescription;
