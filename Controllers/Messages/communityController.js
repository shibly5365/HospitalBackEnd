import CommunityModel from "../../Models/messages/communitySchema.js";
import conversationModel from "../../Models/messages/conversationSchema.js";
import userModel from "../../Models/User/UserModels.js";

// ✅ Create Community (admin only)
export const createCommunity = async (req, res) => {
  try {
    const {
      name,
      description,
      type = "public",
      isReadOnly = false,
      allowedRoles,
    } = req.body;
    const createdBy = req.user._id;
    const user = await userModel.findById(createdBy);

    // ✅ Only admin can create communities
    if (user.role !== "admin") {
      return res.status(403).json({
        error: "Only admin can create communities",
      });
    }

    // ✅ Create conversation first
    const conversation = await conversationModel.create({
      type: "community",
      name,
      description,
      isReadOnly,
      createdBy,
      admins: [createdBy],
      members: [createdBy],
      visibility: type === "broadcast" ? "restricted" : "public",
    });

    // ✅ Create community
    const community = await CommunityModel.create({
      name,
      description,
      type,
      isReadOnly,
      allowedRoles: allowedRoles || ["patient", "doctor", "admin", "receptionist"],
      createdBy,
      admins: [createdBy],
      members: [createdBy],
      conversation: conversation._id,
    });

    const populated = await community.populate([
      { path: "createdBy", select: "fullName role profileImage" },
      { path: "admins", select: "fullName role profileImage" },
    ]);

    res.json(populated);
  } catch (err) {
    console.error("Create Community Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get All Communities (based on role)
export const getCommunities = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let query = { archived: false };

    // Patients: only show communities they're members of
    if (user.role === "patient") {
      query.members = userId;
    } else {
      // Admin/Doctor/Receptionist: can see all communities
      query = { archived: false };
    }

    const communities = await CommunityModel.find(query)
      .populate("createdBy", "fullName profileImage role")
      .populate("admins", "fullName profileImage")
      .populate("members", "fullName profileImage role")
      .sort({ createdAt: -1 });

    res.json(communities);
  } catch (err) {
    console.error("Get Communities Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Join Community
export const joinCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user._id;
    const user = await userModel.findById(userId);

    const community = await CommunityModel.findById(communityId);

    if (!community) {
      return res.status(404).json({ error: "Community not found" });
    }

    // ✅ Check if role is allowed
    if (!community.allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: "Your role is not allowed in this community",
      });
    }

    // ✅ Check max members
    if (
      community.maxMembers &&
      community.members.length >= community.maxMembers
    ) {
      return res.status(400).json({
        error: "Community is full",
      });
    }

    // ✅ If private, add to member requests
    if (community.type === "private") {
      if (
        !community.memberRequests.some((r) =>
          r.userId.equals(userId)
        )
      ) {
        community.memberRequests.push({ userId });
        await community.save();
      }
      return res.json({
        message: "Join request sent",
        community,
      });
    }

    // ✅ For public communities, add directly
    if (!community.members.includes(userId)) {
      community.members.push(userId);
      await community.save();

      // Add to conversation
      const conversation = await conversationModel.findById(community.conversation);
      if (conversation && !conversation.members.includes(userId)) {
        conversation.members.push(userId);
        await conversation.save();
      }
    }

    const updated = await CommunityModel.findById(communityId).populate([
      { path: "createdBy", select: "fullName profileImage" },
      { path: "admins", select: "fullName profileImage" },
      { path: "members", select: "fullName profileImage role" },
    ]);

    res.json(updated);
  } catch (err) {
    console.error("Join Community Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Leave Community
export const leaveCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user._id;

    const community = await CommunityModel.findById(communityId);

    if (!community) {
      return res.status(404).json({ error: "Community not found" });
    }

    // ✅ Cannot leave if you're the only admin
    const adminCount = community.admins.filter((id) =>
      id.equals(userId)
    ).length;

    if (adminCount > 0 && community.admins.length === 1) {
      return res.status(400).json({
        error: "You must assign another admin before leaving",
      });
    }

    community.members = community.members.filter((id) => !id.equals(userId));
    community.admins = community.admins.filter((id) => !id.equals(userId));
    await community.save();

    // Remove from conversation
    const conversation = await conversationModel.findById(community.conversation);
    if (conversation) {
      conversation.members = conversation.members.filter((id) =>
        !id.equals(userId)
      );
      await conversation.save();
    }

    res.json({ message: "Left community successfully" });
  } catch (err) {
    console.error("Leave Community Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Approve Member Request (admin only)
export const approveMemberRequest = async (req, res) => {
  try {
    const { communityId, userId } = req.params;
    const adminId = req.user._id;

    const community = await CommunityModel.findById(communityId);

    if (!community) {
      return res.status(404).json({ error: "Community not found" });
    }

    // ✅ Check if admin
    if (!community.admins.some((id) => id.equals(adminId))) {
      return res.status(403).json({
        error: "Only admin can approve requests",
      });
    }

    // ✅ Find and remove request
    community.memberRequests = community.memberRequests.filter(
      (r) => !r.userId.equals(userId)
    );

    // ✅ Add member
    if (!community.members.includes(userId)) {
      community.members.push(userId);
    }

    await community.save();

    // Add to conversation
    const conversation = await conversationModel.findById(community.conversation);
    if (conversation && !conversation.members.includes(userId)) {
      conversation.members.push(userId);
      await conversation.save();
    }

    const updated = await CommunityModel.findById(communityId).populate([
      { path: "createdBy", select: "fullName profileImage" },
      { path: "admins", select: "fullName profileImage" },
      { path: "members", select: "fullName profileImage role" },
    ]);

    res.json(updated);
  } catch (err) {
    console.error("Approve Request Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Reject Member Request (admin only)
export const rejectMemberRequest = async (req, res) => {
  try {
    const { communityId, userId } = req.params;
    const adminId = req.user._id;

    const community = await CommunityModel.findById(communityId);

    if (!community) {
      return res.status(404).json({ error: "Community not found" });
    }

    // ✅ Check if admin
    if (!community.admins.some((id) => id.equals(adminId))) {
      return res.status(403).json({
        error: "Only admin can reject requests",
      });
    }

    community.memberRequests = community.memberRequests.filter(
      (r) => !r.userId.equals(userId)
    );

    await community.save();

    res.json(community);
  } catch (err) {
    console.error("Reject Request Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Remove Member from Community (admin only)
export const removeMember = async (req, res) => {
  try {
    const { communityId, userId } = req.params;
    const adminId = req.user._id;

    const community = await CommunityModel.findById(communityId);

    if (!community) {
      return res.status(404).json({ error: "Community not found" });
    }

    // ✅ Check if admin
    if (!community.admins.some((id) => id.equals(adminId))) {
      return res.status(403).json({
        error: "Only admin can remove members",
      });
    }

    community.members = community.members.filter((id) => !id.equals(userId));
    await community.save();

    // Remove from conversation
    const conversation = await conversationModel.findById(community.conversation);
    if (conversation) {
      conversation.members = conversation.members.filter((id) =>
        !id.equals(userId)
      );
      await conversation.save();
    }

    res.json(community);
  } catch (err) {
    console.error("Remove Member Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get Community Details
export const getCommunityDetails = async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user._id;

    const community = await CommunityModel.findById(communityId).populate([
      { path: "createdBy", select: "fullName profileImage role" },
      { path: "admins", select: "fullName profileImage" },
      { path: "members", select: "fullName profileImage role" },
    ]);

    if (!community) {
      return res.status(404).json({ error: "Community not found" });
    }

    // ✅ Check if user is member
    const isMember = community.members.some((m) => m._id.equals(userId));

    res.json({
      community,
      isMember,
    });
  } catch (err) {
    console.error("Get Community Details Error:", err);
    res.status(500).json({ error: err.message });
  }
};
