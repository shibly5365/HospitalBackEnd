
import logger from "../../Config/logger.js";
import userModel from "../../Models/User/UserModels.js";

// =================================================
// Toggle User Status Controller
// =================================================
export const toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    if (user.role === "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Superadmin cannot be modified",
      });
    }
    user.isActive = !user.isActive;
    if (user.isActive) {
      user.accountStatus = "active";
      user.blockedAt = null;
      user.blockedReason = "";
    } else {
      user.accountStatus = "inactive";
      user.blockedAt = new Date();
      user.blockedReason = reason || "Disabled by admin";
    }
    await user.save();

    logger.info("User status changed", {
      userId: user._id,
      role: user.role,
      status: user.accountStatus,
    });
    return res.status(200).json({
      success: true,
      message: `User ${
        user.isActive ? "activated" : "deactivated"
      } successfully`,

      data: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,

        isActive: user.isActive,

        accountStatus: user.accountStatus,

        blockedAt: user.blockedAt,

        blockedReason: user.blockedReason,
      },
    });
  } catch (error) {
    console.error("Toggle User Status Error:", error);

    logger.error("Toggle User Status Error", {
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
