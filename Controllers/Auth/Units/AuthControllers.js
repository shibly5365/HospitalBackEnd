import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Joi from "joi";
import userModel from "../../../Models/User/UserModels.js";
import cookie from "cookie-parser";
import doctorModel from "../../../Models/Doctor/DoctorModels.js";
import { sendOtpEmail } from "../../../Units/sendOtpEmail.js";
import { uploadToCloudinary } from "../../../Units/uploadToCloudinary.js";
import rateLimiterService from "../../../Units/rateLimiterService.js";
import tokenService from "../../../Units/tokenService.js";
import redisService from "../../../Units/redisService.js";
import {
  ValidationError,
  AuthenticationError,
} from "../../../Units/ApiError.js";
import logger from "../../../Config/logger.js";

export const SignUp = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      contact,
      age,
      gender,
      role = "patient",
    } = req.body;

    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
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

    const { error } = passwordSchema.validate(password);
    if (error) {
      logger.warn("Weak password attempt", { email });
      return res.status(400).json({
        message: `Password must have: min 12 chars, uppercase, lowercase, number, special character`,
        success: false,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const verifyOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const verifyOtpExpireAt = Date.now() + 15 * 60 * 1000;

    let profileImage = "";
    if (req.file) {
      try {
        const result = await uploadToCloudinary(req.file.buffer, "patients");
        profileImage = result.secure_url;
      } catch (err) {
        console.error("CLOUDINARY ERROR:", err);
        throw err;
      }
    }

    // 🔥 STORE TEMP DATA (NOT DB)
    if (role === "patient") {
      const verifyOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const verifyOtpExpireAt = Date.now() + 15 * 60 * 1000;

      // Store OTP in Redis (expires after 15 minutes)
      const otpData = {
        fullName,
        email,
        password: hashedPassword,
        contact,
        age,
        gender,
        profileImage,
        role,
        verifyOtp,
        verifyOtpExpireAt,
      };
      await redisService.set(`signup:${email}`, otpData, 15 * 60);

      await sendOtpEmail(email, verifyOtp);

      return res.status(200).json({
        message: "OTP sent. Verify to complete signup.",
        success: true,
        email,
      });
    }

    // ✅ 🔥 OTHER ROLES → DIRECT REGISTER
    const newUser = new userModel({
      fullName,
      email,
      password: hashedPassword,
      contact,
      age,
      gender,
      profileImage,
      role,
      isAccountVerified: true,
    });

    await newUser.save();

    res.status(201).json({
      message: "Account created successfully",
      success: true,
    });
  } catch (error) {
    logger.error("Signup error", {
      error: error.message,
      email: req.body.email,
    });
    res.status(500).json({
      message: "Signup failed",
      success: false,
    });
  }
};
export const VerifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const tempUser = await redisService.get(`signup:${email}`);

    if (!tempUser) {
      return res.status(400).json({
        message: "No signup request found",
        success: false,
      });
    }

    if (tempUser.verifyOtp !== otp) {
      return res.status(400).json({
        message: "Invalid OTP",
        success: false,
      });
    }

    if (tempUser.verifyOtpExpireAt < Date.now()) {
      return res.status(400).json({
        message: "OTP expired",
        success: false,
      });
    }

    logger.info("User verified OTP", { email });

    // ✅ NOW SAVE TO DB
    const newUser = new userModel({
      fullName: tempUser.fullName,
      email: tempUser.email,
      password: tempUser.password,
      contact: tempUser.contact,
      age: tempUser.age,
      gender: tempUser.gender,
      profileImage: tempUser.profileImage,
      role: tempUser.role, // 🔥 dynamic
      patientType: "New Patient",
      isAccountVerified: true,
    });

    await newUser.save();

    // 🔥 CLEANUP
    await redisService.delete(`signup:${email}`);

    res.status(201).json({
      message: "Account created successfully",
      success: true,
    });
  } catch (error) {
    logger.error("OTP verification error", {
      error: error.message,
      email: req.body.email,
    });
    res.status(500).json({
      message: "Verification failed",
      success: false,
    });
  }
};

