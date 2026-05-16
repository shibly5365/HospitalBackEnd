import conversationModel from "../../Models/messages/conversationSchema.js";
import MessageModel from "../../Models/messages/messages.js";
import userModel from "../../Models/User/UserModels.js";
import { canSendMessage } from "../../Units/chatPermissions.js";

// ✅ Create or Get Conversation
export const getOrCreateConversation = async (req, res) => {
  try {
    const { userId } = req.body;
    const currentUser = req.user._id;

    // ✅ Validate permission
    const permission = await canSendMessage(currentUser, userId);
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.error });
    }

    // ✅ Find existing private chat
    let convo = await conversationModel.findOne({
      type: "private",
      members: {
        $all: [currentUser, userId],
      },
      $expr: {
        $eq: [{ $size: "$members" }, 2],
      },
    });

    // ✅ Create if not exists
    if (!convo) {
      convo = await conversationModel.create({
        type: "private",
        isGroup: false,
        members: [currentUser, userId],
      });
    }

    const populated = await convo.populate(
      "members",
      "fullName role profileImage",
    );
    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get Conversations (filtered by role)
export const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    let query = {
      members: userId,
    };

    // Patients: only show consulted doctors + communities
    if (user.role === "patient") {
      query = {
        $or: [
          {
            type: "private",
            members: userId,
            $expr: {
              $eq: [{ $size: "$members" }, 2],
            },
          },

          {
            type: "community",
            members: userId,
            isReadOnly: false,
          },

          {
            type: "broadcast",
            members: userId,
          },
        ],
      };
    }

    const conversations = await conversationModel
      .find(query)

      // members
      .populate("members", "fullName role profileImage")

      // admins
      .populate("admins", "fullName role profileImage")

      // last message
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "fullName role profileImage",
        },
      })

      // newest first
      .sort({ updatedAt: -1 });
      console.log("CONVERSATIONS FOUND:", conversations);
      console.log("USER ROLE:", user.role);
