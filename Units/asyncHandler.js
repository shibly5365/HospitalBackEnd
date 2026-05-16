import logger from "../Config/logger.js";

/**
 * Async Error Wrapper
 * Wraps async controller functions to catch errors automatically
 * Prevents try-catch boilerplate in every controller
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      logger.error("Async handler error", {
        message: error.message,
        path: req.path,
        method: req.method,
        userId: req.user?.id,
      });
      next(error);
    });
  };
};

/**
 * Alternative: Higher-order function for use in other contexts
 */
export const catchAsyncError = (fn) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error("Async error", { message: error.message });
      throw error;
    }
  };
};

export default asyncHandler;