export const Login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const errMsg = "Auth failed: Email or Password is wrong";

    // Check rate limit
    try {
      await rateLimiterService.checkAuthLimit(email);
    } catch (error) {
      logger.warn("Login rate limit exceeded", { email });
      return res.status(429).json({
        message: "Too many login attempts. Please try again in 15 minutes.",
        success: false,
      });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      logger.warn("Login attempt with non-existent email", { email });
      return res.status(403).json({ message: errMsg, success: false });
    }
    if (!user.isActive || user.accountStatus !== "active") {
      logger.warn("Blocked login attempt", {
        userId: user._id,
        status: user.accountStatus,
      });

      return res.status(403).json({
        success: false,
        message: `Account ${user.accountStatus}`,
      });
    }

    if (user.role === "patient" && !user.isAccountVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before login",
      });
    }
    if (!user.password) {
      return res.status(403).json({
        success: false,
        message: "Password login not available for this account",
      });
    }

    const isPasswordEqual = await bcrypt.compare(password, user.password);

    if (!isPasswordEqual) {
      logger.warn("Invalid password attempt", {
        email,
      });

      return res.status(401).json({
        success: false,
        message: errMsg,
      });
    }

    // Use TokenService for both access and refresh tokens
    const tokens = tokenService.generateTokens({
      email: user.email,
      userId: user._id,
      role: user.role,
    });

    // Also generate old jwtToken for backward compatibility
    const jwtToken = jwt.sign(
      { email: user.email, _id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "1d" },
    );

    // Store refresh token in Redis for revocation capability
    await redisService.set(
      `refreshToken:${user._id}`,
      { token: tokens.refreshToken },
      7 * 24 * 60 * 60,
    );

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("accessToken", tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie("token", jwtToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24,
    });

    // Build user response
    let userResponse = {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      profileImage: user.profileImage,
    };

    // If doctor, include department and specialization
    if (user.role === "doctor") {
      const doctor = await doctorModel.findOne({ userId: user._id });
      if (doctor) {
        userResponse.department = doctor.department;
        userResponse.specialization = doctor.specialization;
      }
    }
    if (user.role === "receptionist") {
      userResponse.employeeId = user.employeeId; // <-- make sure this field exists in User schema
    }
    user.lastLoginAt = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Login success",
      jwtToken, // For backward compatibility
      accessToken: tokens.accessToken, // New
      refreshToken: tokens.refreshToken, // New
      user: userResponse,
    });
  } catch (err) {
    console.error("Login Error:", err.message);
    return res.status(500).json({
      message: "Internal login error",
      success: false,
    });
  }
};

export const Logout = async (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === "production";

    // Clear all token cookies
    res.clearCookie("token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
    });

    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "Strict",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "Strict",
    });

    // Invalidate refresh token in Redis
    if (req.user && req.user.id) {
      await redisService.delete(`refreshToken:${req.user.id}`);
    }

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (err) {
    console.error("Logout Error:", err);
    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const { fullName, email, contact, dateOfBirth, gender, address } = req.body;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Update fields
    user.fullName = fullName || user.fullName;
    user.email = email || user.email;
    user.contact = contact || user.contact;
    user.dateOfBirth = dateOfBirth || user.dateOfBirth;
    user.gender = gender || user.gender;
    user.address = address || user.address;

    // ✅ FIXED IMAGE (IMPORTANT)
    if (req.file) {
      try {
        const result = await uploadToCloudinary(req.file.buffer, "patients");

        user.profileImage = result.secure_url; // ✅ FINAL FIX
      } catch (err) {
        console.error("CLOUDINARY ERROR:", err);
        return res.status(500).json({ message: "Image upload failed" });
      }
    }

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const RefreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        message: "Refresh token required",
        success: false,
      });
    }

    // Verify the refresh token
    let payload;
    try {
      payload = tokenService.verifyRefreshToken(refreshToken);
    } catch (error) {
      logger.warn("Token verification failed", { error: error.message });
      return res.status(401).json({
        message: "Invalid or expired refresh token",
        success: false,
      });
    }

    if (!payload) {
      return res.status(401).json({
        message: "Invalid or expired refresh token",
        success: false,
      });
    }

    // Check if token is still valid in Redis
    const storedToken = await redisService.get(
      `refreshToken:${payload.userId}`,
    );
    if (!storedToken || storedToken.token !== refreshToken) {
      return res.status(401).json({
        message: "Refresh token has been revoked",
        success: false,
      });
    }

    // Generate new tokens
    const newTokens = tokenService.generateTokens({
      email: payload.email,
      userId: payload.userId,
      role: payload.role,
    });

    // Update refresh token in Redis
    await redisService.set(
      `refreshToken:${payload.userId}`,
      { token: newTokens.refreshToken },
      7 * 24 * 60 * 60,
    );

    const isProduction = process.env.NODE_ENV === "production";

    // Set new token cookies
    res.cookie("accessToken", newTokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", newTokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    logger.info("Token refreshed successfully", { userId: payload.userId });

    return res.status(200).json({
      success: true,
      message: "Token refreshed",
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
    });
  } catch (error) {
    logger.error("Token refresh failed", { error: error.message });
    return res.status(500).json({
      message: "Token refresh failed",
      success: false,
    });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);

    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
