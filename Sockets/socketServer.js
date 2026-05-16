import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie";

import userModel from "../Models/User/UserModels.js";
import MessageModel from "../Models/messages/messages.js";
import conversationModel from "../Models/messages/conversationSchema.js";

import { canSendMessage } from "../Units/chatPermissions.js";

let io;
const onlineUsers = new Map(); // userId -> { socketId, userName, userRole }
const userTyping = new Map(); // conversationId -> Set of typing userIds

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // ==================================================
  // SOCKET AUTH MIDDLEWARE
  // ==================================================

  io.use(async (socket, next) => {
    try {
      // ✅ Parse cookies from handshake
      const cookies = cookie.parse(socket.handshake.headers.cookie || "");

      // ✅ Get JWT token from cookie
      const token = cookies.token;

      if (!token) {
        return next(new Error("Unauthorized: No token"));
      }

      // ✅ Verify JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // ✅ Find user
      const user = await userModel.findById(decoded._id);

      if (!user) {
        return next(new Error("User not found"));
      }

      // ✅ Attach user to socket
      socket.userId = user._id.toString();
      socket.userRole = user.role;
      socket.userName = user.fullName;
      socket.userEmail = user.email;

      next();
    } catch (err) {
      console.error("🔴 Socket Auth Error:", err.message);
      next(new Error("Socket Authentication Failed"));
    }
  });

  // ==================================================
  // SOCKET CONNECTION
  // ==================================================

  io.on("connection", (socket) => {
    console.log("🟢 Socket Connected:", socket.userId, socket.userName);

    // ✅ Store online user
    onlineUsers.set(socket.userId, {
      socketId: socket.id,
      userName: socket.userName,
      userRole: socket.userRole,
      connectedAt: new Date(),
    });

    // ✅ Broadcast user online status to all clients
    io.emit("userOnline", {
      userId: socket.userId,
      userName: socket.userName,
      userRole: socket.userRole,
      connectedAt: new Date(),
    });

    console.log("👥 Online users:", Array.from(onlineUsers.keys()));

    // ==================================================
    // JOIN CONVERSATION
    // ==================================================

    socket.on("joinConversation", async ({ conversationId }) => {
      try {
        if (!conversationId) {
          return socket.emit("error", { error: "Conversation ID required" });
        }

        // ✅ Find conversation
        const convo = await conversationModel
          .findById(conversationId)
          .populate("members");

        if (!convo) {
          return socket.emit("error", { error: "Conversation not found" });
        }

        // ✅ Check membership
        const isMember = convo.members.some(
          (m) => m._id.toString() === socket.userId
        );

        if (!isMember) {
          return socket.emit("error", { error: "Not part of this conversation" });
        }

        // ✅ Join room
        socket.join(conversationId);
        console.log(`✅ User ${socket.userId} joined room: ${conversationId}`);

        // ✅ Notify others in conversation
        socket.to(conversationId).emit("userJoinedConversation", {
          userId: socket.userId,
          userName: socket.userName,
          userRole: socket.userRole,
        });

        socket.emit("joinConversationSuccess", {
          conversationId,
          message: "Joined conversation",
        });
      } catch (err) {
        console.error("🔴 Join Conversation Error:", err.message);
        socket.emit("error", { error: err.message });
      }
    });

    // ==================================================
    // LEAVE CONVERSATION
    // ==================================================

    socket.on("leaveConversation", ({ conversationId }) => {
      try {
        socket.leave(conversationId);
        console.log(`❌ User ${socket.userId} left room: ${conversationId}`);

        io.to(conversationId).emit("userLeftConversation", {
          userId: socket.userId,
          userName: socket.userName,
        });

        // Clear typing state
        if (userTyping.has(conversationId)) {
          userTyping.get(conversationId).delete(socket.userId);
          if (userTyping.get(conversationId).size === 0) {
            userTyping.delete(conversationId);
          }
        }
      } catch (err) {
        console.error("🔴 Leave Conversation Error:", err.message);
      }
    });

    // ==================================================
    // SEND MESSAGE
    // ==================================================

    socket.on(
      "sendMessage",
      async ({ conversationId, text, messageType = "text", fileUrl = null }) => {
        try {
          const sender = socket.userId;

          // ✅ Validate text
          if (messageType === "text" && (!text || !text.trim())) {
            return socket.emit("messageError", {
              error: "Message cannot be empty",
            });
          }

          // ✅ Find conversation
          const convo = await conversationModel
            .findById(conversationId)
            .populate("members");

          if (!convo) {
            return socket.emit("messageError", {
              error: "Conversation not found",
            });
          }

          // ✅ Membership check
          const isMember = convo.members.some(
            (m) => m._id.toString() === sender
          );

          if (!isMember) {
            return socket.emit("messageError", {
              error: "Not part of this chat",
            });
          }

          // ✅ Admin only check
          if (
            convo.adminOnlyMessaging &&
            !convo.admins.some((id) => id.toString() === sender)
          ) {
            return socket.emit("messageError", {
              error: "Only admin can send messages",
            });
          }

          // ✅ Read-only check
          if (convo.isReadOnly) {
            return socket.emit("messageError", {
              error: "This is a read-only community",
            });
          }

          // ✅ Permission check for private chats
          if (convo.type === "private") {
            for (const member of convo.members) {
              if (member._id.toString() === sender) continue;

              const permission = await canSendMessage(sender, member._id);

              if (!permission.allowed) {
                return socket.emit("messageError", {
                  error: permission.error,
                });
              }
            }
          }

          // ==================================================
          // CREATE MESSAGE
          // ==================================================

          const newMsg = await MessageModel.create({
            sender,
            conversation: conversationId,
            text: text ? text.trim() : "",
            messageType,
            fileUrl,
          });

          // ✅ Populate sender info
          const populatedMsg = await MessageModel.findById(newMsg._id)
            .populate("sender", "fullName role profileImage email")
            .lean();

          // ==================================================
          // EMIT TO ALL MEMBERS INCLUDING SENDER
          // ==================================================

          io.to(conversationId).emit("newMessage", populatedMsg);

          // ✅ Clear typing state for sender
          if (userTyping.has(conversationId)) {
            userTyping.get(conversationId).delete(sender);
          }

          // ✅ Notify typing state change
          io.to(conversationId).emit("userTyping", {
            userId: sender,
            conversationId,
            isTyping: false,
          });

          console.log(`✉️  Message sent to ${conversationId}:`, populatedMsg._id);
        } catch (err) {
          console.error("🔴 Socket Message Error:", err.message);
          socket.emit("messageError", {
            error: err.message || "Failed to send message",
          });
        }
      }
    );

    // ==================================================
    // TYPING INDICATOR
    // ==================================================

    socket.on("typing", ({ conversationId, isTyping }) => {
      try {
        // Track typing users
        if (!userTyping.has(conversationId)) {
          userTyping.set(conversationId, new Set());
        }

        if (isTyping) {
          userTyping.get(conversationId).add(socket.userId);
        } else {
          userTyping.get(conversationId).delete(socket.userId);
        }

        // Broadcast to all in conversation (including sender)
        io.to(conversationId).emit("userTyping", {
          userId: socket.userId,
          userName: socket.userName,
          conversationId,
          isTyping,
          typingUsers: Array.from(userTyping.get(conversationId) || []),
        });
      } catch (err) {
        console.error("🔴 Typing Error:", err.message);
      }
    });

    // ==================================================
    // MESSAGE READ RECEIPT
    // ==================================================

    socket.on("markMessageAsRead", async ({ messageId, conversationId }) => {
      try {
        const message = await MessageModel.findByIdAndUpdate(
          messageId,
          {
            $addToSet: {
              readBy: {
                userId: socket.userId,
                readAt: new Date(),
              },
            },
          },
          { new: true }
        ).lean();

        if (message) {
          // Emit to all in conversation
          io.to(conversationId).emit("messageRead", {
            messageId,
            userId: socket.userId,
            readAt: new Date(),
          });
        }
      } catch (err) {
        console.error("🔴 Mark Read Error:", err.message);
      }
    });

    // ==================================================
    // DELETE MESSAGE (SOFT DELETE)
    // ==================================================

    socket.on("deleteMessage", async ({ messageId, conversationId }) => {
      try {
        const message = await MessageModel.findById(messageId);

        if (!message) {
          return socket.emit("error", { error: "Message not found" });
        }

        // Check if sender is the author
        if (message.sender.toString() !== socket.userId) {
          return socket.emit("error", {
            error: "You can only delete your own messages",
          });
        }

        // Soft delete
        message.isDeleted = true;
        await message.save();

        // Emit deletion to all
        io.to(conversationId).emit("messageDeleted", {
          messageId,
          conversationId,
        });

        console.log(`🗑️  Message deleted: ${messageId}`);
      } catch (err) {
        console.error("🔴 Delete Message Error:", err.message);
        socket.emit("error", { error: err.message });
      }
    });

    // ==================================================
    // EDIT MESSAGE
    // ==================================================

    socket.on("editMessage", async ({ messageId, conversationId, newText }) => {
      try {
        if (!newText || !newText.trim()) {
          return socket.emit("error", { error: "New message cannot be empty" });
        }

        const message = await MessageModel.findById(messageId);

        if (!message) {
          return socket.emit("error", { error: "Message not found" });
        }

        // Check if sender is the author
        if (message.sender.toString() !== socket.userId) {
          return socket.emit("error", {
            error: "You can only edit your own messages",
          });
        }

        // Update message
        message.text = newText.trim();
        message.editedAt = new Date();
        await message.save();

        // Populate sender
        const updated = await MessageModel.findById(messageId)
          .populate("sender", "fullName role profileImage email")
          .lean();

        // Emit edit to all
        io.to(conversationId).emit("messageEdited", updated);

        console.log(`✏️  Message edited: ${messageId}`);
      } catch (err) {
        console.error("🔴 Edit Message Error:", err.message);
        socket.emit("error", { error: err.message });
      }
    });

    // ==================================================
    // DISCONNECT
    // ==================================================

    socket.on("disconnect", () => {
      console.log(`🔴 User Disconnected: ${socket.userId}`);

      // ✅ Remove from online users
      onlineUsers.delete(socket.userId);

      // ✅ Clear typing state
      for (const [convId, typingSet] of userTyping.entries()) {
        if (typingSet.has(socket.userId)) {
          typingSet.delete(socket.userId);
          io.to(convId).emit("userTyping", {
            userId: socket.userId,
            isTyping: false,
          });
        }
      }

      // ✅ Broadcast user offline
      io.emit("userOffline", {
        userId: socket.userId,
        disconnectedAt: new Date(),
      });

      console.log("👥 Online users:", Array.from(onlineUsers.keys()));
    });

    // ==================================================
    // ERROR HANDLER
    // ==================================================

    socket.on("error", (error) => {
      console.error("🔴 Socket Error:", error);
    });
  });

  return io;
}

/**
 * Get IO instance
 */
export function getIO() {
  return io;
}

/**
 * Get online users list
 */
export function getOnlineUsers() {
  return Array.from(onlineUsers.keys());
}

/**
 * Get online users with details
 */
export function getOnlineUsersWithDetails() {
  return Object.fromEntries(onlineUsers);
}

/**
 * Check if user is online
 */
export function isUserOnline(userId) {
  return onlineUsers.has(userId.toString());
}

