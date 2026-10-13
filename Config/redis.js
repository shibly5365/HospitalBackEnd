import { createClient } from "redis";
import logger from "./logger.js";

let redisClient = null;

export const initializeRedis = async () => {
  if (!process.env.REDIS_URL) {
    logger.warn("Redis URL missing; continuing without Redis");
    return null;
  }

  try {
    // Log only the hostname, never the credentials.
    logger.info(
      `Connecting to Redis host: ${
        new URL(process.env.REDIS_URL).hostname
      }`
    );

    const client = createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            return new Error("Redis reconnection limit reached");
          }

          return Math.min(retries * 250, 2000);
        },
      },
    });

    client.on("error", (error) => {
      logger.error("Redis connection error:", error.message);
    });

    client.on("ready", () => {
      logger.info("Redis connected successfully");
    });

    await client.connect();

    redisClient = client;
    return client;
  } catch (error) {
    logger.error("Redis initialization failed:", error.message);
    return null;
  }
};

export const getRedisClient = () => redisClient;

export const isRedisAvailable = () =>
  redisClient?.isReady === true;

export const closeRedis = async () => {
  if (redisClient?.isOpen) {
    await redisClient.quit();
    redisClient = null;
    logger.info("Redis connection closed");
  }
};