console.log("USER ID:", userId);
console.log("QUERY:", query);

    res.json(conversations);
  } catch (err) {
    console.error("getConversations Error:", err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// ✅ Send Message
export const sendMessage = async (req, res) => {
  try {
    const {
      conversationId,
      text,
      messageType = "text",
      fileUrl = null,
    } = req.body;
    const sender = req.user._id;

    const convo = await conversationModel
      .findById(conversationId)
      .populate("members");

    if (!convo) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // ✅ Membership check
    if (!convo.members.some((m) => m._id.toString() === sender.toString())) {
      return res.status(403).json({ error: "Not part of this chat" });
    }

    // ✅ Admin-only check
    if (
      convo.adminOnlyMessaging &&
      !convo.admins.some((id) => id.toString() === sender.toString())
    ) {
      return res.status(403).json({
        error: "Only admin can send messages in this group",
      });
    }

    // ✅ Read-only check
    if (convo.isReadOnly) {
      return res.status(403).json({
        error: "This is a read-only community",
      });
    }

    // ✅ Permission check for private chats
    if (convo.type === "private") {
      for (let member of convo.members) {
        if (member._id.toString() === sender.toString()) continue;
        const permission = await canSendMessage(sender, member._id);
        if (!permission.allowed) {
          return res.status(403).json({ error: permission.error });
        }
      }
    }

    // ✅ Validate text for text messages
    if (messageType === "text" && (!text || !text.trim())) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    // ✅ Create message
    const msg = await MessageModel.create({
      sender,
      conversation: conversationId,
      text: text || "",
      messageType,
      fileUrl,
    });
    // ✅ Update last message
    convo.lastMessage = msg._id;
    await convo.save();

    // ✅ Populate sender and return
    const populatedMsg = await MessageModel.findById(msg._id).populate(
      "sender",
      "fullName role profileImage",
    );

    // ✅ Emit to all members
    const io = req.app.get("io");
    io.to(conversationId).emit("newMessage", populatedMsg);

    res.json(populatedMsg);
  } catch (err) {
    console.error("sendMessage Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get Messages
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const currentUser = req.user._id;

    // ✅ Find conversation
    const convo = await conversationModel
      .findById(conversationId)
      .populate("members");

    if (!convo) {
      return res.status(404).json({
        messages: [],
        chatAllowed: false,
        chatError: "Conversation not found",
      });
    }

    // ✅ Permission check
    let permission = { allowed: true, error: "" };

    if (convo.type === "private") {
      const otherMember = convo.members.find(
        (m) => m._id.toString() !== currentUser.toString(),
      );
      if (otherMember?._id) {
        permission = await canSendMessage(currentUser, otherMember._id);
      }
    }

    // ✅ Get messages
    const messages = await MessageModel.find({
      conversation: conversationId,
      isDeleted: false,
    })
      .populate("sender", "fullName role profileImage")
      .sort({ createdAt: 1 });

    return res.json({
      messages,
      chatAllowed: permission.allowed,
      chatError: permission.error || "",
    });
  } catch (err) {
    console.error("getMessages Error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ✅ Mark Message as Read
export const markMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await MessageModel.findByIdAndUpdate(
      messageId,
      {
        $addToSet: {
          readBy: {
            userId,
            readAt: new Date(),
          },
        },
      },
      { new: true },
    );

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Create Group
export const createGroup = async (req, res) => {
  try {
    const { name, description, members, adminOnlyMessaging } = req.body;
    const adminId = req.user._id;

    const group = await conversationModel.create({
      isGroup: true,
      type: "group",
      name,
      description,
      members: [...members, adminId],
      admins: [adminId],
      adminOnlyMessaging,
      createdBy: adminId,
    });

    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Add Member
export const addMember = async (req, res) => {
  try {
    const { conversationId, userId } = req.body;

    const convo = await conversationModel.findById(conversationId);

    if (!convo) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (!convo.admins.some((id) => id.toString() === req.user._id.toString())) {
      return res.status(403).json({
        error: "Only admin can add members",
      });
    }

    if (!convo.members.includes(userId)) {
      convo.members.push(userId);
      await convo.save();
    }

    const updated = await convo.populate(
      "members",
      "fullName role profileImage",
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Remove Member
export const removeMember = async (req, res) => {
  try {
    const { conversationId, userId } = req.body;

    const convo = await conversationModel.findById(conversationId);

    if (!convo) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (!convo.admins.some((id) => id.toString() === req.user._id.toString())) {
      return res.status(403).json({
        error: "Only admin can remove members",
      });
    }

    convo.members = convo.members.filter((id) => id.toString() !== userId);
    await convo.save();

    const updated = await convo.populate(
      "members",
      "fullName role profileImage",
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Edit Message
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    const message = await MessageModel.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if sender is the author
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Can only edit your own messages" });
    }

    // Update message
    message.text = text.trim();
    message.editedAt = new Date();
    await message.save();

    // Populate and return
    const updated = await MessageModel.findById(messageId).populate(
      "sender",
      "fullName role profileImage",
    );

    // Emit edit event
    const io = req.app.get("io");
    io.to(message.conversation).emit("messageEdited", updated);

    res.json(updated);
  } catch (err) {
    console.error("editMessage Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Delete Message (Soft Delete)
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await MessageModel.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if sender is the author
    if (message.sender.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ error: "Can only delete your own messages" });
    }

    // Soft delete
    message.isDeleted = true;
    await message.save();

    // Emit deletion event
    const io = req.app.get("io");
    io.to(message.conversation).emit("messageDeleted", {
      messageId: message._id,
      conversationId: message.conversation,
    });

    res.json({ success: true, message: "Message deleted" });
  } catch (err) {
    console.error("deleteMessage Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Search Users (for admin/doctor to start chats)
export const searchUsers = async (req, res) => {
  try {
    const query = req.query.q;
    const currentUserRole = req.user.role;

    // Role-based search
    let roleFilter = ["doctor", "receptionist"];
    if (currentUserRole === "doctor") {
      roleFilter = ["patient", "admin", "receptionist"];
    } else if (currentUserRole === "admin") {
      roleFilter = ["doctor", "receptionist"];
    }

    const users = await userModel
      .find({
        fullName: { $regex: query, $options: "i" },
        role: { $in: roleFilter },
      })
      .select("fullName role profileImage");

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
