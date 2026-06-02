import Appointment from "../../Models/Appointment/Appointment.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import Feedback from "../../Models/feedbackSchema/feedbackSchema.js";

export const addFeedback = async (req, res) => {
  try {
    const patientId = req.user._id;

    const { appointmentId, rating, review, tags } = req.body;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Patient owns appointment
    if (appointment.patient.toString() !== patientId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Consultation completed
    if (appointment.status !== "Completed") {
      return res.status(400).json({
        success: false,
        message: "Feedback can only be submitted after consultation completion",
      });
    }

    // Check if feedback already exists
    const existingFeedback = await Feedback.findOne({
      appointment: appointmentId,
      patient: patientId,
    });

    if (existingFeedback) {
      return res.status(400).json({
        success: false,
        message: "Feedback already submitted",
      });
    }

    const feedback = await Feedback.create({
      patient: patientId,
      doctor: appointment.doctor,
      appointment: appointmentId,
      rating,
      review,
      tags,
    });

    res.status(201).json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const getDoctorFeedbacks = async (req, res) => {
  try {
    const doctor = await doctorModel.findOne({
      userId: req.user._id,
    });

    const feedbacks = await Feedback.find({
      doctor: doctor._id,
    })
      .populate("patient", "fullName profileImage")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      total: feedbacks.length,
      data: feedbacks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const getDoctorRatingSummary = async (req, res) => {
  try {
    const doctor = await doctorModel.findOne({
      userId: req.user._id,
    });

    const stats = await Feedback.aggregate([
      {
        $match: {
          doctor: doctor._id,
        },
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" },

          oneStar: {
            $sum: {
              $cond: [{ $eq: ["$rating", 1] }, 1, 0],
            },
          },

          twoStar: {
            $sum: {
              $cond: [{ $eq: ["$rating", 2] }, 1, 0],
            },
          },

          threeStar: {
            $sum: {
              $cond: [{ $eq: ["$rating", 3] }, 1, 0],
            },
          },

          fourStar: {
            $sum: {
              $cond: [{ $eq: ["$rating", 4] }, 1, 0],
            },
          },

          fiveStar: {
            $sum: {
              $cond: [{ $eq: ["$rating", 5] }, 1, 0],
            },
          },
        },
      },
    ]);

    const summary = stats[0] || {
      totalReviews: 0,
      averageRating: 0,
      oneStar: 0,
      twoStar: 0,
      threeStar: 0,
      fourStar: 0,
      fiveStar: 0,
    };

    summary.averageRating = Number(summary.averageRating?.toFixed(1) || 0);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const getDoctorRatingById = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const stats = await Feedback.aggregate([
      {
        $match: {
          doctor: new mongoose.Types.ObjectId(doctorId),
        },
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" },
        },
      },
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        totalReviews: 0,
        averageRating: 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
