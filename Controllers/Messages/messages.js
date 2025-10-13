import doctorModel from "../../Models/Doctor/DoctorModels.js";
import MessageModel from "../../Models/messages/messages.js";
import receptionistModel from "../../Models/Receptionist/Receptionist.js";
import userModel from "../../Models/User/UserModels.js";

// Send message
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, text, receiverType = "users" } = req.body;
    let actualReceiverId = receiverId;
    // console.log(receiverId);
    // console.log(receiverType);

    // Map doctor or receptionist ID to userId
    if (receiverType === "doctor") {
      const doctor = await doctorModel.findById(receiverId);
      // console.log(doctor);

      if (!doctor) return res.status(404).json({ message: "Doctor not found" });
      actualReceiverId = doctor.userId;
    }
    if (receiverType === "receptionist") {
      const receptionist = await receptionistModel.findById(receiverId);
      if (!receptionist)
        return res.status(404).json({ message: "Receptionist not found" });
      actualReceiverId = receptionist.userId;
    }

    const receiver = await userModel.findById(actualReceiverId);
    if (!receiver)
      return res.status(404).json({ message: "Receiver user not found" });

    const allowedRoles = {
      superAdmin: ["admin", "doctor", "receptionist"],
      admin: ["doctor", "receptionist"],
      doctor: ["admin", "receptionist", "patient"],
      receptionist: ["doctor", "patient"],
      patient: ["doctor", "receptionist"],
    };

    if (!allowedRoles[req.user.role].includes(receiver.role)) {
      return res.status(403).json({ message: "You cannot message this user" });
    }

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
