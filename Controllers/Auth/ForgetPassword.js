import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import userModel from "../../Models/User/UserModels.js";
import rateLimiterService from "../../Units/rateLimiterService.js";
import redisService from "../../Units/redisService.js";
import logger from "../../Config/logger.js";
import crypto from "crypto";
import Joi from "joi";
import { sendOtpEmail } from "../../Units/sendOtpEmail.js";

export const ForgetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
        success: false,
      });
    }

    // Rate limiting: 3 attempts per hour
    try {
      await rateLimiterService.checkPasswordResetLimit(email);
    } catch (error) {
      logger.warn("Password reset rate limit exceeded", { email });
      return res.status(429).json({
        message: "Too many password reset attempts. Please try again in 1 hour.",
        success: false,
      });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      // Don't reveal if email exists (security best practice)
      logger.info("Password reset requested for non-existent email", { email });
      return res.status(200).json({
        message: "If email exists, reset link has been sent",
        success: true,
      });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Store in Redis: expires in 1 hour
    await redisService.set(
      `passwordReset:${hashedToken}`,
      {
        email,
        userId: user._id,
        expiresAt: Date.now() + 60 * 60 * 1000,
      },
      60 * 60 // 1 hour expiry
    );

    // Build reset link
    const resetLink = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password?token=${resetToken}`;

    // Send email
    await sendOtpEmail(email, `Click here to reset your password: ${resetLink}`);

    logger.info("Password reset requested", { email });

    return res.status(200).json({
      message: "If email exists, reset link has been sent",
      success: true,
    });
  } catch (error) {
    logger.error("Forget password error", { error: error.message });
    return res.status(500).json({
      message: "Password reset failed",
      success: false,
    });
  }
};

export const ResetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        message: "Token and new password required",
        success: false,
      });
    }

    // Hash the token (must match what was stored)
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Retrieve from Redis
    const resetData = await redisService.get(`passwordReset:${hashedToken}`);

    if (!resetData) {
      logger.warn("Invalid password reset token", { tokenHash: hashedToken });
      return res.status(400).json({
        message: "Invalid or expired reset link",
        success: false,
      });
    }

    // Validate password strength
    const passwordSchema = Joi.string()
      .min(12)
      .pattern(/[A-Z]/, "uppercase")
      .pattern(/[a-z]/, "lowercase")
      .pattern(/[0-9]/, "number")
      .pattern(/[!@#$%^&*(),.?":{}|<>]/, "special character")
      .required();

    const { error } = passwordSchema.validate(newPassword);
    if (error) {
      return res.status(400).json({
        message:
          "Password must have: min 12 chars, uppercase, lowercase, number, special character",
        success: false,
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user
    const user = await userModel.findByIdAndUpdate(
      resetData.userId,
      { password: hashedPassword },
      { new: true }
    );

    // Invalidate the reset token
    await redisService.delete(`passwordReset:${hashedToken}`);

    // Optional: Invalidate all active sessions (force re-login)
    await redisService.delete(`refreshToken:${user._id}`);

    logger.info("Password reset successful", {
      userId: user._id,
      email: resetData.email,
    });

    return res.status(200).json({
      message: "Password reset successful. Please login with new password.",
      success: true,
    });
  } catch (error) {
    logger.error("Reset password error", { error: error.message });
    return res.status(500).json({
      message: "Password reset failed",
      success: false,
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await userModel.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();

    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};