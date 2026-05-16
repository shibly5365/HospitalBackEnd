import { logApiRequest, logError } from "../Config/logger.js";
import { errorResponse } from "../Units/ApiResponse.js";
import { ApiError } from "../Units/ApiError.js";

/**
 * Request Logging Middleware
 * Logs all incoming requests with method, path, and response status
 */
export const requestLoggingMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Capture response sending
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;
    logApiRequest(req.method, req.path, res.statusCode, duration, req.user?.id);
    return originalSend.call(this, data);
  };

  next();
};

/**
 * Global Error Handler Middleware
 * Catches all errors and sends standardized responses
 * Must be placed at the end of middleware chain
 */
export const globalErrorHandler = (err, req, res, next) => {
  let error = err;

  // Handle different error types
  if (!(error instanceof ApiError)) {
    if (error.name === "ValidationError") {
      error = new ApiError(
        400,
        "Validation Error",
        error.details
      );
    } else if (error.name === "UnauthorizedError") {
      error = new ApiError(401, "Unauthorized");
    } else if (error.name === "JsonWebTokenError") {
      error = new ApiError(401, "Invalid token");
    } else if (error.name === "TokenExpiredError") {
      error = new ApiError(401, "Token has expired");
    } else if (error.code === "ENOTFOUND") {
      error = new ApiError(500, "Database connection error");
    } else {
      error = new ApiError(500, error.message || "Internal server error");
    }
  }

  // Log error
  logError(error, {
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    statusCode: error.statusCode,
  });

  // Send error response
  return errorResponse(
    res,
    error.message,
    error.statusCode,
    error.details
  );
};

export default {
  requestLoggingMiddleware,
  globalErrorHandler,
};
