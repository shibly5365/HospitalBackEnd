import { Server } from 'socket.io';
import MessageModel from '../Models/messages/messages.js';
import userModel from '../Models/User/UserModels.js';
import doctorModel from '../Models/Doctor/DoctorModels.js';
import receptionistModel from '../Models/Receptionist/Receptionist.js';
import Appointment from '../Models/Appointment/Appointment.js';

let io;
const onlineUsers = new Map(); // userId => socketId

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    // Register presence: client should emit 'register' with their userId
    socket.on('register', (userId) => {
      onlineUsers.set(String(userId), socket.id);
      io.emit('presence-update', Array.from(onlineUsers.keys()));
    });

    socket.on('sendMessage', async (payload) => {
      // payload: { sender, receiver, text }
      try {
        // Resolve receiver: payload.receiver might be a userId, doctorId, or receptionistId
        let actualReceiverUserId = null;
        let receiverUser = await userModel.findById(payload.receiver);

        if (receiverUser) {
          actualReceiverUserId = receiverUser._id;
        } else {
          // try doctor
          const doctorDoc = await doctorModel.findById(payload.receiver);
          if (doctorDoc) {
            actualReceiverUserId = doctorDoc.userId;
            receiverUser = await userModel.findById(actualReceiverUserId);
          } else {
            // try receptionist
            const recept = await receptionistModel.findById(payload.receiver);
            if (recept) {
              actualReceiverUserId = recept.userId;
              receiverUser = await userModel.findById(actualReceiverUserId);
            }
          }
        }

        if (!actualReceiverUserId || !receiverUser) return socket.emit('messageError', { error: 'Receiver not found' });

        const senderUser = await userModel.findById(payload.sender);
        if (!senderUser) return socket.emit('messageError', { error: 'Sender not found' });

        // Role-based allowed matrix
        const allowedRoles = {
          superadmin: ['admin', 'doctor', 'receptionist'],
          admin: ['doctor', 'receptionist'],
          doctor: ['admin', 'patient'],
          receptionist: ['patient', 'admin'],
          patient: ['doctor', 'receptionist'],
        };

        if (!allowedRoles[senderUser.role]?.includes(receiverUser.role)) {
          return socket.emit('messageError', { error: 'You are not allowed to message this user' });
        }

        // Additional rule: if sender is a patient messaging a doctor, allow only during consultation
        // or within 24 hours after consultation end.
        if (senderUser.role === 'patient' && receiverUser.role === 'doctor') {
          const doctorDoc = await doctorModel.findOne({ userId: receiverUser._id });
          if (!doctorDoc) return socket.emit('messageError', { error: 'Doctor not found' });

          const latest = await Appointment.findOne({ patient: payload.sender, doctor: doctorDoc._id }).sort({ appointmentDate: -1, createdAt: -1 });
          const now = new Date();
          let allowed = false;
          if (latest) {
            try {
              const apptDate = new Date(latest.appointmentDate);
              const [sH, sM] = latest.timeSlot.start.split(':').map(Number);
              const [eH, eM] = latest.timeSlot.end.split(':').map(Number);
              const start = new Date(apptDate);
              start.setHours(sH, sM, 0, 0);
              const end = new Date(apptDate);
              end.setHours(eH, eM, 0, 0);
              if (latest.status === 'With-Doctor' || (now >= start && now <= end)) allowed = true;
              const ms24 = 24 * 60 * 60 * 1000;
              if (now >= end && now <= new Date(end.getTime() + ms24)) allowed = true;
            } catch (e) {
              allowed = false;
            }
          }
          if (!allowed) return socket.emit('messageError', { error: 'Messaging allowed only during consultation or within 24 hours after it.' });
        }

        // Persist message
        const msg = await MessageModel.create({ sender: payload.sender, receiver: actualReceiverUserId, text: payload.text });

        const toSocket = onlineUsers.get(String(actualReceiverUserId));
        if (toSocket) {
          io.to(toSocket).emit('newMessage', msg);
        }

        // ack back to sender
        socket.emit('messageSent', msg);
      } catch (e) {
        socket.emit('messageError', { error: e.message });
      }
    });

    // WebRTC signaling for video calls
    socket.on('call-user', ({ to, offer, from }) => {
      const toSocket = onlineUsers.get(String(to));
      if (toSocket) {
        io.to(toSocket).emit('incoming-call', { from, offer });
      } else {
        socket.emit('call-failed', { reason: 'User offline' });
      }
    });

    socket.on('answer-call', ({ to, answer }) => {
      const toSocket = onlineUsers.get(String(to));
      if (toSocket) io.to(toSocket).emit('call-answered', { answer });
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
      const toSocket = onlineUsers.get(String(to));
      if (toSocket) io.to(toSocket).emit('ice-candidate', { candidate });
    });

    socket.on('end-call', ({ to }) => {
      const toSocket = onlineUsers.get(String(to));
      if (toSocket) io.to(toSocket).emit('call-ended');
    });

    socket.on('disconnect', () => {
      // remove from onlineUsers
      for (const [userId, sId] of onlineUsers.entries()) {
        if (sId === socket.id) onlineUsers.delete(userId);
      }
      io.emit('presence-update', Array.from(onlineUsers.keys()));
    });
  });
}

export function getOnlineUsers() {
  return Array.from(onlineUsers.keys());
}
