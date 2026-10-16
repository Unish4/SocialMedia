import mongoose from "mongoose";
import { ENV } from "../utils/env.js";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(ENV.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};
