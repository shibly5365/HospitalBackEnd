import userModel from "../../Models/User/UserModels.js";


export const patientGetProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await userModel.findById(userId).select("-password");

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const patientUpdateProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const updated = await userModel.findByIdAndUpdate(userId, req.body, { new: true }).select(
      "-password"
    );

    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
