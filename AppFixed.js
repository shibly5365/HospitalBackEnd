// ✅ FIXED VERSION - Secure Express app with proper middleware

import express from "express";
import connectDB from "./Config/db.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";  // ✅ Added security headers
import rateLimit from "express-rate-limit";  // ✅ Added rate limiting
import dotenv from "dotenv";
import http from "http";

import routing from "./Routing/auth/AuthRotuing.js";
import PatientRouting from "./Routing/Patient/Patient.js";
import SuperAdminRouting from "./Routing/SuperAdmin/SuperAdminRouting.js";
import AdminRouting from "./Routing/Admin/AadminRouting.js";
import DoctorRouting from "./Routing/Doctor/DoctorRouiting.js";
import ReceptionistRouting from "./Routing/Receptionist/ReceptionistRouting.js";
import VideoCallRouting from "./Routing/VideoCall/VideoCallRouting.js";
import { initSocket } from "./Sockets/socketServer.js";

dotenv.config();

// ✅ Validate required environment variables
const requiredEnvVars = [
  'MONGODB_URL',
  'JWT_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'RAZORPAY_KEY_ID',
  'EMAIL',
  'FRONTEND_URL',
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
});

// ✅ FIX #7: Verify JWT_SECRET is strong (minimum 32 characters)
if (process.env.JWT_SECRET.length < 32) {
  console.error("❌ JWT_SECRET too weak. Must be at least 32 characters.");
  console.error("   Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  process.exit(1);
}

const app = express();

// ✅ FIX #3: CORS with specific origin (not wildcard)
const FRONTEND_URL = process.env.FRONTEND_URL;
if (!FRONTEND_URL) {
  console.error("❌ FRONTEND_URL not set in .env");
  process.exit(1);
}

// ✅ Helmet adds security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", FRONTEND_URL],
    },
  },
  hsts: {
    maxAge: 31536000,  // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

// ✅ CORS configuration - specific origin
app.use(
  cors({
    origin: FRONTEND_URL,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,  // ✅ Allow cookies
    maxAge: 3600,  // Preflight cache
  })
);

// ✅ Enforce HTTPS in production
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.header("x-forwarded-proto") !== "https") {
      res.redirect(`https://${req.header("host")}${req.url}`);
    }
    next();
  });
}

// ✅ Rate limiting for login (brute force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,  // 5 attempts
  message: "Too many login attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === "development" && req.ip === "127.0.0.1",
});

// ✅ Rate limiting for signup
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 3,  // 3 signups per hour per IP
  message: "Too many signup attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// ✅ Global rate limiter for all API routes
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,  // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});

// ✅ Body parser with size limits (prevent DoS)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ✅ Apply rate limiting to sensitive endpoints
app.post("/api/auth/login", loginLimiter);
app.post("/api/auth/signup", signupLimiter);

// ✅ Apply global rate limiter to all API routes
app.use("/api/", apiLimiter);

// ✅ Request logging middleware (optional but useful)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// ✅ Global error handler middleware (must be last)
app.use((err, req, res, next) => {
  console.error("🔴 Error:", err.message);
  
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Internal Server Error";
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { error: err.stack }),
  });
});

// ✅ API Routes
app.use("/api/auth", routing);
app.use("/api/patient", PatientRouting);
app.use("/api/superadmin", SuperAdminRouting);
app.use("/api/admin", AdminRouting);
app.use("/api/doctor", DoctorRouting);
app.use("/api/receptionist", ReceptionistRouting);
app.use("/api/", VideoCallRouting);

// ✅ Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date() });
});

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ✅ Connect to MongoDB
connectDB();

// ✅ Start server with Socket.IO
const PORT = process.env.PORT || 4002;
const server = http.createServer(app);

// ✅ Initialize Socket.IO with fixed security
initSocket(server);

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔐 Frontend: ${FRONTEND_URL}`);
});

// ✅ Handle server errors
server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  }
  console.error("❌ Server error:", err);
  process.exit(1);
});

// ✅ Handle unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// ✅ Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

// ✅ Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

export default app;
