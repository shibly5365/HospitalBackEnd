import jwt from "jsonwebtoken";
import redisService from "../Units/redisService.js";
import logger from "../Config/logger.js";
import { AuthenticationError } from "../Units/ApiError.js";

/**
 * Token Service
 * Handles JWT token generation, verification, and refresh token management
 */

class TokenService {
  /**
   * Generate access token (short-lived, 15 minutes)
   */
  generateAccessToken(payload, expiresIn = "15m") {
    if (!process.env.ACCESS_TOKEN_SECRET) {
      throw new Error("ACCESS_TOKEN_SECRET not configured");
    }

    return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn,
      algorithm: "HS256",
    });
  }

  /**
   * Generate refresh token (long-lived, 7 days)
   */
  generateRefreshToken(payload, expiresIn = "7d") {
    if (!process.env.REFRESH_TOKEN_SECRET) {
      throw new Error("REFRESH_TOKEN_SECRET not configured");
    }

    return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
      expiresIn,
      algorithm: "HS256",
    });
  }

  /**
   * Create both access and refresh tokens
   */
  generateTokens(payload) {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60 * 1000, // 15 minutes in milliseconds
      refreshExpiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token) {
    try {
      if (!process.env.ACCESS_TOKEN_SECRET) {
        throw new Error("ACCESS_TOKEN_SECRET not configured");
      }

      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
        algorithms: ["HS256"],
      });

      return decoded;
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw new AuthenticationError("Access token has expired");
      }
      if (error.name === "JsonWebTokenError") {
        throw new AuthenticationError("Invalid access token");
      }
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token) {
    try {
      if (!process.env.REFRESH_TOKEN_SECRET) {
        throw new Error("REFRESH_TOKEN_SECRET not configured");
      }

      const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, {
        algorithms: ["HS256"],
      });

      return decoded;
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw new AuthenticationError("Refresh token has expired");
      }
      if (error.name === "JsonWebTokenError") {
        throw new AuthenticationError("Invalid refresh token");
      }
      throw error;
    }
  }

  /**
   * Store refresh token in Redis for tracking
   * Enables token invalidation/logout
   */
  async storeRefreshToken(userId, refreshToken, expiresIn = 7 * 24 * 60 * 60) {
    try {
      const key = `refreshToken:${userId}`;
      await redisService.set(
        key,
        {
          token: refreshToken,
          createdAt: new Date().toISOString(),
        },
        expiresIn
      );
      return true;
    } catch (error) {
      logger.warn("Failed to store refresh token in Redis", {
        userId,
        error: error.message,
      });
      // Don't fail if Redis unavailable
      return true;
    }
  }

  /**
   * Retrieve stored refresh token from Redis
   */
  async getRefreshToken(userId) {
    try {
      const key = `refreshToken:${userId}`;
      return await redisService.get(key);
    } catch (error) {
      logger.warn("Failed to retrieve refresh token from Redis", {
        userId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Invalidate refresh token (logout)
   */
  async invalidateRefreshToken(userId) {
    try {
      const key = `refreshToken:${userId}`;
      await redisService.delete(key);
      return true;
    } catch (error) {
      logger.warn("Failed to invalidate refresh token", {
        userId,
        error: error.message,
      });
      return true;
    }
  }

  /**
   * Add token to blacklist (for logout)
   */
  async blacklistToken(token, expiresIn = 15 * 60) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded) return false;

      const key = `blacklistedToken:${decoded.jti || token}`;
      await redisService.set(key, { blacklistedAt: new Date() }, expiresIn);
      return true;
    } catch (error) {
      logger.warn("Failed to blacklist token", {
        error: error.message,
      });
      return true;
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded) return false;

      const key = `blacklistedToken:${decoded.jti || token}`;
      const result = await redisService.exists(key);
      return result;
    } catch (error) {
      logger.warn("Failed to check token blacklist", {
        error: error.message,
      });
      return false;
    }
  }
}

export default new TokenService();
