import express from "express";
import { LoginValidation } from "../../Middleware/AuthValidaction.js";
import {
  ForgetPassword,
  ResetPassword,
} from "../../Controllers/Auth/ForgetPassword.js";
import {
  getMe,
  Login,
  Logout,
  updateProfile,
  RefreshToken,
} from "../../Controllers/Auth/Units/AuthControllers.js";
import { AuthMiddleware } from "../../Middleware/AuthMiddleware.js";
import { upload } from "../../Config/multer.js";
import rateLimiterService from "../../Units/rateLimiterService.js";
import { asyncHandler } from "../../Units/asyncHandler.js";

const routing = express.Router();

// Rate limiting middleware for auth endpoints
const checkAuthLimit = asyncHandler(async (req, res, next) => {
  const email = req.body.email;
  if (email) {
    await rateLimiterService.checkAuthLimit(email);
  }
  next();
});

const checkOtpLimit = asyncHandler(async (req, res, next) => {
  const email = req.body.email;
  if (email) {
    await rateLimiterService.checkOtpLimit(email);
  }
  next();
});

const checkPasswordResetLimit = asyncHandler(async (req, res, next) => {
  const email = req.body.email;
  if (email) {
    await rateLimiterService.checkPasswordResetLimit(email);
  }
  next();
});

routing.post("/login", checkAuthLimit, LoginValidation, Login);
routing.post("/logout", Logout);
routing.post("/refresh-token", RefreshToken);
routing.get("/me", AuthMiddleware(["admin", "patient", "doctor","receptionist"]), getMe);
routing.put(
  "/update-profile",
  AuthMiddleware(["admin", "patient", "doctor"]),
  upload.single("profileImage"),
  updateProfile,
);

routing.post("/forgot-password", ForgetPassword);
routing.post("/reset-password", ResetPassword);

export default routing;
