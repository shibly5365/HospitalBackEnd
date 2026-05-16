import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    isGroup: {
      type: Boolean,
      default: false,
      index: true,
    },

    name: String,

    description: String,

    type: {
      type: String,
      enum: ["private", "group", "community", "broadcast"],
      default: "private",
    },

    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        index: true,
      },
    ],

    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],

    adminOnlyMessaging: {
      type: Boolean,
      default: false,
    },

    isReadOnly: {
      type: Boolean,
      default: false,
    },

    visibility: {
      type: String,
      enum: ["public", "private", "restricted"],
      default: "private",
    },

    maxMembers: {
      type: Number,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },

    avatar: {
      type: String,
      default: null,
    },

    // ✅ NEW FIELD
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "message",
      default: null,
    },

    chatExpiresAt: {
      type: Date,
      default: null,
    },

    archived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// ✅ INDEXES
conversationSchema.index({
  members: 1,
  updatedAt: -1,
});

conversationSchema.index({
  type: 1,
  visibility: 1,
});

// ✅ MODEL
const conversationModel = mongoose.model("conversation", conversationSchema);

export default conversationModel;
