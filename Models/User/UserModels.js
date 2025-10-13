import mongoose from "mongoose";
import { generatePatientId } from "../../Middleware/generatePatientId.js";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function () {
        return this.role !== "patient";
      },
    },
    contact: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["superadmin", "admin", "doctor", "patient", "receptionist"],
      required: true,
      default: "patient",
    },
    patientType: {
      type: String,
      enum: ["New Patient", "Returning Patient", "Other"],

      required: function () {
        return this.role === "patient";
      },
    },
    dob: {
      type: Date,
    },
    age: {
      type: Number,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zip: { type: String },
    },
    employeeId: { type: String },
    patientId: { type: String, unique: true, sparse: true },
    profileImage: {
      type: String,
    },
    emergencyContact: {
      name: { type: String },
      number: { type: String },
    },
    insuranceInfo: {
      type: String,
    },
    isBlocked: { type: Boolean, default: false },
    // Email verification
    verifyOtp: {
      type: String,
      default: "",
    },
    createdByDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "doctors", // or "users" if your doctor is stored in users
      required: false,
    },

    verifyOtpExpireAt: {
      type: Date,
      default: null,
    },
    isAccountVerified: {
      type: Boolean,
      default: false,
    },
    // Reset password
    resetToken: {
      type: String,
      default: "",
    },
    resetTokenExpireAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);
userSchema.pre("save", generatePatientId);

const userModel = mongoose.model("users", userSchema);
export default userModel;
