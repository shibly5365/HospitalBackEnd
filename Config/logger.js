import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Winston Logger Configuration
 * Provides structured, production-grade logging
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: {
    service: "hospital-backend",
    environment: process.env.NODE_ENV || "development",
  },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/error.log"),
      level: "error",
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
    // All logs
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/combined.log"),
      maxsize: 10485760,
      maxFiles: 10,
    }),
    // Auth logs for security
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/auth.log"),
      level: "info",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],
});

// Console transport for development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length
            ? "\n" + JSON.stringify(meta, null, 2)
            : "";
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      ),
    })
  );
}

/**
 * Log authentication events
 */
export const logAuthEvent = (userId, event, details = {}) => {
  logger.info("Auth event", {
    userId,
    event,
    ...details,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log API requests
 */
export const logApiRequest = (method, path, statusCode, duration, userId = null) => {
  logger.info("API request", {
    method,
    path,
    statusCode,
    durationMs: duration,
    userId,
  });
};

/**
 * Log errors with context
 */
export const logError = (error, context = {}) => {
  logger.error("Error occurred", {
    message: error.message,
    stack: error.stack,
    code: error.code,
    ...context,
  });
};

export default logger;
