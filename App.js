import express from "express";
import connectDB from "./Config/db.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import http from "http";

import routing from "./Routing/auth/AuthRotuing.js";
import PatientRouting from "./Routing/Patient/Patient.js";
import SuperAdminRouting from "./Routing/SuperAdmin/SuperAdminRouting.js";
import AdminRouting from "./Routing/Admin/AadminRouting.js";
import DoctorRouting  from "./Routing/Doctor/DoctorRouiting.js"
import ReceptionistRouting from "./Routing/Receptionist/ReceptionistRouting.js";
import VideoCallRouting from "./Routing/VideoCall/VideoCallRouting.js";
import { initSocket } from "./Sockets/socketServer.js";

dotenv.config();

// ✅ Validate required environment variables
const requiredEnvVars = ['MONGODB_URL', 'JWT_SECRET', 'CLOUDINARY_CLOUD_NAME', 'RAZORPAY_KEY_ID', 'EMAIL'];
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
});

const app = express();

//CORS configuration
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: FRONTEND_URL,
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ❌ Global error handler middleware
app.use((err, req, res, next) => {
  console.error("🔴 Global Error:", err.message);
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { error: err.stack })
  });
});

//  API routes
app.use("/api/auth", routing);
app.use("/api/patient", PatientRouting);
app.use("/api/superadmin", SuperAdminRouting);
app.use("/api/admin", AdminRouting);
app.use("/api/doctor", DoctorRouting);
app.use("/api/receptionist", ReceptionistRouting);
app.use("/api", VideoCallRouting);

//  Connect to MongoDB
connectDB();

//  Start server with Socket.IO
const PORT = process.env.PORT || 4002;
const server = http.createServer(app);
initSocket(server);
server.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Better error handling for common server startup issues
server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use. Set a different PORT in your .env or stop the process using it.`);
    process.exit(1);
  }
  console.error("❌ Server error:", err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
