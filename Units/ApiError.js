/**
 * Custom API Error Classes
 * Provides structured error handling throughout the application
 */

export class ApiError extends Error {
  constructor(statusCode, message, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // Distinguishes operational errors from programming errors
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ApiError {
  constructor(message = "Validation failed", errors = {}) {
    super(400, message, { errors });
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = "Authentication failed") {
    super(401, message);
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = "Insufficient permissions") {
    super(403, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource = "Resource", message = null) {
    super(404, message || `${resource} not found`);
  }
}

export class ConflictError extends ApiError {
  constructor(message = "Resource already exists") {
    super(409, message);
  }
}

export class RateLimitError extends ApiError {
  constructor(message = "Too many requests, please try again later") {
    super(429, message);
  }
}

export class ServerError extends ApiError {
  constructor(message = "Internal server error") {
    super(500, message);
  }
}

export default {
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServerError,
};
