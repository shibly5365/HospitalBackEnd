import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
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

    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "appointment",
      required: true,
    },

    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },

    review: {
      type: String,
    },

    tags: [
      {
        type: String,
        enum: [
          "Good Service",
          "Friendly Doctor",
          "Long Wait Time",
          "Excellent Care",
          "Needs Improvement",
        ],
      },
    ],
  },
  { timestamps: true },
);

const Feedback = mongoose.model("feedback", feedbackSchema);
export default Feedback;
