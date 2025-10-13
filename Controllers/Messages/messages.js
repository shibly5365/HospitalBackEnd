import doctorModel from "../../Models/Doctor/DoctorModels.js";
import MessageModel from "../../Models/messages/messages.js";
import receptionistModel from "../../Models/Receptionist/Receptionist.js";
import userModel from "../../Models/User/UserModels.js";

// Send message
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, text, receiverType = 'users' } = req.body;

    // Determine actual user ID of receiver
    let actualReceiverId = receiverId;

    if (receiverType === 'doctor') {
      const doctor = await doctorModel.findById(receiverId);
      if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
      actualReceiverId = doctor.userId;
    }

    if (receiverType === 'receptionist') {
      const receptionist = await receptionistModel.findById(receiverId);
      if (!receptionist)
        return res.status(404).json({ message: 'Receptionist not found' });
      actualReceiverId = receptionist.userId;
    }

    // Find the receiver user
    const receiver = await userModel.findById(actualReceiverId);
    if (!receiver)
      return res.status(404).json({ message: 'Receiver user not found' });

    // Define which roles can message which roles
    const allowedRoles = {
      superAdmin: ['admin', 'doctor', 'receptionist'],
      admin: ['doctor', 'receptionist', 'superAdmin'],
      doctor: ['admin', 'receptionist', 'patient'],
      receptionist: ['doctor', 'patient'],
      patient: ['doctor', 'receptionist'],
    };

    // Check if sender can message receiver
    if (!allowedRoles[req.user.role]?.includes(receiver.role)) {
      return res.status(403).json({ message: 'You cannot message this user' });
    }

    // Create the message
    const message = await MessageModel.create({
      sender: req.user._id,
      receiver: actualReceiverId,
      text,
    });

    // Return the created message
    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};


// Get conversation
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
