import mongoose from "mongoose";

/**
 * Notification Schema
 * Stores all system notifications (appointments, messages, calls, alerts)
 */
const notificationSchema = new mongoose.Schema(
  {
    // Who receives the notification
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },

    // Who triggered the notification
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },

    // Type of notification
    type: {
      type: String,
      enum: [
        "appointment_booked",
        "appointment_confirmed",
        "appointment_cancelled",
        "appointment_completed",
        "appointment_reminder",
        "message_received",
        "call_incoming",
        "call_missed",
        "prescription_created",
        "medical_record_uploaded",
        "system_alert",
        "general_notification",
      ],
      required: true,
      index: true,
    },

    // Notification title
    title: {
      type: String,
      required: true,
    },

    // Detailed message
    message: {
      type: String,
      required: true,
    },

    // Related resource (appointment, conversation, etc.)
    relatedResource: {
      resourceType: {
        type: String,
        enum: [
          "appointment",
          "conversation",
          "call",
          "prescription",
          "medical_record",
        ],
      },
      resourceId: {
        type: mongoose.Schema.Types.ObjectId,
      },
    },

    // Read status
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    // When the notification was read
    readAt: {
      type: Date,
      default: null,
    },

    // Additional data (flexible)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Priority level
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 }); // Get unread notifications
notificationSchema.index({ recipient: 1, createdAt: -1 }); // Get all notifications
notificationSchema.index({ type: 1 }); // Filter by type
notificationSchema.index({ "relatedResource.resourceId": 1 }); // Find by resource
notificationSchema.index({ isDeleted: 1, createdAt: -1 }); // Soft delete queries

// TTL index for auto-deletion of old notifications (after 90 days)
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

const Notification = mongoose.model("notification", notificationSchema);

export default Notification;
