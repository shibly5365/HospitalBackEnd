import conversationModel from "../Models/messages/conversationSchema.js";
import userModel from "../Models/User/UserModels.js";
import { validatePatientDoctorChat } from "./consultationValidator.js";

// ======================================================
// ROLE RULES
// ======================================================

const allowedRoles = {
  patient: ["doctor"],
  doctor: ["patient", "admin"],
  admin: ["doctor", "receptionist"],
  receptionist: ["admin"],
};

// ======================================================
// FORMAT REMAINING TIME
// ======================================================

const formatRemainingTime = (ms) => {
  if (!ms) return "No remaining time";

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m remaining`;
};

// ======================================================
// MAIN VALIDATOR
// ======================================================

export const canSendMessage = async (senderId, receiverId) => {
  try {
    // ======================================================
    // FIND USERS
    // ======================================================

    const sender = await userModel.findById(senderId);

    const receiver = await userModel.findById(receiverId);

    if (!sender || !receiver) {
      return {
        allowed: false,
        error: "User not found",
      };
    }

    // ======================================================
    // ROLE CHECK
    // ======================================================

    const senderRole = sender.role;
    const receiverRole = receiver.role;

    const roleAllowed = allowedRoles[senderRole]?.includes(receiverRole);

    if (!roleAllowed) {
      return {
        allowed: false,
        error: "Not allowed by role",
      };
    }

    // ======================================================
    // PATIENT ↔ DOCTOR CHAT
    // ======================================================

    const isPatientDoctorChat =
      (senderRole === "patient" && receiverRole === "doctor") ||
      (senderRole === "doctor" && receiverRole === "patient");

    if (isPatientDoctorChat) {
      // ======================================================
      // FIND CONVERSATION
      // ======================================================

      const convo = await conversationModel.findOne({
        type: "private",
        members: {
          $all: [sender._id, receiver._id],
        },
        $expr: {
          $eq: [{ $size: "$members" }, 2],
        },
      });

      if (!convo) {
        return {
          allowed: false,
          error: "Conversation not found",
        };
      }

      // ======================================================
      // ACTIVE CONSULTATION
      // ======================================================

      if (!convo.chatExpiresAt) {
        return {
          allowed: true,
          message: "Active consultation chat",
        };
      }

      // ======================================================
      // 48 HOUR POST CONSULTATION CHAT
      // ======================================================

      const now = new Date();

      const expiry = new Date(convo.chatExpiresAt);

      if (now > expiry) {
        return {
          allowed: false,
          error: "48 hour consultation chat expired",
        };
      }

      const remainingTime = expiry.getTime() - now.getTime();

      return {
        allowed: true,
        remainingTime,
        expiresAt: expiry,
        message: `Chat allowed. ${formatRemainingTime(remainingTime)}`,
      };
    }

    // ======================================================
    // DEFAULT ALLOW
    // ======================================================

    return {
      allowed: true,
    };
  } catch (error) {
    console.error("canSendMessage Error:", error);

    return {
      allowed: false,
      error: "Error validating permissions: " + error.message,
    };
  }
};
