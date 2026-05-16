import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    title: String,
    message: String,
    type: String, // leave, system, alert
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Notification= mongoose.model("notifications", notificationSchema);
export default Notification