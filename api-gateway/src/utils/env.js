import dotenv from "dotenv";
dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";

export const ENV = {
  PORT: process.env.API_GATEWAY_PORT || 3000,
  NODE_ENV: nodeEnv,
  REDIS_URL: process.env.REDIS_URL,
  IDENTITY_SERVICE_URL: process.env.IDENTITY_SERVICE_URL || "http://localhost:3001",
};
