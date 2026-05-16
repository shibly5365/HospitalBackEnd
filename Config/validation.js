import Joi from "joi";

/**
 * Centralized Joi validation schemas
 * Reusable across controllers and middleware
 */

export const authSchemas = {
  // Signup validation
  signup: Joi.object({
    fullName: Joi.string().min(3).max(50).required().trim().messages({
      "string.empty": "Full name is required",
      "string.min": "Full name must be at least 3 characters",
      "string.max": "Full name cannot exceed 50 characters",
    }),
    email: Joi.string().email().required().lowercase().messages({
      "string.email": "Please provide a valid email",
      "string.empty": "Email is required",
    }),
    password: Joi.string()
      .min(12)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .required()
      .messages({
        "string.pattern.base":
          "Password must contain uppercase, lowercase, number, and special character",
        "string.min": "Password must be at least 12 characters",
        "string.empty": "Password is required",
      }),
    contact: Joi.string()
      .pattern(/^[0-9]{10}$/)
      .required()
      .messages({
        "string.pattern.base": "Contact must be a valid 10-digit number",
      }),
    gender: Joi.string().valid("Male", "Female", "Other").required(),
    age: Joi.number().min(18).max(120).required(),
  }),

  // Login validation
  login: Joi.object({
    email: Joi.string().email().required().lowercase().messages({
      "string.email": "Please provide a valid email",
    }),
    password: Joi.string().min(12).required(),
  }),

  // OTP validation
  verifyOtp: Joi.object({
    email: Joi.string().email().required().lowercase(),
    otp: Joi.string().length(6).pattern(/^[0-9]{6}$/).required(),
  }),

  // Password reset
  forgotPassword: Joi.object({
    email: Joi.string().email().required().lowercase(),
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string()
      .min(12)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .required(),
  }),

  // Refresh token
  refreshToken: Joi.object({
    refreshToken: Joi.string().required(),
  }),
};

export const appointmentSchemas = {
  // Create appointment
  create: Joi.object({
    doctorId: Joi.string().required().messages({
      "string.empty": "Doctor ID is required",
    }),
    appointmentDate: Joi.date().min("now").required(),
    timeSlot: Joi.object({
      start: Joi.string().required(),
      end: Joi.string().required(),
    }).required(),
    consultationType: Joi.string()
      .valid("Online", "Offline")
      .default("Offline"),
    reason: Joi.string().max(500),
    paymentMethod: Joi.string().required(),
  }),

  // Update appointment
  update: Joi.object({
    appointmentDate: Joi.date(),
    timeSlot: Joi.object({
      start: Joi.string(),
      end: Joi.string(),
    }),
    status: Joi.string().valid(
      "Pending",
      "Confirmed",
      "Cancelled",
      "With-Doctor",
      "Completed",
      "Missed"
    ),
    notes: Joi.string().max(500),
  }),
};

export const messageSchemas = {
  // Send message
  sendMessage: Joi.object({
    conversationId: Joi.string().required(),
    text: Joi.string().max(5000),
    messageType: Joi.string()
      .valid("text", "image", "audio", "pdf", "document", "video")
      .default("text"),
    fileUrl: Joi.string().uri(),
  }).min(2),

  // Mark as read
  markAsRead: Joi.object({
    messageId: Joi.string().required(),
    conversationId: Joi.string().required(),
  }),
};

export const profileSchemas = {
  // Update profile
  update: Joi.object({
    fullName: Joi.string().min(3).max(50).trim(),
    email: Joi.string().email().lowercase(),
    contact: Joi.string().pattern(/^[0-9]{10}$/),
    dateOfBirth: Joi.date(),
    gender: Joi.string().valid("Male", "Female", "Other"),
    address: Joi.object({
      street: Joi.string(),
      city: Joi.string(),
      state: Joi.string(),
      zip: Joi.string(),
    }),
  }),
};

/**
 * Validate request data against schema
 * Returns { error, value } object
 */
export const validateRequest = (data, schema) => {
  return schema.validate(data, { abortEarly: false, stripUnknown: true });
};

export default {
  authSchemas,
  appointmentSchemas,
  messageSchemas,
  profileSchemas,
  validateRequest,
};
