// socket/socket.js

import { Server } from "socket.io";
import MessageModel from "../Models/messages/messages.js";
import userModel from "../Models/User/UserModels.js";
import doctorModel from "../Models/Doctor/DoctorModels.js";
import receptionistModel from "../Models/Receptionist/Receptionist.js";
import Appointment from "../Models/Appointment/Appointment.js";

let io;
const onlineUsers = new Map();

const allowedRoles = {
  patient: ['doctor'],
  doctor: ['patient', 'admin'],
  admin: ['doctor', 'receptionist'],
  receptionist: ['admin'],
};

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {

    // ✅ REGISTER USER
    socket.on("register", (userId) => {
      onlineUsers.set(String(userId), socket.id);
      io.emit("presence-update", Array.from(onlineUsers.keys()));
    });

    // ✅ SEND MESSAGE (LIVE)
    socket.on("sendMessage", async ({ sender, receiver, text }) => {
      try {
        let receiverUser = await userModel.findById(receiver);

        // doctor
        if (!receiverUser) {
          const doctor = await doctorModel.findById(receiver);
          if (doctor) receiverUser = await userModel.findById(doctor.userId);
        }

        // receptionist
        if (!receiverUser) {
          const rec = await receptionistModel.findById(receiver);
          if (rec) receiverUser = await userModel.findById(rec.userId);
        }

        if (!receiverUser) {
          return socket.emit("messageError", { error: "Receiver not found" });
        }

        const senderUser = await userModel.findById(sender);

        // 🚫 ROLE CHECK
        if (!allowedRoles[senderUser.role]?.includes(receiverUser.role)) {
          return socket.emit("messageError", { error: "Not allowed" });
        }

        // 🔒 PATIENT RULE
        if (senderUser.role === "patient" && receiverUser.role === "doctor") {
          const doctorDoc = await doctorModel.findOne({ userId: receiverUser._id });

          const latest = await Appointment.findOne({
            patient: sender,
            doctor: doctorDoc._id,
          }).sort({ appointmentDate: -1 });

          if (!latest) {
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

          // 1. Consultation is active (during time slot OR status is With-Doctor)
          if (latest.status === "With-Doctor" || (now >= start && now <= end)) {
            allowed = true;
          }

          // 2. Allow 24 hours after completion
          if (latest.status === "Completed") {
            const ms24 = 24 * 60 * 60 * 1000;
            const completionDate = latest.completedAt || latest.updatedAt;
            if (now <= new Date(new Date(completionDate).getTime() + ms24)) {
              allowed = true;
            }
          }

          if (!allowed) {
            return socket.emit("messageError", { error: "Chat expired. Only available for 24h after consultation." });
          }
        }

        // 💬 SAVE
        const msg = await MessageModel.create({
          sender,
          receiver: receiverUser._id,
          text,
        });

        const toSocket = onlineUsers.get(String(receiverUser._id));

        if (toSocket) {
          io.to(toSocket).emit("newMessage", msg);
        }

        socket.emit("messageSent", msg);

      } catch (err) {
        socket.emit("messageError", { error: err.message });
      }
    });

    // ✅ TYPING INDICATOR
    socket.on("typing", ({ to, from }) => {
      const toSocket = onlineUsers.get(String(to));
      if (toSocket) {
        io.to(toSocket).emit("typing", { from });
      }
    });

    socket.on("stop-typing", ({ to, from }) => {
      const toSocket = onlineUsers.get(String(to));
      if (toSocket) {
        io.to(toSocket).emit("stop-typing", { from });
      }
    });

    // ✅ DISCONNECT
    socket.on("disconnect", () => {
      for (const [userId, sId] of onlineUsers.entries()) {
        if (sId === socket.id) {
          onlineUsers.delete(userId);
        }
      }
      io.emit("presence-update", Array.from(onlineUsers.keys()));
    });
  });
}