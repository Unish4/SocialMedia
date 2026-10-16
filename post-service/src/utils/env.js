import dotenv from "dotenv";
dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  REDIS_URL: process.env.REDIS_URL,
  CLIENT_URL: process.env.CLIENT_URL,
};
