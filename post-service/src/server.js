import express from "express";
import cors from "cors";
import helmet from "helmet";
import Redis from "ioredis";

import { ENV } from "./utils/env.js";
import logger from "./utils/logger.js";
import { connectDB } from "./config/db.js";
import postRoutes from "./routes/post-routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();
const PORT = ENV.PORT || 3002;

// Security middleware
app.use(helmet());

// CORS
app.use(
  cors({
    origin: ENV.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Parse request bodies
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Request logging
app.use((req, res, next) => {
  logger.info("Received %s request to %s", req.method, req.path);
  next();
});

async function createRedisClient() {
  if (!ENV.REDIS_URL) {
    logger.warn("REDIS_URL is not set. Skipping Redis connection.");
    return null;
  }

  const redisClient = new Redis(ENV.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });

  redisClient.on("error", (err) => logger.warn("Redis error: %s", err.message));

  try {
    await redisClient.connect();
    await redisClient.ping();
    logger.info("Redis connected successfully");
    return redisClient;
  } catch (error) {
    logger.warn(
      "Redis unavailable, continuing without Redis: %s",
      error?.message || String(error),
    );
    redisClient.disconnect();
    return null;
  }
}

// Start server after dependencies connect
async function startServer() {
  let redisClient;

  try {
    await connectDB();
    redisClient = await createRedisClient();

    // API routes
    app.use("/api/posts", postRoutes);

    // Handle unmatched routes
    app.use(notFoundHandler);

    // Centralized error handler
    app.use(errorHandler);

    const server = app.listen(PORT, () => {
      logger.info(`Post service running on port ${PORT}`);
      logger.info(`Environment: ${ENV.NODE_ENV}`);
    });

    server.on("error", (error) => {
      logger.error("HTTP server error: %s", error.message);
      process.exit(1);
    });
  } catch (error) {
    logger.error("Failed to start post service: %s", error.message);

    if (redisClient) {
      redisClient.disconnect();
    }

    process.exit(1);
  }
}

startServer();

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection: %s", String(reason));
});


