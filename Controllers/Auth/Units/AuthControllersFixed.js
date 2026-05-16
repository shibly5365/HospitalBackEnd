// ✅ FIXED VERSION - Secure JWT handling with httpOnly cookies

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userModel from "../../../Models/User/UserModels.js";
import doctorModel from "../../../Models/Doctor/DoctorModels.js";
import { sendOtpEmail } from "../../../Units/sendOtpEmail.js";
import { uploadToCloudinary } from "../../../Units/uploadToCloudinary.js";
import redisClient from "../../../Config/redis.js";  // ✅ Use Redis instead of memory
import AuditLog from "../../../Models/AuditLog/AuditLog.js";

// ✅ FIX #8: Use Redis instead of memory for OTP storage
// const otpStore = {};  // ❌ REMOVED - memory leak + not scalable

export const SignUp = async (req, res) => {
  try {
    const { fullName, email, password, contact, age, gender, role = "patient" } = req.body;

    // ✅ Input validation
    if (!fullName || !email || !password || !contact || !age || !gender) {
      return res.status(400).json({
        message: "All fields are required",
        success: false,
      });
    }

    // ✅ Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Invalid email format",
        success: false,
      });
    }

    // ✅ Check existing user
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
        success: false,
      });
    }

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // ✅ Generate OTP
    const verifyOtp = Math.floor(100000 + Math.random() * 900000).toString();

    let profileImage = "";
    if (req.file) {
      try {
        const result = await uploadToCloudinary(req.file.buffer, "patients");
        profileImage = result.secure_url;
      } catch (err) {
        console.error("Cloudinary error:", err);
        return res.status(500).json({
          message: "Image upload failed",
          success: false,
        });
      }
    }

    if (role === "patient") {
      // ✅ FIX #8: Store OTP in Redis with 15-minute expiry
      await redisClient.setEx(
        `otp:${email}`,
        15 * 60,  // 15 minutes in seconds
        JSON.stringify({
          fullName,
          email,
          password: hashedPassword,
          contact,
          age,
          gender,
          profileImage,
          role,
          verifyOtp,
          createdAt: Date.now(),
        })
      );

      // ✅ Send OTP email
      try {
        await sendOtpEmail(email, verifyOtp);
      } catch (err) {
        console.error("Email send error:", err);
        return res.status(500).json({
          message: "Failed to send OTP email",
          success: false,
        });
      }

      return res.status(200).json({
        message: "OTP sent. Verify to complete signup.",
        success: true,
        email,
      });
    }

    // ✅ Direct registration for non-patient roles
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

    return res.status(201).json({
      message: "Account created successfully",
      success: true,
    });
  } catch (error) {
    console.error("SignUp error:", error);
    return res.status(500).json({
      message: "Signup failed",
      success: false,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const VerifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP required",
        success: false,
      });
    }

    // ✅ FIX #8: Get OTP from Redis
    const tempUserJson = await redisClient.get(`otp:${email}`);

    if (!tempUserJson) {
      return res.status(400).json({
        message: "OTP expired or not found. Please signup again.",
        success: false,
      });
    }

    const tempUser = JSON.parse(tempUserJson);

    // ✅ Verify OTP
    if (tempUser.verifyOtp !== otp) {
      return res.status(400).json({
        message: "Invalid OTP",
        success: false,
      });
    }

    // ✅ Create user in database
    const newUser = new userModel({
      fullName: tempUser.fullName,
      email: tempUser.email,
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

    // ✅ Log user creation
    await logAudit(newUser._id, "USER_CREATED", { role: tempUser.role }, req);

    // ✅ Delete from Redis
    await redisClient.del(`otp:${email}`);

    return res.status(201).json({
      message: "Account created successfully",
      success: true,
    });
  } catch (error) {
    console.error("VerifyOtp error:", error);
    return res.status(500).json({
      message: "Verification failed",
      success: false,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const Login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password required",
        success: false,
      });
    }

    // ✅ Find user
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
        success: false,
      });
    }

    // ✅ Verify email for patients
    if (user.role === "patient" && !user.isAccountVerified) {
      return res.status(403).json({
        message: "Please verify your email before login",
        success: false,
      });
    }

    // ✅ Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      // Log failed attempt
      await logAudit(user._id, "LOGIN_FAILED", { reason: "Invalid password" }, req);
      
      return res.status(401).json({
        message: "Invalid email or password",
        success: false,
      });
    }

    // ✅ FIX #7: Use strong JWT secret (should be in .env, minimum 32 chars)
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      console.error("❌ JWT_SECRET too weak or missing");
      return res.status(500).json({
        message: "Server configuration error",
        success: false,
      });
    }

    // ✅ Create JWT token
    const jwtToken = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "15m" }
    );

    const isProduction = process.env.NODE_ENV === "production";

    // ✅ FIX #2: Use httpOnly cookies instead of localStorage
    res.cookie("token", jwtToken, {
      httpOnly: true,        // ✅ Prevents JS access (no XSS)
      secure: isProduction,  // ✅ HTTPS only in production
      sameSite: "Strict",    // ✅ CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
      path: "/",
    });

    // ✅ Build user response (non-sensitive data only)
    let userResponse = {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      profileImage: user.profileImage,
    };

    // Add role-specific data
    if (user.role === "doctor") {
      const doctor = await doctorModel.findOne({ userId: user._id });
      if (doctor) {
        userResponse.department = doctor.department;
        userResponse.specialization = doctor.specialization;
        userResponse.doctorId = doctor.doctorId;
      }
    }

    // Log successful login
    await logAudit(user._id, "LOGIN_SUCCESS", {}, req);

    // ✅ FIX #2: DON'T send token in response body
    // Token stays in httpOnly cookie, client doesn't need it
    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: userResponse,
      // ❌ REMOVED: jwtToken (keep it in secure cookie)
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "Login failed",
      success: false,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const Logout = async (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === "production";

    // ✅ Clear secure cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "Strict",
      path: "/",
    });

    // Log logout
    if (req.user) {
      await logAudit(req.user._id, "LOGOUT", {}, req);
    }

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fullName, email, contact, dateOfBirth, gender, address } = req.body;

    // ✅ Find user
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found", success: false });
    }

    // ✅ Update fields
    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (contact) user.contact = contact;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (gender) user.gender = gender;
    if (address) user.address = address;

    // ✅ Handle image upload
    if (req.file) {
      try {
        const result = await uploadToCloudinary(req.file.buffer, "profiles");
        user.profileImage = result.secure_url;
      } catch (err) {
        console.error("Image upload error:", err);
        return res.status(500).json({
          message: "Image upload failed",
          success: false,
        });
      }
    }

    await user.save();

    // Log profile update
    await logAudit(userId, "PROFILE_UPDATED", { fields: Object.keys(req.body) }, req);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({
      message: "Profile update failed",
      success: false,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getMe = async (req, res) => {
  try {
    const userId = req.user._id;

    // ✅ Find user
    const user = await userModel.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("getMe error:", error);
    return res.status(500).json({
      message: "Failed to fetch user",
      success: false,
    });
  }
};

// ✅ Audit logging helper
async function logAudit(userId, action, details = {}, req) {
  try {
    if (!AuditLog) return;

    await AuditLog.create({
      userId,
      action,
      details,
      ipAddress: req.ip || "unknown",
      userAgent: req.get("user-agent") || "unknown",
    });
  } catch (err) {
    console.error("Audit logging error:", err);
    // Don't throw - audit logging shouldn't break main functionality
  }
}
