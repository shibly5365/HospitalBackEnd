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
      url: process.env.REDIS_URL,
      socket: {
        tls: true,
        rejectUnauthorized: false,
      },
    });

    client.on("error", (err) => {
      logger.error("❌ Redis connection error:", err);
    });

    client.on("connect", () => {
      logger.info("✅ Redis connected successfully");
    });

    await client.connect();

    redisClient = client;

    return client;

  } catch (error) {

    logger.error("❌ Redis connection failed");
    logger.error(error);

    process.exit(1); // 🔥 STOP SERVER
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
