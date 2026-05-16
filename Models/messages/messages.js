import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },

    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "conversation",
      required: true,
      index: true,
    },

    messageType: {
      type: String,
      enum: ["text", "image", "audio", "pdf", "document", "video"],
      default: "text",
    },

    text: {
      type: String,
      default: "",
    },

    fileUrl: {
      type: String,
      default: null,
    },

    audioUrl: {
      type: String,
      default: null,
    },

    duration: {
      type: Number,
      default: null,
    },

    readBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "users",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    isDeleted: {
      type: Boolean,
      default: false,
    },

    editedAt: Date,
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });

const MessageModel = mongoose.model("message", messageSchema);
export default MessageModel;