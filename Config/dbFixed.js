// ✅ MongoDB connection with Redis integration

import mongoose from "mongoose";
import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

// ✅ MongoDB Connection
export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE || "20", 10),
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
};

// ✅ Redis Connection (for OTP, caching, sessions)
export const connectRedis = async () => {
  try {
    const redisClient = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
      },
    });

    redisClient.on("error", (err) => {
      console.error("❌ Redis Client Error:", err);
    });

    redisClient.on("connect", () => {
      console.log("✅ Redis connected successfully");
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error("❌ Redis connection error:", error.message);
    console.warn("⚠️  Continuing without Redis - OTP storage will use in-memory");
    return null;
  }
};

export default connectDB;
