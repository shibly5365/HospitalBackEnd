import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import userModel from "../../Models/User/UserModels.js";

export const ForgetPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User Not Found" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });

    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 15 * 60 * 1000;
    await user.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS,
      },
    });

    const restLink = `http://localhost:5173/reset-password/${token}`;

    await transporter.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: "Password Reset",
      text: `Clikc here to reset Your password ${restLink}`,
    });
    res.json({ message: "Reset link sent to email", });
  } catch (error) {
    console.error("❌ Forgot password error:", error.message);

    res.status(500).json({ message: error.message });
  }
};

export const ResetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await userModel.findOne({
      _id: decoded._id,
      resetToken: token,
      resetTokenExpireAt: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpireAt = null;
    await user.save();
    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("❌ Reset password error:", error.message);

    res.status(400).json({ message: "Invalid or expired token" });
  }
};
