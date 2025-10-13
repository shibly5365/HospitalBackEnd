import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "doctors", // Reference to your doctorModel
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users", // Reference to your userModel (patients)
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Optional: Prevent duplicate reviews from the same patient for one doctor
reviewSchema.index({ doctor: 1, patient: 1 }, { unique: true });

const ReviewModel = mongoose.model("review", reviewSchema);

export default ReviewModel;
