import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("db connect");
  } catch (error) {
    console.log("err db",error);
    process.exit(1);
  }
};

export default connectDB;
