// controllers/messageController.js

import doctorModel from "../../Models/Doctor/DoctorModels.js";
import MessageModel from "../../Models/messages/messages.js";
import receptionistModel from "../../Models/Receptionist/Receptionist.js";
import userModel from "../../Models/User/UserModels.js";
import AppointmentModel from "../../Models/Appointment/Appointment.js";

// ROLE RULES
const allowedRoles = {
  patient: ['doctor'],
  doctor: ['patient', 'admin'],
  admin: ['doctor', 'receptionist'],
  receptionist: ['admin'],
};

// ✅ SEND MESSAGE
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, text, receiverType = "users" } = req.body;

    let actualReceiverId = receiverId;

    // Resolve doctor
    if (receiverType === "doctor") {
      const doctor = await doctorModel.findById(receiverId);
      if (!doctor) return res.status(404).json({ message: "Doctor not found" });
      actualReceiverId = doctor.userId;
    }

    // Resolve receptionist
    if (receiverType === "receptionist") {
      const receptionist = await receptionistModel.findById(receiverId);
      if (!receptionist) return res.status(404).json({ message: "Receptionist not found" });
      actualReceiverId = receptionist.userId;
    }

    const receiver = await userModel.findById(actualReceiverId);
    if (!receiver) return res.status(404).json({ message: "Receiver not found" });

    // 🚫 ROLE CHECK
    if (!allowedRoles[req.user.role]?.includes(receiver.role)) {
      return res.status(403).json({ message: "Not allowed to message this user" });
    }

    // 🔒 PATIENT → DOCTOR RULE
    if (req.user.role === "patient" && receiver.role === "doctor") {
      const doctorDoc = await doctorModel.findOne({ userId: receiver._id });
      if (!doctorDoc) return res.status(404).json({ message: "Doctor not found" });

      const latest = await AppointmentModel.findOne({
        patient: req.user._id,
        doctor: doctorDoc._id,
      }).sort({ appointmentDate: -1, createdAt: -1 });

      if (!latest) {
        return res.status(403).json({
          message: "Book a consultation before messaging doctor",
        });
      }

      const now = new Date();

      const apptDate = new Date(latest.appointmentDate);
      const [sH, sM] = latest.timeSlot.start.split(":").map(Number);
      const [eH, eM] = latest.timeSlot.end.split(":").map(Number);

      const start = new Date(apptDate);
      start.setHours(sH, sM, 0, 0);

      const end = new Date(apptDate);
      end.setHours(eH, eM, 0, 0);

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
        return res.status(403).json({
          message: "Chat expired. Only available for 24h after consultation.",
        });
      }
    }

    // 💬 SAVE MESSAGE
    const message = await MessageModel.create({
      sender: req.user._id,
      receiver: actualReceiverId,
      text,
    });

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ GET CONVERSATION
export const getConversation = async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    const messages = await MessageModel.find({
      $or: [
        { sender: req.user._id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.user._id },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};