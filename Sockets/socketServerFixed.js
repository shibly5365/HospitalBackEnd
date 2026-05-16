// ✅ FIXED VERSION - With Authentication, Scalability & Security

import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import MessageModel from "../Models/messages/messages.js";
import userModel from "../Models/User/UserModels.js";
import doctorModel from "../Models/Doctor/DoctorModels.js";
import receptionistModel from "../Models/Receptionist/Receptionist.js";
import Appointment from "../Models/Appointment/Appointment.js";
import AuditLog from "../Models/AuditLog/AuditLog.js";
import sanitizeHtml from "sanitize-html";

// ✅ FIX #1: Remove global Map - use Socket.IO rooms instead
// const onlineUsers = new Map();  // ❌ REMOVED - causes memory leak + not scalable

const allowedRoles = {
  patient: ['doctor'],
  doctor: ['patient', 'admin'],
  admin: ['doctor', 'receptionist'],
  receptionist: ['admin'],
};

export function initSocket(server) {
  const io = new Server(server, {
    cors: {
      // ✅ FIX #3: Specific origin instead of wildcard
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // ✅ FIX #1: Authentication middleware - verify JWT before connection
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      
      if (!token) {
        return next(new Error("❌ No token provided"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // ✅ Attach authenticated user info to socket
      socket.userId = decoded._id;
      socket.userRole = decoded.role;
      socket.userEmail = decoded.email;
      
      console.log(`✅ Socket auth successful: ${socket.userId} (${socket.userRole})`);
      next();
    } catch (err) {
      console.error(`❌ Socket auth failed:`, err.message);
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`✅ User ${socket.userId} connected with socket ${socket.id}`);

    // ✅ FIX #1: Join user-specific room for targeted messaging
    socket.join(`user:${socket.userId}`);
    socket.join("online-users");  // For presence updates

    // ✅ Log connection for audit
    logAudit(socket.userId, "SOCKET_CONNECT", {}, socket.id, socket.userRole);

    // ✅ REGISTER USER EVENT - now just emits to rooms
    socket.on("register", () => {
      try {
        socket.data.registered = true;
        // ✅ Broadcast to online-users room only
        io.to("online-users").emit("user-online", {
          userId: socket.userId,
          role: socket.userRole,
          socketId: socket.id,
        });
        console.log(`✅ User ${socket.userId} registered`);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ✅ SEND MESSAGE - FIXED VERSION
    socket.on("sendMessage", async ({ receiver, text }) => {
      try {
        // ✅ FIX #4: Use authenticated socket.userId instead of client-provided sender
        const sender = socket.userId;
        const senderRole = socket.userRole;

        // ✅ FIX #5: Input validation and sanitization
        if (!receiver || !text) {
          return socket.emit("messageError", { error: "Missing receiver or text" });
        }

        // Trim and check length
        const sanitizedText = String(text).trim();
        if (sanitizedText.length === 0 || sanitizedText.length > 5000) {
          return socket.emit("messageError", { 
            error: "Message must be 1-5000 characters" 
          });
        }

        // ✅ Sanitize HTML to prevent XSS
        const cleanText = sanitizeHtml(sanitizedText, {
          allowedTags: [],
          allowedAttributes: {},
        });

        // ✅ Verify receiver exists
        let receiverUser = await userModel.findById(receiver);

        // Lookup if doctor
        if (!receiverUser) {
          const doctor = await doctorModel.findById(receiver);
          if (doctor) {
            receiverUser = await userModel.findById(doctor.userId);
          }
        }

        // Lookup if receptionist
        if (!receiverUser) {
          const rec = await receptionistModel.findById(receiver);
          if (rec) {
            receiverUser = await userModel.findById(rec.userId);
          }
        }

        if (!receiverUser) {
          return socket.emit("messageError", { error: "Receiver not found" });
        }

        // ✅ Verify sender exists
        const senderUser = await userModel.findById(sender);
        if (!senderUser) {
          return socket.emit("messageError", { error: "Sender not found" });
        }

        // ✅ Role-based access control
        if (!allowedRoles[senderRole]?.includes(receiverUser.role)) {
          await logAudit(sender, "MESSAGE_SEND_BLOCKED", { reason: "Role not allowed" }, socket.id, senderRole);
          return socket.emit("messageError", { error: "Not allowed to message this role" });
        }

        // ✅ Patient-doctor messaging restrictions
        if (senderRole === "patient" && receiverUser.role === "doctor") {
          const doctorDoc = await doctorModel.findOne({ userId: receiverUser._id });

          const latest = await Appointment.findOne({
            patient: sender,
            doctor: doctorDoc?._id,
          }).sort({ appointmentDate: -1 });

          if (!latest) {
            await logAudit(sender, "MESSAGE_SEND_BLOCKED", { reason: "No appointment" }, socket.id, senderRole);
            return socket.emit("messageError", { error: "Book consultation first" });
          }

          const now = new Date();
          const apptDate = new Date(latest.appointmentDate);

          const [sH, sM] = latest.timeSlot.start.split(":").map(Number);
          const [eH, eM] = latest.timeSlot.end.split(":").map(Number);

          const start = new Date(apptDate);
          start.setHours(sH, sM);

          const end = new Date(apptDate);
          end.setHours(eH, eM);

          let allowed = false;

          // Allow during consultation or "With-Doctor" status
          if (latest.status === "With-Doctor" || (now >= start && now <= end)) {
            allowed = true;
          }

          // Allow 24 hours after completion
          if (latest.status === "Completed") {
            const ms24 = 24 * 60 * 60 * 1000;
            const completionDate = latest.completedAt || latest.updatedAt;
            if (now <= new Date(new Date(completionDate).getTime() + ms24)) {
              allowed = true;
            }
          }

          if (!allowed) {
            await logAudit(sender, "MESSAGE_SEND_BLOCKED", { reason: "Chat expired" }, socket.id, senderRole);
            return socket.emit("messageError", { 
              error: "Chat expired. Only available for 24h after consultation." 
            });
          }
        }

        // ✅ Save message to database
        const msg = await MessageModel.create({
          sender,
          receiver: receiverUser._id,
          text: cleanText,
          readAt: null,
        });

        // ✅ Log message send
        await logAudit(sender, "MESSAGE_SENT", { to: receiverUser._id }, socket.id, senderRole);

        // ✅ FIX #1: Use rooms instead of Map lookup
        io.to(`user:${receiverUser._id}`).emit("newMessage", {
          ...msg.toObject(),
          senderName: senderUser.fullName,
          senderRole: senderRole,
        });

        socket.emit("messageSent", {
          ...msg.toObject(),
          status: "sent",
        });

      } catch (err) {
        console.error("Send message error:", err);
        socket.emit("messageError", { error: err.message });
      }
    });

    // ✅ TYPING INDICATOR - improved
    socket.on("typing", ({ to }) => {
      try {
        if (!to) return;
        
        // ✅ Use rooms for delivery
        io.to(`user:${to}`).emit("typing", {
          from: socket.userId,
          fromName: socket.data.userName,
        });
      } catch (err) {
        console.error("Typing error:", err);
      }
    });

    socket.on("stop-typing", ({ to }) => {
      try {
        if (!to) return;
        
        io.to(`user:${to}`).emit("stop-typing", {
          from: socket.userId,
        });
      } catch (err) {
        console.error("Stop typing error:", err);
      }
    });

    // ✅ WEBRTC SIGNALING EVENTS - NEW
    socket.on("initiate-call", ({ to, offer }) => {
      try {
        if (!to || !offer) {
          return socket.emit("callError", { error: "Missing to or offer" });
        }

        io.to(`user:${to}`).emit("incoming-call", {
          from: socket.userId,
          fromName: socket.data.userName,
          offer,
        });

        logAudit(socket.userId, "CALL_INITIATED", { to }, socket.id, socket.userRole);
      } catch (err) {
        socket.emit("callError", { error: err.message });
      }
    });

    socket.on("answer-call", ({ to, answer }) => {
      try {
        if (!to || !answer) {
          return socket.emit("callError", { error: "Missing to or answer" });
        }

        io.to(`user:${to}`).emit("call-answered", {
          from: socket.userId,
          answer,
        });

        logAudit(socket.userId, "CALL_ANSWERED", { to }, socket.id, socket.userRole);
      } catch (err) {
        socket.emit("callError", { error: err.message });
      }
    });

    socket.on("ice-candidate", ({ to, candidate }) => {
      try {
        if (!to || !candidate) return;

        io.to(`user:${to}`).emit("ice-candidate", {
          from: socket.userId,
          candidate,
        });
      } catch (err) {
        console.error("ICE candidate error:", err);
      }
    });

    socket.on("call-rejected", ({ to, reason }) => {
      try {
        if (!to) return;

        io.to(`user:${to}`).emit("call-rejected", {
          from: socket.userId,
          reason: reason || "User declined",
        });

        logAudit(socket.userId, "CALL_REJECTED", { to, reason }, socket.id, socket.userRole);
      } catch (err) {
        console.error("Call rejection error:", err);
      }
    });

    socket.on("end-call", ({ to }) => {
      try {
        if (!to) return;

        io.to(`user:${to}`).emit("call-ended", {
          from: socket.userId,
        });

        logAudit(socket.userId, "CALL_ENDED", { to }, socket.id, socket.userRole);
      } catch (err) {
        console.error("End call error:", err);
      }
    });

    // ✅ DISCONNECT - with cleanup
    socket.on("disconnect", (reason) => {
      try {
        // ✅ FIX #1: Leave all rooms (automatic with Socket.IO)
        socket.leaveAll();

        // Broadcast user offline
        io.to("online-users").emit("user-offline", {
          userId: socket.userId,
        });

        logAudit(socket.userId, "SOCKET_DISCONNECT", { reason }, socket.id, socket.userRole);
        console.log(`✅ User ${socket.userId} disconnected (${reason})`);
      } catch (err) {
        console.error("Disconnect error:", err);
      }
    });

    // ✅ Error handler
    socket.on("error", (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  // ✅ Periodic cleanup - 24 hour timeout per socket
  setInterval(() => {
    io.sockets.sockets.forEach((socket) => {
      const connectionTime = Date.now() - socket.handshake.time;
      const maxTime = 24 * 60 * 60 * 1000;

      if (connectionTime > maxTime) {
        socket.disconnect(true);
      }
    });
  }, 60 * 60 * 1000);  // Check every hour

  return io;
}

// ✅ Audit logging helper
async function logAudit(userId, action, details, socketId, userRole) {
  try {
    if (!AuditLog) return;

    await AuditLog.create({
      userId,
      action,
      details: {
        ...details,
        socketId,
        timestamp: new Date(),
      },
      userRole,
    });
  } catch (err) {
    console.error("Audit logging error:", err);
  }
}

export default initSocket;
