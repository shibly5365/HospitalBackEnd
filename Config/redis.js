import redis from "redis";
import logger from "./logger.js";

let redisClient = null;

/**
 * Initialize Redis connection
 * Safe for optional use - app works without Redis during development
 */
export const initializeRedis = async () => {
  try {
const client = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || "redis"}:${
    process.env.REDIS_PORT || 6379
  }`,
});

    client.on("error", (err) => {
      logger.error("Redis connection error:", err);
    });

    client.on("connect", () => {
      logger.info("✅ Redis connected successfully");
    });

    await client.connect();
    redisClient = client;
    return client;
  } catch (error) {
    logger.warn("⚠️  Redis connection failed (optional):", error.message);
    logger.warn(
      "App will work without Redis, but some features will be limited",
    );
    return null;
  }
};

/**
 * Get Redis client instance
 * Returns null if Redis not available
 */
export const getRedisClient = () => {
  return redisClient;
};

/**
 * Check if Redis is available
 */
export const isRedisAvailable = () => {
  return redisClient !== null;
};

/**
 * Close Redis connection
 */
export const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    logger.info("Redis connection closed");
  }
};

export default redisClient;
