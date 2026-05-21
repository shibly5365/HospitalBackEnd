import express from "express";
import connectDB from "./Config/db.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import http from "http";

// 🔧 NEW: Infrastructure imports
import logger, { logAuthEvent } from "./Config/logger.js";
import { initializeRedis } from "./Config/redis.js";
import { requestLoggingMiddleware, globalErrorHandler } from "./Middleware/errorHandler.js";

import routing from "./Routing/auth/AuthRotuing.js";
import PatientRouting from "./Routing/Patient/Patient.js";
import SuperAdminRouting from "./Routing/SuperAdmin/SuperAdminRouting.js";
import AdminRouting from "./Routing/Admin/AadminRouting.js";
import DoctorRouting from "./Routing/Doctor/DoctorRouiting.js";
import ReceptionistRouting from "./Routing/Receptionist/ReceptionistRouting.js";
import VideoCallRouting from "./Routing/VideoCall/VideoCallRouting.js";
import { initSocket } from "./Sockets/socketServer.js";
import MessageRouter from "./Routing/messages/messages.js";

dotenv.config();

// ✅ Validate required environment variables
const requiredEnvVars = [
  "MONGODB_URL",
  "JWT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "RAZORPAY_KEY_ID",
  "EMAIL",
];
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
});

const app = express();

//CORS configuration - 🔒 Hardened security
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: FRONTEND_URL,
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    methods: ["GET", "POST", "PUT","PATCH", "DELETE", "OPTIONS"],
    maxAge: 600, // 10 minutes
  }),
);

// 🔒 Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// 🔧 Request logging middleware
app.use(requestLoggingMiddleware);

//  API routes
app.use("/api/auth", routing);
app.use("/api/patient", PatientRouting);
app.use("/api/superadmin", SuperAdminRouting);
app.use("/api/admin", AdminRouting);
app.use("/api/doctor", DoctorRouting);
app.use("/api/receptionist", ReceptionistRouting);
app.use("/api", VideoCallRouting);
app.use("/api/message", MessageRouter);

// 🏥 Health check endpoint
app.get("/health", async (req, res) => {
  try {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

//  Connect to MongoDB
await connectDB();

// 🔧 Initialize Redis (optional - app works without it)
await initializeRedis();

// ✅ Create HTTP Server
const server = http.createServer(app);

// ✅ Initialize Socket
const io = initSocket(server);

// ✅ Make io available in controllers
app.set("io", io);

// 🔧 Apply global error handler AFTER all routes
app.use(globalErrorHandler);

// ✅ Start Server
const PORT = process.env.PORT || 4002;

server.listen(PORT,"0.0.0.0", () => {
  logger.info(`✅ Server running on port ${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
});

// Better error handling for common server startup issues
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    logger.error(`❌ Port ${PORT} already in use`);
    console.error(`❌ Port ${PORT} already in use`);
  } else {
    logger.error("❌ Server Error:", err);
    console.error("❌ Server Error:", err);
  }

  process.exit(1);
});

// ✅ Unhandled Promise Rejection
process.on("unhandledRejection", (reason, promise) => {
  logger.error("❌ Unhandled Rejection:", { reason: String(reason) });
  console.error("❌ Unhandled Rejection:", reason);
});
