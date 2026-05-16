// ✅ Redis Configuration

import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error("❌ Redis max reconnection attempts exceeded");
        return new Error("Redis reconnection failed");
      }
      return Math.min(retries * 50, 500);
    },
  },
});

redisClient.on("error", (err) => {
  console.error("❌ Redis error:", err.message);
});

redisClient.on("connect", () => {
  console.log("✅ Redis connected");
});

redisClient.on("reconnecting", () => {
  console.log("🔄 Redis reconnecting...");
});

// Connect to Redis
try {
  await redisClient.connect();
} catch (err) {
  console.error("❌ Failed to connect to Redis:", err.message);
  console.warn("⚠️  Redis not available - using fallback storage");
}

export default redisClient;
