import doctorModel from "../../Models/Doctor/DoctorModels.js";
import MessageModel from "../../Models/messages/messages.js";
import receptionistModel from "../../Models/Receptionist/Receptionist.js";
import userModel from "../../Models/User/UserModels.js";

// Send message
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, text, receiverType = 'users' } = req.body;
    console.log(receiverId);

    // Determine actual user ID of receiver
    let actualReceiverId = receiverId;

    if (receiverType === 'doctor') {
      const doctor = await doctorModel.findOne({ userId: receiverId });
      if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
      actualReceiverId = doctor.userId;
    }

    if (receiverType === 'receptionist') {
      const receptionist = await receptionistModel.findOne({ userId: receiverId });
      if (!receptionist)
        return res.status(404).json({ message: 'Receptionist not found' });
      actualReceiverId = receptionist.userId;
    }

    console.log(actualReceiverId);

    // Find the receiver user
    const receiver = await userModel.findById(actualReceiverId);
    if (!receiver)
      return res.status(404).json({ message: 'Receiver user not found' });

    // Define allowed roles
    const allowedRoles = {
      superadmin: ['admin', 'doctor', 'receptionist'],
      admin: ['doctor', 'receptionist'],
      doctor: ['admin', 'patient'],
      receptionist: ['patient', 'admin'],
      patient: ['doctor', 'receptionist'],
    };

    // Check if sender can message receiver
    if (!allowedRoles[req.user.role]?.includes(receiver.role)) {
      return res.status(403).json({ message: 'You cannot message this user' });
    }

    // Additional rule: patient messaging doctor
    if (req.user.role === 'patient' && receiver.role === 'doctor') {
      const doctorDoc = await doctorModel.findOne({ userId: receiver._id });
      if (!doctorDoc) return res.status(404).json({ message: 'Doctor not found' });

      const latest = await AppointmentModel.findOne({
        patient: req.user._id,
        doctor: doctorDoc._id,
      }).sort({ appointmentDate: -1, createdAt: -1 });

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
        } catch {
          allowed = false;
        }
      }

      if (!allowed) {
        return res.status(403).json({
          message:
            'Messaging this doctor is allowed only during consultation or within 24 hours after it.',
        });
      }
    }

    // Create the message
    const message = await MessageModel.create({
      sender: req.user._id,
      receiver: actualReceiverId,
      text,
    });

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
