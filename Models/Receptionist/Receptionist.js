import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "doctors",
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "appointment",
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    comment: {
      type: String,
    },
  },
  { timestamps: true }
);

// Index for performance
reviewSchema.index({ doctor: 1 });
reviewSchema.index({ patient: 1 });
reviewSchema.index({ createdAt: -1 });

const ReviewModel =
  mongoose.models.reviews || mongoose.model("reviews", reviewSchema);

export default ReviewModel;