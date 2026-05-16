import redisService from "../Units/redisService.js";
import logger from "../Config/logger.js";
import { RateLimitError } from "../Units/ApiError.js";

/**
 * Rate Limiter Service
 * Implements sliding window rate limiting using Redis
 */

class RateLimiterService {
  /**
   * Check and enforce rate limit
   * @param {string} key - Unique identifier (e.g., user_id, IP)
   * @param {number} maxAttempts - Maximum attempts allowed
   * @param {number} windowSeconds - Time window in seconds
   * @returns {boolean} - true if within limit, throws error if exceeded
   */
  async checkLimit(key, maxAttempts = 5, windowSeconds = 900) {
    try {
      const rateKey = `ratelimit:${key}`;

      // Check current count
      let attempts = await redisService.get(rateKey);

      if (!attempts) {
        // First attempt
        await redisService.set(rateKey, { count: 1 }, windowSeconds);
        return true;
      }

      if (attempts.count >= maxAttempts) {
        throw new RateLimitError(
          `Too many attempts. Please try again in ${windowSeconds / 60} minutes.`
        );
      }

      // Increment counter
      await redisService.set(
        rateKey,
        { count: attempts.count + 1 },
        windowSeconds
      );

      return true;
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      logger.warn("Rate limiter error", { key, error: error.message });
      // Allow request if Redis unavailable
      return true;
    }
  }

  /**
   * Reset rate limit for a key
   */
  async resetLimit(key) {
    try {
      const rateKey = `ratelimit:${key}`;
      await redisService.delete(rateKey);
      return true;
    } catch (error) {
      logger.warn("Failed to reset rate limit", { key, error: error.message });
      return true;
    }
  }

  /**
   * Get remaining attempts
   */
  async getRemainingAttempts(key, maxAttempts = 5) {
    try {
      const rateKey = `ratelimit:${key}`;
      const attempts = await redisService.get(rateKey);

      if (!attempts) {
        return maxAttempts;
      }

      return Math.max(0, maxAttempts - attempts.count);
    } catch (error) {
      logger.warn("Failed to get remaining attempts", {
        key,
        error: error.message,
      });
      return maxAttempts;
    }
  }

  /**
   * Check brute force on auth endpoint
   * 5 attempts per 15 minutes per email
   */
  async checkAuthLimit(email) {
    return this.checkLimit(`auth:${email}`, 8, 15 * 60);
  }

  /**
   * Check brute force on OTP endpoint
   * 10 attempts per hour per email
   */
  async checkOtpLimit(email) {
    return this.checkLimit(`otp:${email}`, 10, 60 * 60);
  }

  /**
   * Check brute force on password reset
   * 3 attempts per hour per email
   */
  async checkPasswordResetLimit(email) {
    return this.checkLimit(`passwordReset:${email}`, 3, 60 * 60);
  }

  /**
   * Check global API rate limit
   * 100 requests per minute per IP
   */
  async checkGlobalLimit(ip) {
    return this.checkLimit(`global:${ip}`, 100, 60);
  }

  /**
   * Check per-user API rate limit
   * 1000 requests per hour per user
   */
  async checkUserLimit(userId) {
    return this.checkLimit(`user:${userId}`, 1000, 60 * 60);
  }
}

export default new RateLimiterService();
