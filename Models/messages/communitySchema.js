import mongoose from "mongoose";

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    avatar: {
      type: String,
      default: null,
    },

    type: {
      type: String,
      enum: ["public", "private", "broadcast"],
      default: "public",
    },

    isReadOnly: {
      type: Boolean,
      default: false,
    },

    allowedRoles: {
      type: [String],
      enum: ["patient", "doctor", "admin", "receptionist"],
      default: ["patient", "doctor", "admin", "receptionist"],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],

    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        index: true,
      },
    ],

    memberRequests: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "users",
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    maxMembers: {
      type: Number,
      default: null,
    },

    archived: {
      type: Boolean,
      default: false,
    },

    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "conversation",
      unique: true,
    },
  },
  { timestamps: true }
);

communitySchema.index({ type: 1, createdBy: 1 });
communitySchema.index({ members: 1 });
communitySchema.index({ updatedAt: -1 });

const CommunityModel = mongoose.model("community", communitySchema);
export default CommunityModel;
