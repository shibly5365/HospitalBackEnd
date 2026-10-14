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
import { OAuth2Client } from "google-auth-library";



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

    // Validate required fields
    if (!fullName?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        message: "Full name, email, and password are required",
        success: false,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if the user already exists
    const existingUser = await userModel.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
        success: false,
      });
    }

    // Validate password
    const { error } = Joi.string()
      .min(8)
      .required()
      .validate(password);

    if (error) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
        success: false,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let profileImage = "";

    if (req.file) {
      const result = await uploadToCloudinary(
        req.file.buffer,
        "patients"
      );

      profileImage = result.secure_url;
    }

    // Patient signup requires OTP verification
    if (role === "patient") {
      const verifyOtp = Math.floor(
        100000 + Math.random() * 900000
      ).toString();

      const verifyOtpExpireAt = Date.now() + 15 * 60 * 1000;

      const otpData = {
        fullName: fullName.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        contact,
        age,
        gender,
        profileImage,
        role,
        verifyOtp,
        verifyOtpExpireAt,
      };

      const key = `signup:${normalizedEmail}`;

      // Save pending signup to Redis for 15 minutes
      const saved = await redisService.set(
        key,
        otpData,
        15 * 60
      );

      if (!saved) {
        logger.error("Failed to save pending signup in Redis", {
          email: normalizedEmail,
        });

        return res.status(503).json({
          message:
            "Signup service is unavailable. Please try again later.",
          success: false,
        });
      }

      // Send OTP only after Redis save succeeds
      try {
        await sendOtpEmail(normalizedEmail, verifyOtp);
      } catch (emailError) {
        await redisService.delete(key);

        logger.error("Failed to send signup OTP", {
          email: normalizedEmail,
          error: emailError.message,
        });

        return res.status(500).json({
          message: "Unable to send OTP. Please try again.",
          success: false,
        });
      }

      logger.info("Pending signup saved in Redis", {
        email: normalizedEmail,
      });

      return res.status(200).json({
        message: "OTP sent. Verify to complete signup.",
        success: true,
        email: normalizedEmail,
      });
    }

    // Other roles: preserve your original direct-registration flow
    const newUser = new userModel({
      fullName: fullName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      contact,
      age,
      gender,
      profileImage,
      role,
      isAccountVerified: true,
    });

    await newUser.save();

    return res.status(201).json({
      message: "Account created successfully",
      success: true,
    });
  } catch (error) {
    logger.error("Signup error", {
      error: error.message,
      email: req.body.email,
    });

    return res.status(500).json({
      message: "Signup failed",
      success: false,
    });
  }
};


export const VerifyOtp = async (req, res) => {
  try {
    const normalizedEmail = req.body.email
      ?.trim()
      .toLowerCase();

    const otp = String(req.body.otp ?? "").trim();

    if (!normalizedEmail || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required",
        success: false,
      });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message: "Please enter a valid 6-digit OTP",
        success: false,
      });
    }

    const key = `signup:${normalizedEmail}`;

    // Retrieve pending signup from the same Redis key
    const tempUser = await redisService.get(key);

    if (!tempUser) {
      logger.warn("Pending signup not found in Redis", {
        email: normalizedEmail,
      });

      return res.status(400).json({
        message: "No signup request found. Please sign up again.",
        success: false,
      });
    }

    // Check OTP
    if (String(tempUser.verifyOtp) !== otp) {
      return res.status(400).json({
        message: "Invalid OTP",
        success: false,
      });
    }

    // Check OTP expiration
    if (
      !tempUser.verifyOtpExpireAt ||
      Number(tempUser.verifyOtpExpireAt) < Date.now()
    ) {
      await redisService.delete(key);

      return res.status(400).json({
        message: "OTP expired. Please sign up again.",
        success: false,
      });
    }

    // Prevent duplicate account creation
    const existingUser = await userModel.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      await redisService.delete(key);

      return res.status(400).json({
        message: "User already exists. Please log in.",
        success: false,
      });
    }

    // Create the verified patient account
    const newUser = new userModel({
      fullName: tempUser.fullName,
      email: normalizedEmail,
      password: tempUser.password,
      contact: tempUser.contact,
      age: tempUser.age,
      gender: tempUser.gender,
      profileImage: tempUser.profileImage,
      role: tempUser.role,
      patientType: "New Patient",
      isAccountVerified: true,
    });

    await newUser.save();

    // Remove pending signup after successful account creation
    await redisService.delete(key);

    logger.info("User verified OTP and account created", {
      email: normalizedEmail,
    });

    return res.status(201).json({
      message: "Account created successfully",
      success: true,
    });
  } catch (error) {
    logger.error("OTP verification error", {
      error: error.message,
      email: req.body.email,
    });

    return res.status(500).json({
      message: "Verification failed",
      success: false,
    });
  }
};


export const Login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email);
    console.log(password);

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
    console.log(user);

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
    console.error("FULL LOGIN ERROR:", err);

    return res.status(500).json({
      message: err.message,
      stack: err.stack,
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
      sameSite: isProduction ? "none" : "lax",
    });

    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
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
      sameSite: isProduction ? "none" : "Lax",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", newTokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "Lax",
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
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const { sub, email, name, picture, email_verified } = payload;

    let user = await userModel.findOne({ email });

    if (!user) {
      user = await userModel.create({
        fullName: name,
        email,
        googleId: sub,
        profileImage: picture,
        role: "patient",
        contact: "Not Provided",
        patientType: "New Patient",
        isAccountVerified: email_verified,
      });
    }

    const jwtToken = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    return res.status(200).json({
      success: true,
      user,
      jwtToken,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Google login failed",
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
