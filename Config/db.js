import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URL;

    if (!uri) {
      throw new Error("MONGODB_URL is missing from .env");
    }

    await mongoose.connect(uri, {
      maxPoolSize: parseInt(
        process.env.MONGODB_POOL_SIZE || "20",
        10
      ),
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });

    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
};

export default connectDB;