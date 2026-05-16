import express from "express";

import {
  addMember,
  createGroup,
  getConversations,
  getMessages,
  getOrCreateConversation,
  removeMember,
  searchUsers,
  sendMessage,
  markMessageAsRead,
  editMessage,
  deleteMessage,
} from "../../Controllers/Messages/messages.js";
import {
  uploadImage,
  uploadAudio,
  uploadDocument,
  uploadFile,
  deleteFile,
  getFileInfo,
  upload,
} from "../../Controllers/Messages/fileController.js";
import { AuthMiddleware } from "../../Middleware/AuthMiddleware.js";

const MessageRouter = express.Router();

// ===============================================
// PRIVATE CHAT
// ===============================================

MessageRouter.get(
  "/conversations",
  AuthMiddleware(["patient", "doctor", "admin", "receptionist"]),
  getConversations
);

// create or get private chat
MessageRouter.post(
  "/conversation",
  AuthMiddleware(["patient", "doctor", "admin", "receptionist"]),
  getOrCreateConversation
);

// send message
MessageRouter.post(
  "/send",
  AuthMiddleware(["patient", "doctor", "admin", "receptionist"]),
  sendMessage
);

// get messages
MessageRouter.get(
  "/messages/:conversationId",
  AuthMiddleware(["patient", "doctor", "admin", "receptionist"]),
  getMessages
);

// mark message as read
MessageRouter.patch(
  "/:messageId/read",
  AuthMiddleware(["patient", "doctor", "admin", "receptionist"]),
  markMessageAsRead
);

// edit message
MessageRouter.patch(
  "/:messageId/edit",
  AuthMiddleware(["patient", "doctor", "admin", "receptionist"]),
  editMessage
);

// delete message (soft delete)
MessageRouter.delete(
  "/:messageId",
  AuthMiddleware(["patient", "doctor", "admin", "receptionist"]),
  deleteMessage
);

// ===============================================
// FILE UPLOADS
// ===============================================

// Upload image
MessageRouter.post(
  "/upload/image",
  AuthMiddleware(["patient", "doctor", "admin", "receptionist"]),
  upload.single("file"),
  uploadImage
);

// Upload audio (voice message)
MessageRouter.post(
  "/upload/audio",
  AuthMiddleware(["patient", "doctor", "admin", "receptionist"]),
  upload.single("file"),
  uploadAudio
);

// Upload document
MessageRouter.post(
  "/upload/document",
  AuthMiddleware(["patient", "doctor", "admin", "receptionist"]),
  upload.single("file"),
  uploadDocument
);

// Upload any file
MessageRouter.post(
  "/upload/file",
  AuthMiddleware(["patient", "doctor", "admin", "receptionist"]),
  upload.single("file"),
  uploadFile
);

// Delete file
MessageRouter.post(
  "/upload/delete",
  AuthMiddleware(["patient", "doctor", "admin", "receptionist"]),
  deleteFile
);

// Get file info
MessageRouter.get(
  "/upload/:publicId",
  AuthMiddleware(["patient", "doctor", "admin", "receptionist"]),
  getFileInfo
);

// ===============================================
// COMMUNITY / GROUP
// ===============================================

// create community
MessageRouter.post("/group/create", AuthMiddleware(["admin"]), createGroup);

// add member
MessageRouter.post("/group/add-member", AuthMiddleware(["admin"]), addMember);

// remove member
MessageRouter.post(
  "/group/remove-member",
  AuthMiddleware(["admin"]),
  removeMember
);

// search users
MessageRouter.get(
  "/search-users",
  AuthMiddleware(["patient", "doctor", "admin", "receptionist"]),
  searchUsers
);

export default MessageRouter;
