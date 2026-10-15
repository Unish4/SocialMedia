import mongoose from "mongoose";
import { ENV } from "../utils/env.js";

export const connectDB = async () => {
  if (!ENV.MONGODB_URI) {
    console.warn("MONGODB_URI is not set. Skipping MongoDB connection.");
    return false;
  }

  try {
    const conn = await mongoose.connect(ENV.MONGODB_URI);
    console.log("MongoDB connected successfully", conn.connection.host);
    return true;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};
