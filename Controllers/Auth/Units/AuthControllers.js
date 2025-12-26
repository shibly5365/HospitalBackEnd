import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userModel from "../../../Models/User/UserModels.js";
import cookie from "cookie-parser";
import doctorModel from "../../../Models/Doctor/DoctorModels.js";

export const SignUp = async (req, res) => {
  try {
    const { fullName, email, password, contact, patientType, age, gender } =
      req.body;

    // check user already exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with this email",
        success: false,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // generate OTP and expiry for this request
    const verifyOtp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const verifyOtpExpireAt = new Date(Date.now() + 15 * 60 * 1000); // expires in 15 mins

    // create new user
    const patient = new userModel({
      fullName,
      email,
      password: hashedPassword,
      contact,
      role: "patient", // default role
      patientType,
      age,
      gender,
      verifyOtp,
      verifyOtpExpireAt,
    });

    await patient.save();

    res.status(201).json({
      message: "Signup successful. Please verify your email with the OTP.",
      success: true,
      patient:
        {
        id: patient._id,
        fullName: patient.fullName,
        email: patient.email,
        contact: patient.contact,
        age: patient.age,
        gender: patient.gender,
        patientId: patient.patientId, // safe to include
      },
      
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Email already registered",
        success: false,
      });
    }

    console.error("Signup error:", error);
    res.status(500).json({ message: "Signup failed", success: false });
  }
};

export const Login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const errMsg = "Auth failed: Email or Password is wrong";

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(403).json({ message: errMsg, success: false });
    }

    const isPasswordEqual = await bcrypt.compare(password, user.password);
    if (!isPasswordEqual) {
      return res.status(403).json({ message: errMsg, success: false });
    }

    const jwtToken = jwt.sign(
      { email: user.email, _id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "1d" }
    );

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("token", jwtToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 1000 * 60 * 60 * 24,
    });

    // Build user response
    let userResponse = {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
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

    return res.status(200).json({
      success: true,
      message: "Login success",
      jwtToken,
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

    res.clearCookie("token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
    });

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
